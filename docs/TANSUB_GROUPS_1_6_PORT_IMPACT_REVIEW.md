# Tansub Groups 1–6 Port — Impact Review

## Scope and baseline

- Target repository: `superchoice-ai/car4cash`
- Target baseline: `main` at `14a93ed04f5c8046b9f659b182f5e6f26e08ce6d`
- Working branch: `feat/port-tansub-groups-1-6`
- Method: capability port/adaptation only; no merge or cherry-pick from Tansub history
- Group 7 (inactive-user enforcement) is explicitly deferred and absent from this branch

## Included capabilities

1. Dashboard loan-application wizard.
2. Pagination for reports and report details; print output remains complete.
3. Duplicate-customer protection for national ID and telephone number.
4. Application/contract status cache refresh after approval or rejection.
5. Environment/build-version information on login and application navigation.
6. Bounded Supabase session restoration to prevent a blank screen after OAuth redirect.

## Car4Cash protections

- Car4Cash branding remains `SuperChoice AI` / `SC`.
- Existing `/assistant`, MCP tools, and AI-mode controls are retained.
- OAuth redirect validation continues to use the existing safe `next` handling.
- Group 6 does not call `is_current_user_active` and has no dependency on group 7.
- No Tansub Supabase project reference is introduced.

## Database impact

Migration files are included for later review and controlled execution only:

- `20260828123000_customer_identity_uniqueness.sql`
- `20260829020000_reflect_rejected_loan_approval.sql`

Neither migration was run against any database during this port. Preview/production database compatibility must be verified before a later migration execution. The inactive-user/RLS migration is not included.

## Validation

- Production build: passed.
- Development build: passed.
- TypeScript check: the ported files introduce no reported errors. The command remains blocked by the pre-existing baseline error in `src/routes/__root.tsx` (`TS2322`, `ErrorRouteComponent` error type mismatch).
- Static scope scan: no inactive-user RPC/helpers/migration, Tansub branding, or Tansub Supabase project reference found in committed source or migrations.

## Not performed

- No migration execution or database query.
- No Lovable Agent/AI-to-AI interaction.
- No publish, deploy, PR, merge, n8n change, LINE change, Cloudflare change, or secret change.
