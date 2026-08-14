# Phase B F0 Impact Review — Payment Evidence and Cancellation Guardrails

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo; not production
- **Purpose:** Prerequisite review for `contract_cancel`
- **Status:** FULL-PROJECT EVIDENCE REVIEW COMPLETE — BLOCKERS AND DECISIONS RECORDED
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


## 9. Repository-wide evidence verification

This section records the read-only whole-project trace performed after the initial F0 review. It confirms actual current behavior; it does not authorize a fix.

### 9.1 Payment recording is non-atomic

**File:** `src/routes/_authenticated/payments/index.tsx`

The browser currently:

1. updates each affected installment;
2. inserts the payment;
3. updates contract outstanding/status;
4. inserts the cash entry;
5. inserts cash-entry lines.

Each step is a separate Supabase call. A failure or concurrent cancellation can leave partial or stale state. This confirms that a safe payment/cancellation race cannot be solved only in UI.

### 9.2 Current “payment exists” checks violate the confirmed rule

**Files:**

- `src/routes/_authenticated/applications/index.tsx`
- `supabase/migrations/20260813195500_approval_executor_phase_a_fail_closed.sql`

Both the application edit screen and Approval Executor currently count only payments where `voided = false`.

This is incorrect under the confirmed rule: once any payment event has occurred, debt-bearing fields and cancellation/deletion remain locked even if the payment is later voided. Therefore both UI guidance and database authority require one shared permanent definition of “ever paid.” Fixing only one layer would leave a bypass or misleading screen.

### 9.3 Existing application cancellation conflicts with payoff semantics

**File:** `supabase/migrations/20260813195500_approval_executor_phase_a_fail_closed.sql`

The current Phase A `delete_record + loan_applications + cancel` branch blocks cancellation only when a linked contract has status other than `closed`. This means a linked closed contract can pass and the application can become `cancelled`.

That conflicts with the confirmed rule: payoff/closure is normal contract completion, not cancellation of the loan request. This existing path is a Phase B regression blocker and must be separated from the new `contract_cancel` meaning. No interpretation or code change is authorized by this finding alone.

### 9.4 Hard-delete can erase or cascade evidence

**File:** `supabase/migrations/20260731165059_0881073d-26d7-4f95-abbd-2f4862f2dcf8.sql`

Current grants/policies allow manager deletion of:

- contracts;
- installments;
- payments;
- collection activities.

Payments and collection activities reference contracts with `ON DELETE CASCADE`; payment `installment_id` uses `ON DELETE SET NULL`.

Therefore a manager-level physical delete can erase the evidence needed for eligibility, history, reporting, and audit. F0 cannot rely only on current rows while those paths remain open.

### 9.5 Collections need both UI filtering and database enforcement

**File:** `src/routes/_authenticated/collections/index.tsx`

The overdue queue reads overdue installments without filtering the linked contract lifecycle. Creating a collection activity inserts directly from the browser and does not revalidate that the contract is still collectible.

Deleting installments during approved cancellation removes normal queue rows, but that alone is not sufficient. A stale screen or direct write could still create activity. Required protection is:

- defensive UI query filtering; and
- database rejection of new collection activity for `cancelled` contracts.

Existing collection history must remain unchanged.

### 9.6 Dashboard and reports have different protection levels

**Files:**

- `src/routes/_authenticated/dashboard.tsx`
- `src/lib/reports.ts`

The dashboard calculates overdue totals directly from installments without joining/filtering contract status. The main report library generally fetches debtors using `active` and `overdue` contract statuses, but its installment bucket query itself is broader.

Because approved cancellation deletes installments, current totals may appear correct afterward, but defensive status filtering is still required to protect stale, inconsistent, or partially migrated data. Historical cash reporting already excludes logically void cash entries and must continue preserving actual cash history.

### 9.7 Approval dispatch is already database-centered

**Files:**

- `src/routes/_authenticated/approvals/index.tsx`
- `supabase/migrations/20260813195500_approval_executor_phase_a_fail_closed.sql`

The approval UI calls one `execute_approval_request` RPC, and the current Phase A migration explicitly states that `contract_cancel`, `restructure`, and `payment_void` are not implemented. This fail-closed boundary is correct and must be preserved.

The new workflow should use a dedicated cancellation executor dispatched from the Approval Engine rather than adding browser-side reflection or loosely extending multiple UI writes.

### 9.8 Existing lifecycle/history presentation

**File:** `src/routes/_authenticated/contracts/$contractId.tsx`

Contract detail already loads all payments and visually marks voided rows, which supports preserving historical receipts. It also loads installments directly; after approved cancellation and installment deletion, the page needs a clear cancelled state and audit-schedule history source rather than appearing as an unexplained empty schedule.

## 10. Confirmed F0 blocker list

F0 is not implementation-ready until all items below are explicitly accepted in an implementation plan:

1. Replace every `voided = false` eligibility check used for debt-bearing locks with one permanent “ever paid” authority.
2. Prevent historical or future hard-delete from reopening eligibility.
3. Correct the existing closed-contract application-cancel conflict without changing normal payoff history.
4. Move payment authority and cancellation approval to coordinated database transactions sharing the same contract lock.
5. Add database protection against payment or collection creation after cancellation.
6. Enforce one pending cancellation request per contract and idempotent execution.
7. Define durable installment snapshot storage and cancelled-contract history presentation.
8. Add defensive lifecycle filters to dashboard, overdue, collection, and report consumers.
9. Preserve Phase A behavior and Supabase client/RPC/Proxy regression coverage.
10. Keep `restructure` unsupported and fail-closed.

## 11. Updated recommendation

The lowest-risk direction remains:

- an immutable database-maintained `first_payment_at` marker for the fast eligibility decision;
- preserved payment/cash/audit records as supporting evidence;
- a database trigger or transactional payment RPC that sets the marker and never clears it;
- conservative legacy backfill from every payment row, including voided rows, plus payment-linked cash evidence;
- fail-closed handling where historical evidence conflicts or cannot be proven;
- shared contract-row locking for payment and cancellation;
- removal of hard-delete as a correction method;
- a dedicated `contract_cancel` executor, not browser reflection.

A marker by itself is not enough unless direct inserts, legacy backfill, hard-delete policy, and concurrency are addressed together.

## 12. Review result

The F0 full-project Impact Review is now complete at the evidence level. It has identified current consumers, two existing business-rule conflicts, deletion/cascade risks, concurrency risks, and the required regression boundary.

No code, schema, UI, RPC, RLS, database record, fixture, or deployment was changed. The next step is explicit confirmation of the F0 decisions before preparing a separate implementation plan.
