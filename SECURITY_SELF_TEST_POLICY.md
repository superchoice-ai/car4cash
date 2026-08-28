# SuperChoice AI — Authorized Self-Security Testing Policy

**Status:** Mandatory governance  
**Effective:** 2026-08-24  
**Applies to:** This repository, its preview/demo/UAT environments, APIs, databases, automations, integrations, and future production deployments.

## 1. Purpose

SuperChoice AI must periodically and unpredictably test its own systems from an external user's point of view so exploitable paths are found and closed before they are abused. Testing is defensive, evidence-driven, and limited to assets owned by or explicitly authorized for SuperChoice AI.

This policy does not authorize testing third-party systems, unrelated websites, customer infrastructure, or production data without written scope approval.

## 2. Mandatory security checks

Security reviews must include relevant checks for:

- Lazy or hidden JavaScript behavior, including `Proxy`, monkey-patching, runtime method rebinding, dynamic imports, obfuscated loaders, unsafe `eval`, and code that silently changes SDK behavior.
- Supabase client and proxy implementations, project-ID guards, environment switching, hardcoded backend identifiers, SSR/client credential separation, and accidental service-role exposure.
- PostgREST/RPC functions, especially `SECURITY DEFINER`, ownership, `search_path`, default PUBLIC grants, function overloads, and direct calls through `/rest/v1/rpc/<function>`.
- Supabase `anon`/publishable access, RLS coverage, table/view permissions, storage policies, Edge Functions, database webhooks, and API Gateway behavior.
- External HTTP calls using Postman or an equivalent independent client to prove the actual network path, authorization boundary, status code, response, timestamp, and region.
- Authentication and authorization flows, including Google, LINE, OAuth callbacks, JWT handling, branch/tenant isolation, privilege escalation, IDOR, replay, CSRF, CORS, and session invalidation.
- Public routes, server routes, webhooks, MCP endpoints, n8n workflows, Cloudflare Workers, third-party connectors, file upload/download paths, and secret masking.
- Dependency, supply-chain, build-script, GitHub Actions, lockfile, package, secret-leak, and configuration drift risks.
- Input validation and injection risks across SQL, JSON, headers, URLs, templates, file names, and AI/tool prompts.
- Business-logic abuse of approvals, payments, cancellations, publishing, notifications, and other high-impact operations.

The checklist is a baseline, not a ceiling. New attack patterns must be added when discovered.

## 3. Randomized self-test program

- Run a focused security check before merge/deploy when authentication, permissions, proxies, RPCs, secrets, integrations, or financial/business mutations change.
- Run periodic randomized checks so the tested component, time, route, identity, and technique are not always predictable.
- Rotate between source review, configuration review, dependency scanning, permission inspection, and external black-box verification.
- Use synthetic identifiers and dedicated fixtures. Prefer read-only requests and guaranteed nonexistent UUIDs.
- Start with `anon` or least privilege. Test authenticated roles only with dedicated test accounts.
- A test that unexpectedly reaches internal business logic is a confirmed authorization finding even if the fixture prevents data mutation.

## 4. Safety boundaries

- Confirm asset ownership, environment, endpoint, test identity, and allowed actions before execution.
- Default to demo/UAT. Production requires an explicit readiness gate, owner approval, rollback plan, monitoring, and a narrowly bounded test.
- Never use real customer identifiers when synthetic data can prove the condition.
- Do not delete, corrupt, exfiltrate, publish, charge, message third parties, or create irreversible side effects.
- Do not bypass provider safeguards, expand scope, persist credentials unnecessarily, or leave temporary monitors, collections, environments, fixtures, tokens, or accounts behind.
- Stop immediately if scope is uncertain, unexpected data appears, service health degrades, or a write could affect real records.
- Secrets must be masked in evidence and deleted from temporary testing tools immediately after use.

## 5. Evidence standard

Every executed check must record:

- Repository, branch/commit, environment, date/time with timezone, tester/tool, and authorization scope.
- Exact route or component tested; redact secrets but retain key type and role.
- Request method, sanitized headers/body, external origin or runner region, HTTP status, response time, and sanitized response.
- Expected versus actual authorization boundary and whether internal logic was reached.
- Data-change verification before and after the test.
- Finding severity, affected functions/resources, containment decision, remediation owner, and retest result.
- Cleanup evidence for credentials, Postman artifacts, fixtures, temporary accounts, and monitors.

A source-code migration is not proof of protection. The deployed database/runtime must be tested independently.

## 6. Security gate and remediation

- **PASS:** unauthorized identities are rejected before protected business logic and no data changes.
- **FAIL:** an unauthorized identity reaches protected logic, receives protected data, bypasses tenant/branch scope, or causes a mutation.
- **BLOCKED:** the test cannot establish the result due to outage, permission/tool limitation, or missing evidence.

A FAIL affecting authentication, authorization, secrets, financial records, approvals, publishing, or destructive actions creates a **NO-GO** gate for related merge/deploy until contained and independently retested. Pending or rejected approval states must never mutate protected source data.

Apply least privilege explicitly. For sensitive database functions, revoke default access from `PUBLIC` and `anon`, grant only reviewed entry points to required roles, and retest through the public REST path after deployment.

## 7. Reference incident pattern

An external Postman Cloud test using a Supabase publishable/anon key and a guaranteed nonexistent UUID called an internal `SECURITY DEFINER` RPC through `/rest/v1/rpc/perform_contract_cancel`. The database returned the function's own business exception instead of an authorization denial. This proved that the request reached and executed internal logic without modifying data.

Lesson: repository code, intended grants, and UI restrictions are insufficient evidence. External runtime verification is mandatory.

## 8. Future product direction

SuperChoice AI intends to develop an authorized **Web App Security Scanner** for systems owned by or explicitly entrusted to the operator. Planned capabilities include:

- Repository and JavaScript proxy/lazy-behavior analysis.
- Supabase project, RLS, RPC, function ACL, `anon`, Edge Function, and proxy inspection.
- Safe external REST/API verification with synthetic payloads.
- Auth, role, tenant/branch, webhook, CORS, secret, dependency, and configuration checks.
- Evidence packs, severity scoring, remediation guidance, cleanup tracking, and regression retesting.
- Approval gates and strict scope controls that prevent scanning unowned targets.

The product objective is to help ordinary web applications achieve strong, repeatable security governance in the SuperChoice AI model. It is a defensive assessment tool, not a mechanism for unauthorized access.

## 9. Ownership

Repository maintainers own remediation. System owners authorize scope. Security test operators preserve evidence and cleanup. No AI agent, automation, employee, or contractor may widen the approved target or perform a destructive test without explicit authorization.


<!-- TEST DATA LIFECYCLE ENFORCEMENT — BEGIN -->
## Mandatory test-data lifecycle enforcement

- Create new synthetic test data only; never modify or reuse pre-existing data for testing.
- Simulate required historical/legacy states by creating new synthetic roots and progressing only those roots through the workflow.
- Assign every test run a unique prefix/run ID and maintain a creation manifest containing all root IDs, downstream IDs, relationships, approvals, contracts, payments, accounting entries, documents, notifications, audit records, and affected counters.
- Retain test data until the complete test scope is finished and the authorized owner explicitly approves deletion of that exact run.
- Cleanup must be derived from the manifest, preserve pre-existing/shared records, run child-first and atomically where possible, and verify zero test residue plus zero orphaned records afterward.
- If test-data ownership or lineage is uncertain, do not delete anything; stop and request clarification.
<!-- TEST DATA LIFECYCLE ENFORCEMENT — END -->