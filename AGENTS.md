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
