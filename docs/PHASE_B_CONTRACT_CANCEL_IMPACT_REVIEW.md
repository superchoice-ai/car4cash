# Phase B Impact Review — contract_cancel

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo environment; not production
- **Review status:** DRAFT — IMPACT REVIEW ONLY
- **Implementation status:** NOT AUTHORIZED / NOT IMPLEMENTED
- **Approval Engine status:** `contract_cancel` remains fail-closed and must not be added until every decision gate in this document is resolved and explicitly approved.
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
| Application | `loan_applications` | Currently becomes `contracted` when contract is created; post-cancel state must be explicitly decided |
| Schedule | `installments` | Existing unpaid schedule must stop appearing as collectible/overdue while audit history remains |
| Payment | `payments` | Historical existence is the cancellation lock; checking only `voided=false` is insufficient |
| Disbursement | `disbursements` | Contract creation normally records loan payout; accounting treatment on cancellation is unresolved |
| Vehicle | `vehicles.book_status` | Currently becomes `received`; whether cancellation returns/releases the book must be decided |
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

## 8. Decision gates requiring explicit business approval

No implementation may start until these are decided:

### Gate A — Meaning of cancellation after disbursement

Choose the business outcome when a disbursement exists but no customer payment has occurred:

- cancellation prohibited after disbursement;
- cancellation allowed only after documented recovery/reversal of disbursement;
- cancellation allowed with a separate receivable/recovery status and workflow.

**Recommended:** do not allow simple cancellation to erase or neutralize a disbursement. Require an explicit recovery/reversal prerequisite.

### Gate B — Application status after contract cancellation

Choose one:

- `cancelled`: application and contract both end;
- return to `approved`: permits creation of a replacement contract;
- keep `contracted` with the cancelled contract retained as history.

**Recommended:** use `cancelled` for true cancellation; a replacement/reissue should be a separately reviewed workflow.

### Gate C — Installment preservation

Choose how cancelled schedules are represented:

- retain installments and exclude them through contract status;
- mark each unpaid installment `waived`;
- introduce a dedicated cancelled schedule state.

**Recommended:** preserve rows for audit and exclude using contract status; do not misuse `waived` without business approval.

### Gate D — Vehicle book status

Decide whether approval:

- changes `book_status` to `returned`;
- keeps `received` until a separate physical handover confirmation;
- introduces a pending-return state/workflow.

**Recommended:** do not mark `returned` until physical/legal return is confirmed.

### Gate E — Existing collection activities

Decide whether to retain them as immutable history while stopping new collection work.

**Recommended:** retain history; exclude the cancelled contract from new overdue and collection queues.

## 9. Recommended lowest-risk design

Subject to the decision gates:

1. UI creates a `contract_cancel` approval request only.
2. A dedicated SECURITY DEFINER executor performs approval-time validation.
3. No physical deletion of contract, installments, disbursement, payment, cashbook, collection, or audit records.
4. Contract becomes `cancelled` only after all financial/disbursement prerequisites pass.
5. Application, vehicle-book, schedule, collection, reporting, and notification effects are explicit—not inferred.
6. Historical payment existence permanently blocks cancellation.
7. One atomic transaction applies the complete approved state.
8. Unsupported state combinations remain fail-closed.

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
- Historical contract, installment, disbursement, cashbook, and collection evidence remains queryable.
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

## 11. Rollback boundary

Because no runtime implementation exists in this review, current rollback is documentation-only.

For future implementation, rollback must be designed before migration:

- application code rollback commit;
- forward-only compensating migration rather than destructive migration reversal;
- executor whitelist removal/disable path;
- preservation of approval and audit evidence;
- reconciliation query for any partially processed demo records;
- no production cutover until demo regression evidence passes.

## 12. Current conclusion

`contract_cancel` is **not ready for implementation** because the treatment of disbursement, application status, installment preservation, and vehicle-book return is unresolved. The current Phase A fail-closed behavior is correct and must remain in place.

The next authorized action is business review and decision on Gates A–E. Only after those decisions are recorded may an implementation impact update and explicit implementation approval be requested.
