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


<!-- TEST DATA ISOLATION AND CONTROLLED CLEANUP — BEGIN -->
# CRITICAL RULE — Test Data Isolation, Traceability, Retention, and Controlled Cleanup

> [!CAUTION]
> This rule is mandatory for every manual or automated test in every environment. Existing data must be treated as protected data even when it appears to be old, mock, inactive, duplicated, or convenient for testing.

## Create-only test-data rule

- Tests MUST create new synthetic data. Never edit, reuse, approve, reject, cancel, convert, attach children to, or delete any pre-existing record for test purposes.
- If a test requires “old,” historical, legacy, approved, rejected, cancelled, contracted, paid, or otherwise progressed data, create a new synthetic root and progress that synthetic data through the required states. Do not repurpose existing data.
- Test data must use a unique, documented run identifier or prefix that cannot be confused with business data.

## Mandatory creation manifest and lineage

Before creating test data, record:

- test run ID/prefix, purpose, owner, environment, branch, and creation time;
- every root record created;
- every child, downstream, approval, audit, document, payment, accounting, notification, counter, and workflow record that may be created as a consequence;
- the exact creation order, relationships, table/entity IDs, and expected cleanup order;
- whether any sequence/counter is intentionally retained to preserve monotonic numbering.

The tester MUST learn and document the full creation path while testing so the cleanup scope is derived from known lineage, not guessed later from broad dates, branches, names, or table scans.

## Retention and deletion approval

- Do NOT delete, reset, anonymize, or clean up test data while testing is active.
- Retain all created test data until the complete test scope has finished and the authorized owner explicitly approves deletion.
- Test completion alone is not deletion authorization. Approval must identify the test run or exact data scope to remove.

## Controlled cleanup

After explicit approval:

1. Resolve the exact cleanup set from the creation manifest and stable IDs.
2. Preserve all pre-existing/shared data, including records temporarily referenced during the test.
3. Delete child/downstream records before roots, preferably in one atomic transaction.
4. Do not use a broad date, branch, status, partial-name, or environment-wide delete condition when stable IDs or an exact test prefix are available.
5. Do not roll counters backward when that could reuse an issued number; document intentional sequence gaps instead.
6. Verify zero remaining test-prefix records, zero target IDs, zero broken references/orphans, unchanged protected data, and valid constraints/indexes.
7. Report exact per-table deletion counts, retained operational state, verification evidence, and anything still UNKNOWN.

If ownership or lineage cannot be proven, STOP and request clarification. Never “clean up what looks like test data.”
<!-- TEST DATA ISOLATION AND CONTROLLED CLEANUP — END -->

<!-- LOVABLE PROD/DEV BRANCH SEPARATION — BEGIN -->
# CRITICAL RULE — Lovable Production and Development Branch Separation

> [!CAUTION]
> This rule applies whenever Lovable is the primary web application/editor or the repository is connected to Lovable.

- GitHub branch `main` is the only branch authorized as the source for Lovable production publishing.
- Production is the published Lovable URL, normally `https://<project>.lovable.app`.
- Do NOT develop, experiment, generate code, or commit feature/fix work directly on `main`. All development MUST occur on a separate non-main development branch.
- Lovable Project Preview UI is the Dev/QA environment and uses an ephemeral preview URL such as `https://[project-id]-preview.lovable.app`.
- Before any test, sync, publish, or release decision, verify the exact GitHub branch connected to Lovable. Lovable UI labels such as “Main” or “Draft” describe Lovable UI/design state and MUST NOT be interpreted as GitHub branch names.
- Preview/non-main code must never be published as production. Publish only after the approved development branch is reviewed, validated, merged into `main`, branch synchronization is confirmed, and the authorized owner explicitly approves production publishing.
- A production hotfix must still be developed on a non-main branch and merged through the approved review path. Do not bypass branch separation because a change is urgent or small.
- If Lovable cannot prove the connected branch or environment, STOP with `NO-GO`; do not develop on `main` and do not publish.

This separation is mandatory because Lovable uses the production published URL and project preview URL as the practical PROD/Dev boundary.
<!-- LOVABLE PROD/DEV BRANCH SEPARATION — END -->