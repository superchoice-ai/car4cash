<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# CRITICAL RULE — Mandatory Full-Project Impact Review

> [!CAUTION]
> This is a critical, non-optional governance rule for every human and AI contributor. It applies before any development or repository change, regardless of size.

## Absolute requirement

Before changing anything—including wording, labels, comments, documentation, configuration, dependencies, schemas, migrations, environment variables, proxies, API clients, UI, workflows, permissions, or a single line of code—you MUST:

1. Inspect the entire project context relevant to the proposed change, not only the target file.
2. Trace all upstream and downstream dependencies, integrations, shared clients, proxies, environment bindings, database objects, workflows, roles, and consumers that may be affected.
3. Perform and record a full-project impact review before implementation.
4. Identify existing behavior that must remain unchanged and define regression risks.
5. Define validation, regression tests, rollback, and evidence required for acceptance.
6. Stop and request explicit confirmation when impact, ownership, production topology, credentials, data migration, or rollback safety is unclear.
7. Implement only the reviewed and approved scope.
8. After implementation, run the defined validation and regression tests and report the evidence.

## No small-change exemption

There is no exemption for a “small,” “safe,” “cosmetic,” “wording-only,” or “obvious” change. A minor edit can alter routing, shared components, generated artifacts, database behavior, integrations, or operational workflows. Assumptions are not evidence.

## Fail-closed rule

If the impact review is missing, incomplete, or cannot prove that dependent behavior is protected, DO NOT DEV, DO NOT MERGE, DO NOT DEPLOY, and DO NOT modify production data.

## Minimum impact-review record

The review must state:

- requested change and exact scope;
- affected repository, files, modules, database objects, APIs, proxies, workflows, roles, and environments;
- dependency and consumer trace;
- security, data-integrity, permission, operational, and compatibility risks;
- regression-test plan and expected results;
- rollback plan;
- unresolved questions and approval gate;
- post-change evidence.

The Supabase proxy/approval-workflow regression is the standing lesson: changing shared infrastructure without tracing every consumer can silently break previously working approval behavior and force costly regression recovery. This must not happen again.


# CRITICAL RULE — Interpretation Confirmation Before Reasoning or Action

> [!CAUTION]
> Repository artifacts are evidence of what exists; they are not automatic authorization, approved requirements, or permission to design or implement anything.

## Mandatory interpretation gate

Whenever a human or AI encounters anything that requires interpretation—including an enum value, schema object, migration, route, workflow name, roadmap item, TODO, comment, label, mockup, dormant code, “future” feature, existing partial implementation, or ambiguous user wording—it MUST NOT decide the intended business meaning by itself.

Before treating that interpretation as a requirement, deriving a solution from it, planning implementation, extending an impact review on that basis, or changing anything, it MUST:

1. State exactly what artifact or wording was found.
2. State the proposed interpretation in plain language.
3. Compare it against confirmed business rules, invariants, previous decisions, current scope, and explicit exclusions.
4. Identify every conflict, ambiguity, assumption, and alternative interpretation.
5. Ask the user/authorized owner to confirm the intended meaning.
6. Wait for explicit confirmation before continuing reasoning that depends on that interpretation or performing any implementation.

Read-only inspection is allowed only to gather enough evidence to expose the ambiguity and ask for confirmation. It does not authorize solution design or implementation.

## Artifacts are not approval

The presence of a name or capability in any repository artifact does not prove that it is:

- an approved feature;
- valid under current business rules;
- in current scope;
- safe to implement;
- intended to be active;
- authorized for production;
- authorized for design or impact expansion.

For example, an enum such as `restructure`, a dormant workflow, or a future roadmap entry MUST remain unsupported/fail-closed unless its business meaning and scope are explicitly confirmed.

## Conflict precedence and stop rule

Confirmed business invariants and explicit user decisions override inferred meaning from code, schema, enums, documentation, naming, or conventional industry practice.

If a proposed interpretation conflicts with a confirmed rule, STOP. Do not “design an exception,” do not assume a future requirement, and do not continue merely because the user said “Continue.” Present the conflict and request a decision.

“Continue” authorizes only the next work that is already confirmed and consistent with existing rules. It never confirms an unstated interpretation and never authorizes the next listed enum, phase, workflow, or roadmap item automatically.

## No interpretation-by-convention

Do not infer intent from best practices, common product behavior, technical possibility, industry terminology, or what a field/workflow normally means. Recommendations may be offered only after the actual business meaning is confirmed, and they must be clearly separated from confirmed requirements.

## Fail-closed requirement

If confirmation is missing, unclear, contradictory, or not attributable to an authorized decision maker:

- keep the feature unsupported or disabled;
- keep workflow dispatch fail-closed;
- do not modify code, schema, data, documentation conclusions, or production behavior based on the interpretation;
- record the unresolved question and wait.

## Required evidence record

The confirmation record must include:

- artifact or wording that triggered interpretation;
- proposed interpretation;
- conflicts checked;
- alternatives considered;
- explicit confirmed meaning;
- confirmer/decision owner;
- scope authorized;
- items explicitly not authorized.

## Standing lessons

The Supabase Proxy regression showed the danger of technical change without full dependency impact review. The `restructure` misunderstanding showed that even a detailed impact review is unsafe when it begins from an unconfirmed business interpretation. Both gates are mandatory: first confirm meaning, then perform full-project impact review.


# CRITICAL RULE — System Readiness Gate

> [!CAUTION]
> This gate is mandatory before every actionable work session, continuation, development task, migration, deployment, workflow activation, external write, or production/data operation. A green status page alone is not proof that the project's actual path is healthy.

## Required readiness header

Before reasoning toward implementation or taking action, state and record:

- conversation/task scope and explicit exclusions;
- repository, branch, phase/change set, and target environment (local/demo/staging/production);
- exact systems and dependency path that the task will touch;
- operations authorized now and operations that remain unauthorized;
- official provider status checked, timestamp, timezone, and relevant component/region;
- read-only smoke-test evidence for the actual project path;
- final decision: `GO`, `LIMITED GO`, or `NO-GO`.

Repeat the gate whenever scope changes, the environment changes, a new dependency is introduced, an incident begins, or more than 15 minutes have passed before a high-risk write.

## Two-layer readiness check

1. **Provider status:** Check every relevant provider's official status page. Never use an unofficial outage detector as acceptance evidence.
2. **Project-path probe:** Run the smallest safe read-only check through the same route that the work will use. Examples include repository read, `SELECT now()`, a non-mutating API health request, webhook dry-run, or dependency-specific connectivity check.

If a provider has no verified public status page, record `UNKNOWN — no verified public status page` and require a direct read-only probe. Do not silently substitute a third-party status site.

## Fail-closed and degraded-mode rules

- `NO-GO`: Do not migrate, deploy, activate, merge, change production data, or perform external writes when a relevant dependency is degraded, unknown without a successful probe, returning timeouts/5xx, or inconsistent with the expected environment.
- `LIMITED GO`: Read-only inspection, local analysis, documentation, and isolated GitHub work may continue only when they do not depend on or write through the degraded path.
- A timeout from Lovable Database Query Gateway/MCP does not by itself prove that the database is damaged or that a migration caused a lock. Correlate official incidents, direct database health, query-path behavior, logs, locks, and migration evidence before assigning root cause.
- Never bypass approval, permission, audit, regression, or data-integrity controls to work around an unavailable provider.

## Alternate-path and synchronization rule

Work may be moved to another healthy system—such as preparing code or documentation in GitHub—only when the alternate path is explicitly within scope and does not require the unhealthy dependency. Before reflecting changes back into Lovable or another target system:

1. re-run this readiness gate for the target path;
2. confirm branch/environment alignment and inspect the complete diff;
3. perform the mandatory impact review and interpretation confirmation;
4. use the normal supported synchronization path;
5. run regression tests after synchronization.

Do not force-push, rewrite published history, manually patch generated state, or treat GitHub completion as proof that Lovable, Supabase, n8n, or production has applied the change.

## Official status registry

This registry is the minimum known project dependency set. Add any dependency discovered by the task before work begins.

| System | Official status URL | Relevant scope |
|---|---|---|
| GitHub | https://www.githubstatus.com/ | Git operations, API and repository sync |
| Lovable | https://status.lovable.dev/ | Editor, Cloud, MCP and API |
| Supabase | https://status.supabase.com/ | Database, API Gateway, Auth, Edge Functions and Management API |

# CRITICAL RULE — Explicit Authorization, Literal Read Scope, and Verified Capability

> [!CAUTION]
> This lesson-learned rule is mandatory for every human and AI contributor. It prevents unauthorized development, scope expansion, and premature claims that a task or repository is inaccessible.

## 1. No workflow or node creation without explicit authorization

Do not create, modify, run, activate, publish, import, or delete any workflow or node unless the authorized owner has explicitly approved that exact action and scope.

Creating a workflow or node is development. It is not read-only preparation, exploration, inspection, or documentation work. A request to inspect, study, copy, or summarize repository documentation does not authorize workflow or node creation.

If the available environment can perform the requested write only by creating or changing a workflow, stop and request explicit authorization before creating or changing it. Tool limitations do not broaden authority.

## 2. Interpret instructions literally and confirm before expanding scope

Follow the repository's Interpretation Confirmation Gate without exception.

Unless the authorized owner explicitly says otherwise:

- “read/study the .MD” means read the existing Markdown files only;
- “copy the .MD” means retrieve/read the Markdown content for reference only;
- neither phrase authorizes editing, committing, pushing, opening a pull request, creating automation, changing a workflow/node, or starting development;
- “before development” includes every preparatory action that mutates an external system, repository, workflow, node, database, deployment, credential, or runtime state.

When wording could support more than one meaning, state the possible interpretations and wait for confirmation. Do not choose the broader interpretation yourself.

## 3. Verify actual access and environment capability before declaring failure

Do not claim that a repository, file, credential, system, or task is inaccessible or impossible until reasonable read-only verification has been completed.

The verification must include, as relevant:

1. authenticated identity and connected account;
2. repository/organization visibility and exact owner/name;
3. branch and path existence, including case and renamed/archived repositories;
4. installed connector, credential, permission, token scope, and available tool capability;
5. direct read-only probe through the intended access path;
6. observed HTTP/status/error evidence and whether the failure is authentication, authorization, path, provider incident, or unsupported capability.

A first 404, 401, timeout, empty search result, missing UI control, or unfamiliar tool is not sufficient evidence that access is impossible. Report what was checked, the evidence found, and what remains unknown. Never expose secrets while verifying.

## Fail-closed enforcement

If explicit authorization, intended meaning, or verified capability is unclear:

- perform only the minimum read-only inspection needed to explain the ambiguity;
- do not create or modify workflows/nodes;
- do not edit, commit, push, merge, deploy, or change data;
- do not invent a workaround that mutates another system;
- present the evidence and wait for the authorized owner's decision.

## Standing lesson

An AI was asked only to read repository Markdown but created exploratory workflows, interpreted “copy .MD” as permission to commit and develop, and initially reported repositories as unavailable after a superficial 404 despite an authorized GitHub credential being available. These were scope-control and verification failures. This rule exists to prevent recurrence.

# CRITICAL RULE — Cloud Browser Continuity Assessment

> [!CAUTION]
> When normal development is blocked by an external provider or a failing tool path outside the project's control, do not default to waiting indefinitely. After checking official documentation and official service status, present Cloud Browser as a temporary continuity option only when a read-only feasibility assessment proves that it can safely continue the exact authorized work.

## Mandatory order

1. Check the current official documentation for the affected feature, API, limitation, authentication method, and supported recovery path.
2. Check the official provider status page and incident history; record the timestamp, timezone, affected component/region, and incident link.
3. Run the smallest safe read-only probe through the normal project path and preserve the exact error evidence.
4. Identify whether the failure is provider-wide, account/project-specific, permission-related, configuration-related, or limited to a gateway/tool path.
5. If the normal path remains blocked, explicitly propose a Cloud Browser feasibility assessment and obtain authorization before opening or using the signed-in browser session.
6. Use Cloud Browser read-only first to verify the exact project and environment, authenticated identity, available data/schema/logs/admin surfaces, and whether the browser route is genuinely independent of the failing path.
7. Classify the result as `GO`, `LIMITED GO`, or `NO-GO` before any development continues.

## Feasibility decision

- `GO`: The exact required path works, project/environment identity is verified, authorized actions are supported, data-integrity controls remain intact, and validation plus rollback are available.
- `LIMITED GO`: Only explicitly bounded work may continue, such as read-only inspection, evidence collection, SQL preparation, documentation, or another isolated task that does not depend on the failed path.
- `NO-GO`: Stop when authentication or environment identity is uncertain, the browser uses the same failing backend, required permissions or audit controls are missing, writes cannot be made atomic and reversible, or the risk to production/data integrity is unclear.

A page loading successfully is not sufficient evidence. The assessment must prove that the exact operation needed for development can be completed and verified safely.

## Safety and authorization boundaries

- Cloud Browser is a continuity path, not permission to bypass access controls, provider safeguards, approval gates, audit requirements, or repository rules.
- Do not enter, request, expose, or copy credentials or secrets in chat. Use only an existing authorized signed-in session and require manual user takeover when login is needed.
- Read-only inspection may establish feasibility; it does not authorize a write, migration, deployment, merge, workflow activation, or production-data change.
- Before any separately authorized write, require a backup or rollback plan, transaction/dry-run where supported, atomic scope, full impact review, and post-change regression evidence.
- Recheck official status before merge, deployment, synchronization, or production/data operations. Return to the normal supported integration path after recovery.

## Required continuity record

Record:

- task, repository, branch, project, and target environment;
- official documentation and official status URLs checked;
- timestamp and timezone;
- exact normal-path failure and evidence;
- Cloud Browser route tested and proof that it differs from or remains unaffected by the failed path;
- authenticated identity/project verification without exposing secrets;
- actions verified, actions not verified, and explicit exclusions;
- decision: `GO`, `LIMITED GO`, or `NO-GO`;
- rollback, validation, and synchronization plan;
- owner authorization required before the next mutating action.

## Standing example

Supabase status (<https://status.supabase.com/>) and Lovable incident history (<https://status.lovable.dev/history>) are standing examples: an external gateway or platform incident may block normal development for days even when a separately authorized Cloud Browser path can still support bounded work. They are examples, not assumptions. Always verify the current official evidence and prove project-specific feasibility before recommending continuation.
