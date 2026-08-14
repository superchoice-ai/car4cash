# Phase B Master Cross-Workflow Impact Review

- **Repository:** `superchoice-ai/tansub`
- **Environment:** Lovable/Supabase demo; not production
- **Scope:** `contract_cancel`, `restructure`, `payment_void`
- **Status:** CROSS-WORKFLOW IMPACT REVIEW COMPLETE
- **Runtime implementation:** NOT AUTHORIZED / NOT STARTED

## 1. Purpose

This document consolidates the three workflow-specific Impact Reviews and identifies shared dependencies that must be solved once, consistently, before any workflow is added to the Approval Engine.

It does not replace the detailed workflow reviews and does not authorize code, schema, UI, RPC, RLS, data, or deployment changes.

## 2. Workflow status

| Workflow | Impact Review | Business decisions | Implementation |
|---|---|---|---|
| `contract_cancel` | Complete | Gates A–E resolved | Not authorized |
| `restructure` | Complete dependency review | Gates A–K pending | Not authorized |
| `payment_void` | Complete dependency review | Gates A–K pending | Not authorized |

All three remain fail-closed in the current Approval Executor.

## 3. Shared critical findings

### 3.1 Browser-side financial transactions

Payment currently updates installments, payment, contract, cash entry, and cash lines through sequential browser calls. This is a shared blocker for restructure and payment void and a concurrency risk for contract cancellation.

### 3.2 Missing payment-allocation ledger

One payment can affect multiple installments but stores only one installment ID. Exact reversal and deterministic historical reconstruction are impossible without allocation evidence.

### 3.3 Missing schedule versioning

Restructure requires preservation of paid history and a new effective future schedule. Current installments have no schedule version or superseded state.

### 3.4 Mutable/deletable financial evidence

Current policies permit financial records to be updated or hard-deleted outside a dedicated executor. A deleted payment could incorrectly create contract-cancel eligibility.

### 3.5 Shared Approval Executor blast radius

Continuing to place all business logic inside one large `execute_approval_request()` increases regression risk for existing approvals. Shared authorization and decision handling must not become a monolithic financial mutation function.

### 3.6 Reports consume mixed authorities

Reports and dashboards use contract outstanding, installments, payments, and cashbook. Every workflow must preserve a single effective source for each metric and avoid double counting historical and current states.

## 4. Authoritative data responsibilities

| Data concern | Authority |
|---|---|
| Approval status/decision | Approval Engine |
| Workflow eligibility and mutation | Dedicated workflow executor |
| Current debt outstanding | Effective installment schedule/database calculation |
| Payment history | Immutable payment + allocation ledger |
| Cash movement | Payment-linked cash entry and lines |
| Original contract/application | Immutable historical terms plus lifecycle state |
| Restructured terms | Versioned amendment and effective schedule |
| Collection queue | Effective collectible schedule and contract status |
| Audit evidence | Append-only audit with before/after and approval reference |

UI state is never the financial authority.

## 5. Recommended architecture boundary

### Approval Engine

- Authenticate and authorize the decision.
- Lock and validate the pending approval.
- Dispatch only an explicitly supported type/entity/operation.
- Receive success/failure from the dedicated executor.
- Mark approved only after the executor and audit succeed.
- Remain fail-closed for unsupported combinations.

### Dedicated executors

- `execute_contract_cancel(...)`
- `execute_restructure(...)`
- `execute_payment_void(...)`

Each executor owns its eligibility, locks, mutation, audit payload, idempotency, and transaction behavior. Exact function names are design recommendations, not implementation authorization.

### Shared financial foundation

- transactional payment recording;
- payment-allocation ledger;
- immutable payment-event evidence;
- contract/schedule concurrency version;
- schedule version/effective-state model;
- reconciliation queries;
- append-only workflow audit.

## 6. Dependency order

### Foundation F0 — Evidence and guardrails

Required before `contract_cancel`:

1. Prevent hard deletion from erasing payment-event evidence.
2. Add duplicate-pending/idempotency protection.
3. Define exact workflow audit payload.
4. Add approval-time contract/payment concurrency validation.
5. Add report/collection defensive status filters.

### Workflow W1 — contract_cancel

May proceed only after separate implementation approval and F0. It does not require historical allocation reversal because any payment event makes the contract ineligible.

### Foundation F1 — Transactional payment authority

Required before `restructure` or `payment_void`:

1. Move payment recording into one database transaction.
2. Create payment-allocation rows for every affected installment.
3. Recalculate outstanding/status from authoritative schedule state.
4. Add idempotency and reconciliation evidence.
5. Keep legacy/pre-ledger payments explicitly classified.

### Foundation F2 — Schedule versioning

Required before `restructure`:

1. Contract amendment/restructure record.
2. Schedule version and effective/superseded semantics.
3. Report, payment, collection, and dashboard selection of effective schedule.
4. Original contract and paid schedule preservation.

### Workflow W2 — restructure

May proceed only after Gates A–K, F1, F2, and separate implementation approval.

### Workflow W3 — payment_void

May proceed only after Gates A–K, F1, allocation evidence, and separate implementation approval. Initial scope should be latest eligible post-ledger payment unless later-payment replay is separately proven.

## 7. Cross-workflow invariants

1. Pending and rejected approvals never mutate business data.
2. Approved mutation and approval state change occur atomically.
3. A voided payment remains evidence that repayment activity occurred.
4. `contract_cancel` never becomes eligible after any payment event.
5. Ordinary debt-bearing edits remain locked after first payment; restructure is the only separately approved exception.
6. Restructure never rewrites payment/cash history or paid installment history.
7. Payment void never deletes the original receipt/cash evidence.
8. Contract payoff is closure, not cancellation or restructuring.
9. Collection history remains; only future queue eligibility changes.
10. Any unknown state combination fails closed.

## 8. Shared regression suite

### Approval regression

- Existing loan approval, customer edit/deactivate, application edit/cancel, rejection, and cash-entry void remain functional.
- Unsupported Phase B type still fails closed until its exact gate is opened.
- Duplicate or replayed approval cannot execute twice.

### Data integrity

- Contract outstanding equals effective schedule remaining balance.
- Payment allocations sum to payment debt amount.
- Payment-linked cash entry/lines reconcile to receipt categories.
- Historical and current schedules are not double counted.
- Forced failure leaves no partial mutation.

### Timing/concurrency

- Payment racing cancellation invalidates cancellation eligibility.
- Payment racing restructure invalidates a stale cut-off.
- Later payment blocks unsafe earlier-payment void.
- Row locks/version checks prevent lost updates.

### Consumers

- Payment UI uses only effective open installments.
- Collections use only effective collectible schedules.
- Reports/dashboard distinguish debt state from historical cash movement.
- Contract and receipt prints display lifecycle/void/amendment state.
- Branch/RLS and server/browser Supabase paths remain correct.

### Infrastructure regression

- Supabase `.from()`, `.rpc()`, auth/session, server client, RLS, and Proxy method binding are tested.
- No shared-client or environment change is accepted without whole-project consumer validation.

## 9. Demo fixture plan

Do not repurpose current demo records.

Create isolated reviewed fixtures only after implementation authorization:

1. Contract with no payment for `contract_cancel`.
2. Active contract with paid and future installments for `restructure`.
3. Overdue contract with paid and future installments for restructure/collection tests.
4. Post-ledger contract with one latest payment for `payment_void`.
5. Closed contract whose final payment can test controlled reopening.
6. Failure-injection fixture for transaction rollback.

Fixtures must be clearly marked demo/test and excluded from normal business reporting.

## 10. Rollback boundaries

- Keep each foundation and workflow in separate atomic commits/migrations.
- Do not combine F0, F1, F2, and workflow executors into one cutover.
- Use forward-only compensating migrations for financial schema.
- Preserve approval, payment, cash, schedule, and audit history.
- Maintain an exact executor-disable path for each workflow.
- Require reconciliation queries before and after every demo migration.

## 11. Phase B gates

| Gate | Required outcome |
|---|---|
| PB-IR | Three individual reviews plus this master review recorded |
| PB-BR | Business decisions complete per workflow |
| PB-F0 | Evidence/guardrail design approved and tested |
| PB-W1 | Contract-cancel implementation separately approved |
| PB-F1 | Transactional payment/allocation foundation approved and tested |
| PB-F2 | Schedule-version foundation approved and tested |
| PB-W2 | Restructure implementation separately approved |
| PB-W3 | Payment-void implementation separately approved |
| PB-REG | Full Phase A + Phase B regression evidence passes |
| PB-PROD | Production data/topology review and explicit cutover approval |

## 12. Current conclusion

Phase B Impact Review is complete at both workflow and cross-workflow levels. Runtime implementation must not begin as a single combined change.

The next decision path is:

1. Approve exact F0 impact and implementation scope.
2. Implement/test `contract_cancel` separately.
3. Resolve `restructure` Gates A–K.
4. Resolve `payment_void` Gates A–K.
5. Approve and build F1/F2 foundations separately before W2/W3.

No step authorizes the next step automatically.
