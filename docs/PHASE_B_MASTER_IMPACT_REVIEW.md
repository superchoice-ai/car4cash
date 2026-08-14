# Phase B Master Cross-Workflow Impact Review

- **Repository:** `superchoice-ai/tansub`
- **Environment:** Lovable/Supabase demo; not production
- **Active scope:** `contract_cancel`, then `payment_void`
- **Excluded scope:** `restructure` — Deferred / Unsupported / fail-closed
- **Status:** IMPACT REVIEW IN PROGRESS
- **Runtime implementation:** NOT AUTHORIZED / NOT STARTED

## 1. Confirmed business boundary

Phase B contains only two active workflows:

1. `contract_cancel`
2. `payment_void`

`restructure` is skipped. Once at least one payment event exists, principal/loan amount, interest rate, term/installment count, and cancellation/deletion remain locked. Non-debt-bearing information may still be corrected through the normal approval workflow. Account payoff is contract completion, not restructuring.

Presence of `restructure` in an enum, schema, migration, old document, roadmap, or code is not authorization to interpret or implement it.

## 2. Workflow status

| Workflow | Impact Review | Business decision | Implementation |
|---|---|---|---|
| `contract_cancel` | Complete | Core rules confirmed | Not authorized |
| `payment_void` | Dependency review complete | Gates A–K pending | Not authorized |
| `restructure` | Historical record only | Deferred / Unsupported | Prohibited; fail-closed |

## 3. Rules shared by both active workflows

1. Pending and rejected approvals must not mutate any business or related table.
2. Approved mutation, related-table reflection, audit, and approval state change must occur in one database transaction.
3. A voided payment remains permanent evidence that repayment activity occurred.
4. `contract_cancel` is permanently ineligible after any payment event.
5. Original payment, cash, and audit evidence must not be physically deleted.
6. Collection history remains; only future eligibility changes.
7. UI is a request producer, not the authority for financial mutation.
8. Unknown or unsupported state combinations fail closed.

## 4. Shared critical findings

- Payment recording currently uses several sequential browser writes, so payment and cancellation can race or partially complete.
- A manager hard-delete path can erase payment rows, so “ever paid” cannot safely depend only on current payment rows.
- One payment may affect multiple installments, but the database records only one `installment_id`; there is no allocation ledger.
- Reports, dashboards, Payment UI, and collections consume different combinations of contracts, installments, payments, and cashbook data.
- Adding more logic to one large Approval Executor creates regression risk for existing Phase A workflows.

## 5. Active dependency order

### Foundation F0 — Evidence and guardrails

Required before any `contract_cancel` implementation:

1. Permanent evidence that a contract has ever received a payment.
2. Shared database locking so payment and cancellation cannot both succeed from stale state.
3. Prevention of payment hard-delete from reopening cancellation eligibility.
4. Protection against duplicate pending cancellation requests and repeated execution.
5. Exact cancellation audit snapshot and defensive report/collection filters.

F0 full-project evidence review is complete. Decisions and implementation authorization remain pending.

### Workflow W1 — contract_cancel

May be designed for implementation only after F0 decisions are explicitly confirmed and a separate implementation approval is given.

Confirmed outcome after approval:

- contract and loan application become `cancelled`;
- installment schedule is captured in audit and then deleted atomically;
- disbursement, payment/cash evidence, and collection history remain;
- vehicle-book status is not automatically changed;
- future payment and collection work are blocked.

### Foundation F1 — Transactional payment authority

Required before `payment_void`:

1. Record payment, installment allocations, contract balance, cash entry, and cash lines in one database transaction.
2. Store one immutable allocation row for every payment × installment effect.
3. Add idempotency, reconciliation, and legacy-payment classification.
4. Remove physical deletion of financial evidence.

### Workflow W2 — payment_void

May proceed only after F1, Gates A–K, complete allocation evidence, and separate implementation approval. Initial safest scope remains the latest eligible post-ledger payment only.

## 6. Required regression coverage

- Existing Phase A approval and rejection workflows remain unchanged.
- Pending/rejected Phase B requests mutate nothing.
- A payment racing cancellation produces exactly one valid winner.
- A voided or historically deleted payment never restores cancellation eligibility.
- Forced failure rolls back every related mutation and the approval decision.
- Cancelled contracts disappear from active debt/overdue/collection work but remain in history.
- Payment void reverses exact allocations and cash effects once, without deleting the original receipt.
- Supabase `.from()`, `.rpc()`, auth/session, server client, RLS, and Proxy binding regress successfully.

## 7. Demo fixture boundary

Current demo contracts all have payment history, so existing records must not be altered to manufacture eligibility. A dedicated zero-payment demo fixture is required later, only after implementation is authorized.

Payment-void fixtures must use complete allocation evidence; pre-ledger historical payments remain unsupported unless separately reconciled and approved.

## 8. Active Phase B gates

| Gate | Required outcome |
|---|---|
| PB-SCOPE | Only `contract_cancel` and `payment_void`; `restructure` stays fail-closed |
| PB-F0 | Evidence review complete; five guardrail principles confirmed; implementation not authorized |
| PB-W1 | Contract-cancel implementation separately approved and tested |
| PB-F1 | Transactional payment/allocation foundation separately approved and tested |
| PB-W2 | Payment-void Gates A–K resolved; implementation separately approved and tested |
| PB-REG | Full Phase A + active Phase B regression evidence passes |
| PB-PROD | Production topology/data review and explicit cutover approval |
| PB-DEFERRED | `restructure` remains unsupported; no design or implementation |

## 9. Current conclusion

The corrected Phase B plan is:

1. F0 evidence review and five business decisions are complete.
2. Resolve the remaining implementation-plan interpretation gates.
3. Seek separate authorization for CS-0 baseline evidence only.
4. Complete F1 and `payment_void` decisions later, as a separate workflow.
5. Keep `restructure` unsupported and fail-closed.

This document authorizes no code, schema, UI, RPC, RLS, data, fixture, or deployment change.
