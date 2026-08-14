# Phase B Impact Review — payment_void

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo environment; not production
- **Review status:** DRAFT — IMPACT REVIEW ONLY
- **Implementation status:** NOT AUTHORIZED / NOT IMPLEMENTED
- **Approval Engine status:** `payment_void` remains fail-closed until every decision gate is resolved and explicitly approved.
- **Sequence:** This is the second active Phase B workflow, after `contract_cancel`. `restructure` is out of scope and unsupported. This review does not authorize runtime implementation.

## 1. Meaning and boundary

`payment_void` is an approved logical cancellation of an incorrectly recorded receipt. It must preserve the original receipt as audit evidence and reverse every derived accounting/debt effect exactly once.

Potential reasons include duplicate receipt, wrong contract, wrong amount/date, or materially wrong allocation. Wording-only corrections that do not affect money require a separately defined correction policy.

A voided payment remains historical evidence that a payment event occurred. Voiding must never reopen eligibility for ordinary debt-bearing edits or `contract_cancel`.

## 2. Current payment mutation path

The browser currently performs sequential operations:

1. Allocate the amount across one or more open installments and update each row.
2. Insert one `payments` row.
3. Reduce `contracts.outstanding` and possibly set status `closed`.
4. Insert one payment-linked `cash_entries` row.
5. Insert categorized `cash_entry_lines`.

These steps are not one database transaction. A failure can create partial state. A safe void cannot be implemented as only `payments.voided=true`.

## 3. Demo database evidence

Read-only inspection found:

- 314 payment rows across 34 contracts.
- No payment is currently voided.
- Every payment has one `installment_id`.
- Only 312 payments have a linked cash entry; 2 payments have no linked cash entry.
- All 312 payment-linked cash entries have lines and their line totals equal entry totals.
- There are 34 latest payments: 30 belong to open contracts and 4 to closed contracts.
- There are 280 earlier payments.
- No payment-to-installment allocation ledger exists in repository migrations.

The demo inconsistencies must be classified before testing. Existing records must not be silently repaired during this workflow review.

## 4. Critical allocation gap

The UI can allocate one payment across multiple installments, but `payments.installment_id` stores only the first affected installment.

Therefore current data cannot prove:

- every installment touched by one payment;
- amount applied to each installment;
- each installment's exact pre-payment state;
- whether another later payment also changed the same installment;
- how to reverse paid amount, status, and paid date without disturbing later payments.

This is the primary blocker. Guessing from current balances or aggregate principal/interest is prohibited.

## 5. Confirmed dependency trace

| Area | Object/consumer | Required effect |
|---|---|---|
| Approval | `approval_requests` | Request/reason only; no early mutation |
| Executor | `execute_approval_request()` | Exact `payment_void` whitelist branch |
| Receipt | `payments` | Logical void with actor, time, reason, approval reference |
| Allocation | new allocation ledger | Exact payment-to-installment deltas and before/after |
| Schedule | `installments` | Reverse only the target payment's allocations |
| Contract | `contracts` | Restore outstanding and lifecycle consistently |
| Cashbook | `cash_entries` | Logical void linked to the same approval |
| Cash lines | `cash_entry_lines` | Preserve lines as history; excluded through voided parent |
| Collections | installments/activities | Recreated arrears may re-enter queues |
| Reports/dashboard | payment/cash/debt totals | Exclude voided cash while restoring debt |
| Documents | receipt print/history | Original visibly void; no physical deletion |
| Audit/notifications | logs/events | Complete reversal evidence |
| Security | RLS/roles/branch | Database-authoritative decision |
| Concurrency | later payments | Void must not corrupt subsequent allocations |

## 6. Non-negotiable mutation rules

### Pending

- Insert only the approval request with reason and target payment.
- Do not change payment, cashbook, installments, contract, collections, or reports.
- UI may display a pending badge derived from the approval request.

### Rejected

- Record rejection and audit only.
- Keep payment and every derived value unchanged.

### Approved

- Lock approval, payment, contract, affected installments, allocation rows, and linked cash entry.
- Revalidate eligibility and concurrency.
- Reverse exact allocation deltas.
- Restore contract outstanding/status from authoritative schedule state.
- Logically void payment and linked cash entry.
- Preserve cash lines and original receipt history.
- Write audit evidence and mark approval approved only after all changes succeed.
- Roll back everything on any failure.

## 7. Best-practice data direction

Before enabling future payments/voids:

1. Move payment execution to one database transaction/RPC.
2. Add an immutable payment-allocation ledger with one row per payment × installment allocation.
3. Store applied principal, interest, penalty/fee treatment, allocation order, and before/after state or sufficient immutable deltas.
4. Prevent physical deletion of payment, allocation, cash, and audit evidence.
5. Add void metadata: reason, approval ID, voided by, and voided at.
6. Recalculate contract outstanding from authoritative effective installments rather than adding/subtracting an unverified UI amount.
7. Use idempotency so the same approval cannot reverse twice.

Historical payments created before the allocation ledger require a separate legacy strategy. They cannot automatically be assumed reversible.

## 8. Critical decision gates

### Gate A — Eligible reasons

Define accepted reasons and required evidence for duplicate, wrong contract, wrong amount/date, or wrong allocation.

### Gate B — Which payments may be voided

Choose:

- latest active payment only;
- any payment with full forward replay of later allocations;
- historical pre-ledger payments prohibited.

**Recommended initial scope:** latest active payment only and only when complete allocation evidence exists. Earlier payment void requires deterministic replay and materially higher risk.

### Gate C — Closed-contract behavior

Decide whether voiding the final payment:

- reopens contract to `active` or `overdue` based on due dates;
- recreates the outstanding installment state;
- requires a higher approval level.

### Gate D — Cashbook behavior

Recommended: set the linked cash entry to logical void in the same transaction; preserve cash lines and original document number; never delete financial history.

Decide behavior when the payment has no linked cash entry, as found in 2 demo records.

### Gate E — Replacement receipt

Choose whether:

- void completes first and staff records a new receipt separately;
- approval atomically creates a replacement payment;
- replacement requires a reference to the voided receipt.

**Recommended:** void and replacement are separate controlled events, cross-referenced for audit.

### Gate F — Payment date and accounting period

Define rules for backdated void, closed period, daily/monthly report impact, and whether approval date or original receipt date controls reversal reporting.

### Gate G — Later payments

Define whether an earlier payment can be voided when later payments exist.

**Recommended initial scope:** prohibit; support only after an allocation ledger and deterministic forward replay are proven.

### Gate H — Fees and cash-line categories

Define reversal for principal, interest, penalty, insurance, registration, follow-up, and other fees. Contract debt and cash accounting may not treat every category identically.

### Gate I — Collection effects

Recommended: retain collection history; after reversal, recompute effective arrears and allow future collection work from restored installment state.

### Gate J — Receipt/document presentation

Original receipt remains available but prominently marked void with reason, approval, actor, and timestamp. Reuse of the original receipt number is prohibited.

### Gate K — Historical pre-ledger records

Choose:

- prohibit automated void;
- require manual reconciliation and special migration evidence;
- build a verified allocation reconstruction tool.

**Recommended:** prohibit automated void of records without complete allocation evidence.

## 9. Critical implementation blockers

1. No payment-allocation ledger.
2. One payment may touch multiple installments but stores only one installment ID.
3. Payment execution is browser-side multi-step and non-atomic.
4. Two demo payments lack linked cash entries.
5. No void metadata beyond a boolean.
6. No deterministic replay for later payments.
7. No database authority for recalculating contract outstanding/status.
8. Hard-delete policies can erase financial evidence.
9. Reports/dashboard require coordinated void/debt behavior.
10. Closed-contract reopening rules are unresolved.

## 10. Regression test plan

- Pending/rejected requests mutate no business table.
- Unauthorized, cross-branch, duplicate, unsupported, or already-voided requests fail closed.
- Exact allocation reversal restores every affected installment.
- Later payment/concurrent mutation invalidates stale approval.
- Final-payment void restores outstanding and correct lifecycle.
- Payment and cash entry become logically void exactly once.
- Cash lines and receipt history remain unchanged and queryable.
- Forced failure rolls back payment, cash, installment, contract, approval, and audit.
- Replacement receipt cannot reuse original document number.
- Reports exclude voided cash/payment while debt and arrears are restored exactly once.
- Collections use restored effective installments without deleting prior history.
- Contract-cancel eligibility remains permanently locked after a voided payment.
- Existing approval workflows and Supabase `.from()`, `.rpc()`, auth/session, RLS, and server client paths regress cleanly.

## 11. Rollback boundary

No runtime change is made in this review. Future implementation requires atomic code rollback, forward-only compensating migration, exact executor disable path, preserved financial evidence, allocation reconciliation queries, and demo regression evidence before production.

## 12. Current conclusion

`payment_void` is not ready for implementation. The Impact Review identifies the full dependency surface, primary allocation blocker, and Gates A–K.

Current fail-closed behavior is correct. Next action: business decisions for Gates A–K, followed by a separate implementation impact update and explicit implementation approval.
