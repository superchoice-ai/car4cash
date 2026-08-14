# Infrastructure / Core Dependency Change Governance

## Purpose
This rule protects production systems that rely on shared infrastructure such as Supabase, authentication, routing, shared clients, RLS, RPC, database access, provider adapters, environment handling, and other cross-cutting dependencies.

## Mandatory rule
Before changing any shared infrastructure or core dependency, DO NOT modify production code immediately.

Required sequence:

1. **System Impact Review**
   - Search the whole repository for direct and indirect consumers.
   - Identify affected pages, APIs, background events, RPCs, auth flows, database writes, shared components, and integrations.
   - Pay special attention to Supabase because it is a core database/runtime dependency.

2. **Impact disclosure before implementation**
   - Clearly state what will change.
   - List affected files/modules/pages/workflows.
   - Describe possible regressions, data risks, transaction/concurrency risks, auth/RLS risks, and rollback implications.
   - Distinguish confirmed impact from possible impact.

3. **Options before risky implementation**
   - If more than one safe solution exists, present alternatives and trade-offs.
   - Prefer the smallest-scope change with the lowest blast radius.
   - Do not replace a stable shared mechanism merely because a local workaround is convenient.

4. **Explicit approval gate**
   - For shared infrastructure/core changes, obtain user approval before implementation when the change can affect multiple pages, workflows, or production data paths.
   - Read-only impact analysis does not require approval.

5. **Implementation discipline**
   - Keep the change atomic and reversible.
   - Do not combine unrelated refactors.
   - Preserve existing business rules unless explicitly approved.

6. **Regression validation**
   - Validate all identified consumers, not only the screen where the original error appeared.
   - For Supabase-related changes, validate at minimum: `.from()`, `.rpc()`, auth/session handling, server-side client, RLS-sensitive paths, and any critical write transaction.
   - Record what was tested and what remains unverified.

7. **Rollback readiness**
   - State the exact rollback boundary before cutover when practical.
   - Never assume database migrations can be safely reversed without dependency analysis.

## Supabase-specific high-risk scope
Treat changes to any of the following as high-impact until proven otherwise:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- authentication middleware/session handling
- generated Supabase types when schema changes affect consumers
- RLS policies
- SECURITY DEFINER functions
- RPC signatures/behavior
- database migrations
- environment/project-ref/backend selection logic
- service-role or secret handling
- shared configuration access used by transactions/events

## Required pre-change summary format
Before implementation, provide a compact summary containing:

- **Change:** what is proposed
- **Reason:** why it is needed
- **Confirmed consumers:** pages/workflows/modules known to use it
- **Possible impact:** realistic regressions
- **Options:** safer alternatives if available
- **Recommended option:** lowest-risk approach
- **Approval required:** Yes/No

## Current lesson recorded
A prior Supabase browser-client infrastructure change introduced a lazy `Proxy` to solve backend/environment initialization concerns. Because repository-wide impact was not fully validated first, RPC behavior later regressed while other database calls appeared normal. This governance rule exists to prevent that class of cross-cutting regression from recurring.


## Critical approval workflow data-mutation rule

This rule applies to customer, loan application, contract, payment, and cash-entry/expense changes.

1. The request producer MUST store proposed changes in `approval_requests.payload` only. It MUST NOT mutate the business record or any related table before approval.
2. While the request is `pending`, all source and related business tables MUST remain unchanged.
3. If the request is `rejected`, no source or related business table may be changed. The rejected request remains as audit evidence.
4. Only the dedicated Approval Executor may apply an approved change.
5. The executor MUST update the source record and every confirmed related/derived table inside one atomic database transaction.
6. If any required mutation, consistency check, or audit write fails, the whole transaction MUST roll back and the request MUST NOT become `approved`.
7. UI code MUST NOT perform multi-table reflection after approval; database-side execution is the authority.
8. Unsupported or incompletely reviewed type/entity/operation combinations MUST fail closed.

### Loan-application debt-impact rule

- A loan application/contract with no payment history may request changes to debt-bearing fields: requested/approved principal, interest rate, and term/installment count, or request cancellation.
- Once the contract has at least one payment event, debt-bearing fields and cancellation/deletion are locked.
- Other non-debt-bearing loan-application fields remain editable through approval because they do not change the debt obligation.
- Contract payoff/closure is normal contract completion, not application editing or deletion.
- A voided payment must not automatically erase the historical fact that repayment activity occurred or reopen locked debt-bearing changes. `payment_void` requires its own approved impact review and executor.

### Mandatory related-table reflection

After approval only, the executor must apply every relationship identified by the workflow-specific impact review. The review must explicitly enumerate authoritative and derived tables, reports, balances, schedules, cashbook entries, notifications, and audit evidence. No generic “update related tables” assumption is acceptable.

### Phase B scope and sequencing gate

The currently confirmed Phase B scope contains only these workflows, processed one at a time:

1. `contract_cancel`
2. `payment_void`

`restructure` is **Deferred / Unsupported** under the current confirmed business rule. Once a contract has any payment event, principal/loan amount, interest rate, and term/installment count remain locked. Its presence in an enum, schema, migration, document, roadmap, or code branch is not authorization to interpret, design, or implement it.

Each active workflow requires a separate recorded full-project impact review and explicit approval before it is added to the Approval Engine. Completing one workflow does not authorize implementation of the next. Unsupported workflows must remain fail-closed.
