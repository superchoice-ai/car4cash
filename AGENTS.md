<!-- AI ENGINEERING COPILOT — MANDATORY START HERE -->
> [!CAUTION]
> **Every human and AI contributor MUST read `AI_ENGINEERING_COPILOT.md` BEFORE reasoning, planning, editing, committing, merging, publishing, deploying, testing, or taking any other action in this repository.**
>
> `AI_ENGINEERING_COPILOT.md` is mandatory project governance. AI is an **AI Engineering Copilot**: it assists, but does not independently expand scope or make release decisions.
>
> **Explicit authorization required:** Do NOT Merge, Publish, Deploy, Commit to `main`, modify production, or expand scope unless the authorized owner explicitly requests that exact action.
>
> **Incident rule:** If an abnormal tool/provider condition occurs (for example `Connection interrupted. Waiting for the complete answer`), check the relevant provider's **official status page**, record time/timezone and evidence, then report completed / in-progress-unknown / not-done work and the exact next step after recovery.
>
> **Pre-main hygiene:** Before any merge to `main` or direct commit to `main`, verify no PT-TEST/PB-TEST fixtures, temporary/debug data, secrets, generated artifacts, unfinished scope, or other test residue is being carried forward.
>
> **Mandatory reading order:** Read `AI_ENGINEERING_COPILOT.md` first, then continue with the repository governance below.
<!-- AI ENGINEERING COPILOT — MANDATORY END -->

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

Whenever interpretation is required, state the artifact, proposed meaning, conflicts/alternatives, and wait for explicit owner confirmation before reasoning or implementation depends on that interpretation.

# CRITICAL RULE — System Readiness Gate

> [!CAUTION]
> This gate is mandatory before every actionable work session, continuation, development task, migration, deployment, workflow activation, external write, or production/data operation.

Before action, record scope/exclusions, repository/branch/phase/environment, dependency path, authorized/unauthorized operations, relevant official provider status with timestamp/timezone, read-only project-path evidence, and `GO`, `LIMITED GO`, or `NO-GO`.

Check relevant providers' official status pages and run the smallest safe read-only project-path probe. Do not migrate, deploy, activate, merge, change production data, or perform external writes when a relevant dependency is degraded, unknown without a successful probe, returning timeouts/5xx, or inconsistent with the expected environment.

# CRITICAL RULE — Explicit Authorization, Literal Read Scope, and Verified Capability

> [!CAUTION]
> Do not create, modify, run, activate, publish, import, or delete any workflow or node unless the authorized owner has explicitly approved that exact action and scope.

“Read/study/copy the .MD” means read/reference only; it does not authorize editing, committing, pushing, PRs, workflow/node creation, or development. Verify actual repository/branch/path/access capability before declaring failure.

If explicit authorization, intended meaning, or verified capability is unclear: perform only minimum read-only inspection, then stop and wait.

# CRITICAL RULE — Cloud Browser Continuity Assessment

> [!CAUTION]
> When normal development is blocked by an external provider, first check official documentation and status, run a safe read-only probe, identify the failure class, and only then propose Cloud Browser as a temporary continuity option with explicit authorization. Cloud Browser never bypasses authorization, approval, audit, repository, or data-integrity controls.
