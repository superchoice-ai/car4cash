# Phase B F0 Impact Review — Payment Evidence and Cancellation Guardrails

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo; not production
- **Purpose:** Prerequisite review for `contract_cancel`
- **Status:** IMPACT REVIEW RECORDED — DECISIONS REQUIRED
- **Implementation:** NOT AUTHORIZED / NOT STARTED
- **Out of scope:** `restructure`, runtime code, schema migration, UI, RPC, RLS, data changes, and deployment

## 1. Plain-language goal

Before allowing a contract to be cancelled, the system must be able to answer “Has this contract ever received a payment?” permanently and correctly.

It must also prevent this race:

- staff starts a cancellation while no payment exists;
- another staff member records a payment before approval;
- cancellation is then approved using stale information.

The safe result is that only one action wins. A contract that has ever received a payment can never be cancelled, even if that payment is later voided.

## 2. Confirmed current risks

1. Current payment rows can be hard-deleted by an existing manager path. Looking only at rows that still exist can falsely report “never paid.”
2. Payment recording currently performs several browser-side writes rather than one database transaction.
3. Payment and cancellation do not currently share one database lock/authority.
4. More than one pending cancellation request may be created for the same contract.
5. An approval can be retried unless execution is explicitly idempotent.
6. Cancellation deletes installments after audit, so the snapshot must succeed before deletion.
7. Reports and collections may still include cancelled contracts unless every consumer filters defensively.
8. Expanding the shared Approval Executor can regress Phase A workflows and Supabase RPC behavior.

## 3. Confirmed consumers and related data

| Area | Impact |
|---|---|
| `approval_requests` | Stores request/payload only while pending; one pending cancellation per contract |
| Approval Executor | Dispatches only an exact supported combination; approves only after transaction succeeds |
| `contracts` | Eligibility, lock, immutable payment-history evidence, final `cancelled` status |
| `loan_applications` | Final `cancelled` status after approved cancellation |
| `payments` | Payment event permanently blocks cancellation, including later-voided payment |
| `installments` | Snapshot first, then delete only after approved cancellation |
| `disbursements` | Preserve unchanged; recovery is outside system responsibility |
| `cash_entries` / `cash_entry_lines` | Preserve financial history; payment-linked evidence also blocks unsafe cancellation |
| `collection_activities` | Preserve history; reject new work for cancelled contracts |
| Payment UI/RPC | Must reject payment after cancellation wins |
| Reports/dashboard | Must exclude cancelled debt without deleting historical cash movement |
| Audit/notifications | Record requester, approver, reason, before/after, snapshot, and affected objects |
| RLS/permissions | Must not allow a direct write or hard-delete to bypass the executor |
| Supabase clients | Existing `.from()`, `.rpc()`, auth/session, server paths, and Proxy binding require regression |

## 4. Lowest-risk design direction for decision

This is a recommendation for review, not implementation authorization.

### F0-A — Permanent “ever paid” evidence

Recommended minimal design:

- add an immutable contract-level marker such as `first_payment_at`;
- set it only inside the database when the first payment event is created;
- never clear it when a payment is voided;
- do not use UI state or only the current count of payment rows as authority;
- cross-check preserved payment/cash evidence during cancellation approval.

Alternative: a separate append-only payment-event ledger. It is stronger and more extensible but has a larger migration and consumer impact. For `contract_cancel` only, the immutable marker plus preserved financial rows has the smaller blast radius.

### F0-B — Close the payment/cancellation race

Both operations must lock the same contract row inside database transactions:

- if payment commits first, cancellation revalidation fails;
- if cancellation commits first, payment recording fails because the contract is cancelled;
- pending status alone must never reserve or mutate the contract.

### F0-C — Preserve evidence

- remove physical deletion as an allowed way to correct a payment;
- use logical `payment_void` only after its own workflow is approved;
- voiding must not clear `first_payment_at` or cancellation lock;
- existing legacy hard-delete exposure must be closed before enabling `contract_cancel`.

### F0-D — Prevent duplicates and replay

- allow at most one pending `contract_cancel` request per contract;
- make approved execution idempotent;
- repeated approval, stale approval, and already-cancelled targets fail closed.

### F0-E — Audit before installment deletion

The same transaction must:

1. lock and revalidate the request and contract;
2. verify permanent no-payment evidence;
3. capture the exact installment schedule and relevant before-state;
4. write durable audit evidence;
5. set contract and application to `cancelled`;
6. delete installments;
7. mark approval approved only after every step succeeds.

Any failure rolls back all steps.

### F0-F — Defensive consumers

- Payment recording rejects cancelled contracts.
- Collection creation rejects cancelled contracts.
- Overdue, active-debt, and collection queries filter collectible contract states.
- Historical contract, disbursement, cash, approval, and collection records remain queryable.

## 5. Decisions required before implementation planning

| Decision | Recommended answer |
|---|---|
| Permanent evidence | Immutable `contracts.first_payment_at` plus preserved payment/cash history |
| Payment deletion | Prohibit hard delete; correction must be logical void |
| Race control | Shared contract-row lock in database transactions |
| Duplicate pending request | Database-enforced single pending cancellation per contract |
| Retry behavior | Idempotent executor; second execution fails safely/no duplicate effects |
| Installment evidence | Durable exact snapshot must be written before atomic deletion |
| Report/collection behavior | Filter by collectible contract status and keep history |
| Legacy data | Reconcile before enabling; uncertainty fails closed |

No option above is approved merely because it is recommended here.

## 6. Regression plan

### Eligibility and evidence

- Dedicated zero-payment fixture can request and approve cancellation.
- One payment blocks request and approval.
- A voided payment still blocks cancellation.
- Removing/voiding visible payment data cannot clear permanent evidence.
- Payment-linked cash evidence inconsistent with the marker fails closed for review.

### Timing and transaction

- Pending and rejected requests change no business data.
- Payment-before-approval makes cancellation fail.
- Cancellation-before-payment makes payment fail.
- Simultaneous attempts cannot both commit.
- Duplicate pending and repeated approval cannot execute twice.
- Forced failure at every step leaves approval and business data unchanged.

### Approved result

- Contract and application become `cancelled`.
- Audit contains the exact pre-cancellation schedule.
- Installments are deleted only after audit succeeds.
- Disbursement, payments/cash evidence, vehicle-book state, and collection history remain.
- No new payment or collection work can be created.
- Active debt, overdue, and collection reports exclude the cancelled contract.

### Existing-system regression

- All Phase A approval/rejection paths remain functional.
- Non-debt-bearing application edits remain allowed through approval.
- Debt-bearing edits remain locked after the first payment event.
- Supabase `.from()`, `.rpc()`, auth/session, server client, RLS, and Proxy method binding pass.

## 7. Rollback boundary

F0 must later be split from workflow implementation into its own reversible, reviewable change. Financial evidence must never be removed during rollback. Any future migration needs a forward compensating path, executor-disable switch, reconciliation query, and demo regression evidence before production consideration.

## 8. Current conclusion

F0 Impact Review is recorded. The safest current direction is an immutable first-payment marker, preserved financial evidence, shared database locking, duplicate/replay protection, audit-before-delete, and defensive consumer filters.

No runtime change has been made. Implementation planning must wait for explicit confirmation of the decisions in Section 5.
