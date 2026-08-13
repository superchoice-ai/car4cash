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
