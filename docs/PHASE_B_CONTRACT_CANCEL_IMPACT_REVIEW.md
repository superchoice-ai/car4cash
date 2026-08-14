# Phase B Impact Review — contract_cancel

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo environment; not production
- **Review status:** IMPACT REVIEW COMPLETE — BUSINESS DECISIONS RECORDED
- **Implementation status:** NOT AUTHORIZED / NOT IMPLEMENTED
- **Approval Engine status:** `contract_cancel` remains fail-closed. Impact decisions are complete; runtime implementation still requires a separate explicit approval.
- **Sequence:** This review covers `contract_cancel` only. It does not authorize `restructure` or `payment_void`.

## 1. Requested outcome

Add a future approval workflow for cancelling a created loan contract, subject to these confirmed business rules:

1. A contract may be considered for cancellation only when it has never had a payment event.
2. Once at least one payment has been received for that contract, cancellation/deletion and debt-bearing changes are permanently locked.
3. A later payment void must not automatically erase the historical fact that a payment event occurred.
4. Normal payoff/closure is contract completion (`closed`), not cancellation, editing, or deletion.
5. No source or related business data may change while approval is `pending` or when it is `rejected`.
6. Only after approval may a dedicated database executor update the contract and all confirmed related data atomically.
7. Any failed required mutation or audit write must roll back the whole transaction and must not mark the request `approved`.

## 2. Scope boundary

### In scope for impact review

- `approval_requests.type = contract_cancel`
- Contract cancellation request producer in UI
- Approval screen detail/read model
- Dedicated database executor branch
- Contract and application lifecycle
- Installment schedule
- Disbursement record
- Vehicle registration-book status
- Payments and historical payment-event gate
- Cashbook links
- Collection activities and overdue screen
- Reports and dashboards
- Notifications and audit logs
- RLS/role and branch scope
- Regression and rollback design

### Out of scope

- Implementing migrations, RPC changes, UI buttons, or production data writes
- `restructure`
- `payment_void`
- Permission/role redesign beyond identifying dependencies
- Physical deletion of financial or audit records

## 3. Current implementation evidence

### Existing schema

- `approval_type` already contains `contract_cancel`.
- `contract_status` contains `cancelled`.
- Contracts reference applications, customers, and vehicles.
- Installments reference contracts with `ON DELETE CASCADE`.
- Payments reference contracts with `ON DELETE CASCADE` and contain `voided`.
- Disbursements reference contracts with `ON DELETE CASCADE`.
- Collection activities reference contracts with `ON DELETE CASCADE`.
- Cash entries may reference both `contract_id` and `payment_id`.
- The current Phase A executor explicitly rejects `contract_cancel` as unsupported.

### Current contract creation transaction is not atomic

The current UI creates and updates these records sequentially:

1. Insert `contracts`.
2. Insert `installments`.
3. Insert `disbursements`.
4. Update `loan_applications.status = contracted`.
5. Update `vehicles.book_status = received`.

This is a critical dependency chain for cancellation. Cancellation cannot safely update only `contracts.status`.

### Existing application-cancel logic is not the Phase B contract-cancel rule

Current Phase A application cancellation checks for contracts whose status is not `closed`. This does not express the confirmed rule “no payment event has ever occurred.” It must not be reused as the `contract_cancel` executor without a separate correction and regression review.

## 4. Confirmed dependency and consumer trace

| Area | Object/consumer | Confirmed impact |
|---|---|---|
| Approval | `approval_requests` | Store request and proposed operation only; no early mutation |
| Approval | `execute_approval_request()` | Needs an exact fail-closed whitelist branch only after approval |
| Contract | `contracts` | Logical state transition to `cancelled`; never physical delete |
| Application | `loan_applications` | After approved cancellation, status becomes `cancelled` |
| Schedule | `installments` | After approved cancellation, snapshot the schedule to audit evidence, then delete installment rows to prevent growth and remove them from active queues |
| Payment | `payments` | Historical existence is the cancellation lock; checking only `voided=false` is insufficient |
| Disbursement | `disbursements` | Preserve the payout record as historical fact; recovery is an employee/organization process outside this workflow |
| Vehicle | `vehicles.book_status` | Do not mark returned automatically; retain current status until a separate real-world return confirmation |
| Cashbook | `cash_entries` | May reference contract/payment; cancellation must not silently void real money movement |
| Collection | `collection_activities` and overdue UI | Cancelled contracts/installments must not continue in active collection queues |
| Reports | `src/lib/reports.ts` | Outstanding/debtor/overdue/closed reports filter by status and installment state |
| Dashboard/finance | contract/cash queries | Cancelled contracts must not inflate active debt, but historical financial entries must remain |
| Notifications | `notifications` | Request, approval, rejection, and cancellation outcomes require defined events |
| Audit | `audit_logs` | Must record before/after, reason, actor, approval ID, and every affected object |
| UI | contracts/applications/approvals | Request button, eligibility message, pending state, decision detail, and final state |
| Security | RLS, branch access, roles | Requester and approver must be branch-authorized; executor remains database-authoritative |

## 5. Proposed eligibility gate

A `contract_cancel` request should fail closed unless all conditions pass at both request time and approval time:

1. Contract exists and is in an explicitly cancellable state.
2. Contract is not `closed` and is not already `cancelled`.
3. No payment row has ever existed for the contract, including a row later marked `voided=true`.
4. No other pending `contract_cancel` request exists for the contract.
5. Requester can access the contract branch.
6. Approver can approve within the contract branch.
7. The payload identifies the exact contract and contains a mandatory cancellation reason.
8. All expected related records still match the reviewed preconditions when the approver decides.

The payment-history gate must use historical existence, not only active payment totals. A separate immutable payment-event indicator or equivalent audit-safe evidence may be required; this is not yet designed.

## 6. Pending/rejected/approved behavior

### Pending

- Insert only an `approval_requests` row.
- Do not change contract, application, installment, disbursement, vehicle, cashbook, collection, report data, or balances.
- UI may display “รออนุมัติยกเลิกสัญญา” as presentation state derived from the pending request, not by changing the contract.

### Rejected

- Set only the approval decision fields and write rejection audit evidence.
- Do not mutate any business table.
- Contract continues unchanged.

### Approved

- Lock approval request, contract, and eligibility evidence.
- Re-run every eligibility check.
- Apply all approved related changes inside one database transaction.
- Write complete audit evidence.
- Mark approval `approved` only after every business mutation and audit write succeeds.
- Roll back everything on any failure.

## 7. Data-integrity risks

1. **Disbursement risk:** a contract may have already paid money to the customer even though no installment payment has been received. Cancelling without accounting treatment can hide a real receivable/cash movement.
2. **Installment risk:** leaving unpaid installments active causes cancelled contracts to remain overdue; deleting them destroys audit history.
3. **Application-state risk:** setting the application back to `approved`, to `cancelled`, or retaining `contracted` produces different operational meanings.
4. **Vehicle-book risk:** automatically returning the book may be legally/operationally incorrect if payout recovery is unresolved.
5. **Payment-history loophole:** counting only non-void payments lets a void reopen cancellation, contrary to the confirmed rule.
6. **Report risk:** cancelled contracts may still appear in totals if reports use broad status queries.
7. **Concurrency risk:** a payment could be inserted between eligibility check and approval unless rows/constraints are coordinated.
8. **Duplicate-request risk:** multiple pending cancellations could race.
9. **Direct-update risk:** current broad update policies may allow state changes outside the executor; permission hardening remains a production gate.
10. **Partial-update risk:** client-side multi-step mutation could leave contradictory states; implementation must be database-transactional.

## 8. Resolved business decision gates

The following decisions are confirmed for the implementation design:

### Gate A — Disbursement responsibility

**Resolved:** Contract cancellation does not reverse, delete, recover, or otherwise manage the disbursed money. Recovery is the responsibility of employees/organization. The existing `disbursements` row remains as historical evidence.

### Gate B — Application status

**Resolved:** On approved cancellation, both `contracts.status` and `loan_applications.status` become `cancelled`.

Repeated future applications and cancellations should be accumulated as a risk signal. They must not automatically blacklist a customer; a separately reviewed human decision may classify repeated suspicious behavior as blacklist.

### Gate C — Installment treatment and storage growth

**Resolved:** After approval only, capture the original schedule in audit evidence and delete the contract's `installments` rows inside the same transaction. This removes non-operative schedules and controls growth in one of the largest tables.

For debt-bearing edits made before any payment event, replace the schedule atomically: snapshot/delete the old installments and generate the complete new schedule. `cash_entries` and `cash_entry_lines` are not deleted by contract cancellation. If any payment or payment-linked cash entry exists, cancellation fails closed.

### Gate D — Vehicle registration book

**Resolved:** Contract cancellation does not automatically set `vehicles.book_status = returned`. Physical return is outside this executor and should later use a separate confirmation workflow. Until confirmed, the existing status remains.

### Gate E — Collection history and future work

**Resolved best practice:** Preserve all existing `collection_activities` as immutable operational history. After approved cancellation, new collection activities must be rejected for the cancelled contract, and collection/overdue queries must include only collectible contract statuses. Deleting installments removes the cancelled schedule from current overdue queues; contract status remains an additional defensive filter.

## 9. Recommended lowest-risk design

Subject to the decision gates:

1. UI creates a `contract_cancel` approval request only.
2. A dedicated SECURITY DEFINER executor performs approval-time validation.
3. Never physically delete contracts, disbursements, payments, cashbook, collection, or audit records. Installments are the approved exception: snapshot them to audit evidence, then delete them atomically after cancellation approval.
4. Contract and linked application become `cancelled`; disbursement history remains unchanged because recovery is outside this workflow.
5. Delete installments only after the audit snapshot succeeds. Keep the vehicle-book status unchanged until a separate physical-return confirmation.
6. Historical payment existence—including voided rows or payment-linked cash entries—permanently blocks cancellation.
7. Retain collection history, block new collection work, and exclude cancelled contracts defensively in collection/overdue queries.
8. One atomic transaction applies the complete approved state; unsupported combinations remain fail-closed.

## 10. Regression test plan

### Eligibility

- Contract with zero payment history can submit a request when all other prerequisites pass.
- Contract with one active payment cannot submit or approve cancellation.
- Contract with one voided payment still cannot submit or approve cancellation.
- Closed contract cannot be cancelled.
- Already-cancelled contract cannot be cancelled again.
- Duplicate pending request is rejected.
- Cross-branch requester/approver is rejected.

### Mutation timing

- Pending request changes no business table.
- Rejected request changes no business table.
- Approved request changes exactly the approved related objects.
- Forced failure in any related mutation rolls back contract state and approval state.

### Consumers

- Cancelled contract is absent from active debtor and overdue reports.
- Cancelled installments are absent from collection queues.
- Historical contract, disbursement, cashbook, and collection evidence remains queryable; deleted installment details are preserved in the approval/audit schedule snapshot.
- Contract detail and print history remain available and visibly cancelled.
- Dashboard totals exclude cancelled debt without deleting actual financial movement.
- Notifications and audit logs identify requester, approver, reason, timestamp, before/after, and affected objects.

### Existing workflow regression

- Loan approval still executes.
- Customer edit/deactivate still executes.
- Application edit continues to lock only debt-bearing fields after payment history.
- Non-debt-bearing application edits remain allowed through approval.
- Cash-entry logical void still executes.
- Rejection behavior remains mutation-free.
- Supabase `.from()`, `.rpc()`, auth/session, RLS, and server client paths remain operational.

## 11. Demo database evidence

Read-only inspection of the current Lovable/Supabase demo database found:

- 34 contracts: 14 active, 4 closed, and 16 overdue.
- All 34 contracts already have at least one payment row; none is eligible for `contract_cancel` testing.
- All 34 contracts have disbursement records.
- 768 installment rows and no orphan installments.
- 319 cash entries; 312 are payment-linked, with no contract-income cash entry lacking a payment link.
- 16 collection activities and none belongs to a cancelled contract.

A dedicated demo fixture is therefore mandatory: create a reviewed test application/contract with installments and disbursement but no payment event. Existing demo contracts must not be altered merely to manufacture eligibility.

## 12. Rollback boundary

Because no runtime implementation exists in this review, current rollback is documentation-only.

For future implementation, rollback must be designed before migration:

- application code rollback commit;
- forward-only compensating migration rather than destructive migration reversal;
- executor whitelist removal/disable path;
- preservation of approval and audit evidence;
- reconciliation query for any partially processed demo records;
- no production cutover until demo regression evidence passes.

## 13. Current conclusion

The `contract_cancel` Impact Review is complete and Gates A–E are resolved. The current Phase A fail-closed behavior remains correct until implementation is explicitly authorized.

The next gate is a separate implementation approval covering the exact migration/RPC, UI producer, collection guards, report filters, demo fixture, and regression execution. This document does not itself authorize those runtime changes.
