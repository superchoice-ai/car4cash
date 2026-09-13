# Tansub Groups 1–7 Port — Impact Review

## Scope and baseline

- Target repository: `superchoice-ai/car4cash`
- Target baseline: `main` at `14a93ed04f5c8046b9f659b182f5e6f26e08ce6d`
- Working branch: `feat/port-tansub-groups-1-6`
- Method: capability port/adaptation only; no merge or cherry-pick from Tansub history

## Included capabilities

1. Dashboard loan-application wizard.
2. Pagination for reports and report details; print output remains complete.
3. Duplicate-customer protection for national ID and telephone number.
4. Application/contract status cache refresh after approval or rejection.
5. Environment/build-version information on login and application navigation.
6. Bounded Supabase session restoration to prevent a blank screen after OAuth redirect.
7. Inactive-user enforcement at protected-route, session, mutation, RPC, and RLS layers.

## Car4Cash protections

- Car4Cash branding remains `SuperChoice AI` / `SC`.
- Existing `/assistant`, MCP tools, and AI-mode controls are retained.
- OAuth redirect validation continues to use the existing safe `next` handling.
- Group 6 retains its bounded OAuth session restoration; group 7 checks activity only after an authenticated session is available.
- The lazy Supabase Proxy binds callable properties to the real client instance so `rpc()`, `from()`, and other methods retain the internal `this.rest` context.
- No Tansub Supabase project reference is introduced.

## Database impact

Migration files are included for later review and controlled execution only:

- `20260828123000_customer_identity_uniqueness.sql`
- `20260829020000_reflect_rejected_loan_approval.sql`
- `20260906180000_active_user_enforcement.sql`

No migration was run against any database during this port. Preview/production schema and existing RLS/RPC definitions must be reviewed before executing the active-user migration because it intentionally changes shared authorization behavior.

## Validation

- Production build: passed.
- Development build: passed.
- TypeScript check: the ported files introduce no reported errors. The command remains blocked by the pre-existing baseline error in `src/routes/__root.tsx` (`TS2322`, `ErrorRouteComponent` error type mismatch).
- Static scope scan: no Tansub branding or Tansub Supabase project reference found in committed source or migrations.
- Supabase client trace: `@supabase/supabase-js` methods call `this.rest`; the Proxy now matches the verified Tansub binding implementation while retaining Car4Cash preview storage and API-key injection.

## Not performed

- No migration execution or database query.
- No Lovable Agent/AI-to-AI interaction.
- No publish, deploy, PR, merge, n8n change, LINE change, Cloudflare change, or secret change.
