# Phase B Impact Review — restructure

- **Repository:** `superchoice-ai/tansub`
- **Environment reviewed:** Lovable/Supabase demo environment; not production
- **Review status:** DRAFT — IMPACT REVIEW ONLY
- **Implementation status:** NOT AUTHORIZED / NOT IMPLEMENTED
- **Approval Engine status:** `restructure` remains fail-closed until every decision gate is resolved and explicitly approved.
- **Sequence:** This review covers `restructure` only and does not authorize `payment_void`.

## 1. Meaning and boundary

`restructure` is a special approved debt-restructuring workflow for an existing contract after repayment activity. It is not ordinary loan-application editing.

- After at least one payment event, requested/approved principal, interest rate, and term are locked for ordinary editing.
- Non-debt-bearing application fields remain editable through the existing approval workflow.
- Restructure may change future debt terms only under its own approved rules, schedule versioning, and atomic executor.
- Previously received payments and satisfied obligations must never be rewritten.

## 2. Current system evidence

- `approval_type` already contains `restructure`, but the Phase A executor explicitly rejects it.
- Contracts store principal, interest, term, installment, total payable, outstanding, dates, and status.
- Installments store contractual principal/interest, paid amount, penalty, paid date, and status.
- Payments and cashbook preserve actual receipt/accounting history.
- The current calculation uses a monthly flat rate from principal.
- Restructure cannot reuse that formula until the new principal base and treatment of accrued interest, penalties, and fees are defined.

### Current payment transaction risk

The browser currently performs sequential operations:

1. Update installments.
2. Insert payment.
3. Update contract outstanding/status.
4. Insert cash entry.
5. Insert cash-entry lines.

These are not one database transaction. Restructure requires a trusted cut-off balance and must not race or partially complete against payment processing.

## 3. Demo database evidence

- 34 contracts: 14 active, 4 closed, and 16 overdue.
- 314 payment rows covering all 34 contracts; no voided payments.
- Contract outstanding equals remaining installment totals for all contracts at inspection time.
- No contract has payments but no paid/partial installment.
- Active outstanding: 106,366,620 satang.
- Overdue outstanding: 220,388,766 satang.
- Closed outstanding: 0.

A dedicated reviewed fixture is required. Existing demo contracts must not be modified merely for testing.

## 4. Confirmed dependency trace

| Area | Object/consumer | Impact |
|---|---|---|
| Approval | `approval_requests` | Proposed terms, cut-off, reason, and evidence only |
| Executor | `execute_approval_request()` | Dedicated exact whitelist branch |
| Contract | `contracts` | Future terms, outstanding, installment, dates, lifecycle |
| Application | `loan_applications` | Original application must not be silently rewritten |
| Schedule | `installments` | Paid history preserved; future schedule versioned |
| Payments | `payments` | Immutable history and allocations unchanged |
| Cashbook | `cash_entries`, `cash_entry_lines` | Historical money movement unchanged |
| Collections | installments and `collection_activities` | Use only effective schedule |
| Reports/dashboard | debt, overdue, NPL | Avoid double-counting old/new schedules |
| Documents | contract print | Separate amendment; preserve original |
| Audit/notifications | logs and events | Complete before/after/version evidence |
| Concurrency | payment workflow | Payment and restructure cannot race |

## 5. Non-negotiable mutation rules

### Pending

- Insert only the approval request and evidence.
- Do not change debt or related tables.
- A pending badge is presentation only.

### Rejected

- Record rejection and audit only.
- Continue the existing contract unchanged.

### Approved

- Lock approval and contract.
- Recalculate the cut-off inside the transaction; never trust UI totals.
- Revalidate state, payments, balance, schedule, and concurrency version.
- Preserve all payment and cash history.
- Apply amendment and effective schedule atomically.
- Mark approved only after every mutation and audit write succeeds.
- Roll back everything on failure.

## 6. Best-practice data direction

Do not overwrite the original contract and paid schedule without version evidence.

1. Create a restructure/amendment record linked to contract and approval.
2. Store version, effective date, cut-off, reason, inputs, original balance, calculation, requester, and approver.
3. Preserve paid/partial installment history.
4. Supersede only unpaid future schedule rows explicitly.
5. Create a new effective future schedule version.
6. Keep payments and cashbook unchanged.
7. Reports select the effective schedule while retaining history.

The current schema has no amendment or schedule-version structure. Reusing pre-payment delete/recreate logic would destroy post-payment history and is prohibited.

## 7. Critical decision gates

### Gate A — Eligible contract states

Choose active only, active+overdue, or active+overdue+defaulted; closed/cancelled should be prohibited.

### Gate B — Trigger and authority

Define requester, approver level, hardship evidence, and any delinquency minimum.

### Gate C — Authoritative restructure principal

Choose contract outstanding, unpaid principal, unpaid principal plus accrued interest, approved penalties/fees, or another settlement amount.

**Critical:** current outstanding reduces by total payment while payments separately allocate principal, interest, and penalty; outstanding may not equal unpaid principal.

### Gate D — Accrued items

For interest, penalties, collection fees, insurance, registration, and other fees, specify capitalize, collect, waive, defer, or exclude.

### Gate E — New interest calculation

Define method, rate period/source, special-rate authority, rounding, and final installment.

### Gate F — New term and dates

Define permitted terms, first due date, maximum extension, and effective date.

### Gate G — Historical installments

Recommended: retain paid/partial history, supersede remaining old rows, create a versioned new schedule; never delete all installments after payments.

### Gate H — Lifecycle and repeat restructuring

Recommended: keep application `contracted`, retain one contract identity, and add numbered restructure amendments/current effective schedule.

### Gate I — Payment concurrency while pending

Recommended: continue payments, but reject stale approval if balance/schedule version changed; require resubmission rather than silent recalculation.

### Gate J — Collections and promises

Recommended: retain history, stop using superseded installments, and generate work only from the effective schedule.

### Gate K — Documentation

Define amendment form, signatures, number, and legal text; preserve original contract print unchanged.

## 8. Critical implementation blockers

1. No restructure/amendment table or schedule-version model.
2. Payment mutation is browser-side multi-step and non-atomic.
3. No shared database calculation authority for payment allocation/outstanding.
4. `outstanding` alone may be an insufficient principal basis.
5. Installment enum has no `superseded` state.
6. Reports read installments without schedule version.
7. Overdue dashboard does not defensively filter contract lifecycle.
8. Broad update/delete policies can bypass financial executors.
9. No optimistic contract/schedule version exists.
10. No restructure amendment template exists.

## 9. Regression test plan

- Pending/rejected mutate no business table.
- Unauthorized, cross-branch, duplicate, or unsupported request fails closed.
- Payment after submission invalidates a stale approval.
- Concurrent payment/approval cannot partially update debt.
- Forced failure rolls back amendment, contract, schedule, approval, and audit.
- Payments, cash entries, paid installments, original terms, and documents remain unchanged.
- New schedule is versioned and sums exactly to the approved obligation.
- Contract outstanding equals the effective schedule balance.
- Payment UI, collections, reports, dashboard, and NPL use only the effective schedule.
- Existing approvals and Supabase `.from()`, `.rpc()`, auth/session, RLS, and server client paths regress cleanly.

## 10. Rollback boundary

No runtime change is made in this review. Future implementation requires atomic code rollback, forward-only compensating migration, exact executor disable path, preserved history, reconciliation queries, and demo evidence before production.

## 11. Current conclusion

`restructure` is not ready for implementation. The dependency surface and Gates A–K are recorded. Current fail-closed behavior is correct.

Next action: business decisions for Gates A–K, followed by a separate implementation impact update and explicit implementation approval.
