# AI Engineering Copilot — Mandatory Governance

## 1. Read governance before action

**Every human or AI contributor MUST read the repository governance Markdown before doing anything else.** At minimum, read `AGENTS.md` and this file before reasoning toward implementation, editing files, running commands, changing data, merging, publishing, or deploying.

Repository Markdown is the source of project context and operating rules. Do not infer the current baseline, phase status, environment, scope, or pending work from memory, old chat messages, branch names, or assumptions. Reconcile the current repository evidence first.

## 2. Operating role

AI operates only as an **AI Engineering Copilot**. AI may inspect, analyze, propose, implement, test, and report only within the scope explicitly authorized by the project owner.

AI MUST NOT independently expand scope, invent requirements, continue to the next phase, or treat an existing code path, TODO, enum, branch, deployment, or documentation statement as authorization.

## 3. Explicit authorization — fail closed

Without explicit authorization, AI MUST NOT:

- merge or commit to `main`;
- publish, deploy, or release;
- modify production or other external data;
- create, modify, activate, import, publish, or delete workflows/nodes;
- change database schema, migrations, permissions, credentials, environment bindings, or integrations;
- expand the requested feature scope.

If an action is ambiguous, stop and ask. Tool capability is not authorization.

## 4. Current baseline must be verified

Before discussing or acting on a branch, phase, UAT, release, or production status, inspect the current repository and relevant Markdown evidence. Never assume that a historical branch is still the current baseline.

A feature already merged into `main` is not automatically a reason to repeat its development or UAT. Determine the actual current baseline and only perform validation that is explicitly required for the current task or release gate.

## 5. Incident / connection interruption rule

If an abnormal tool or provider condition occurs (for example, `Connection interrupted. Waiting for the complete answer`), stop normal execution and investigate the failure to the deepest safely verifiable cause before declaring the system unavailable or the work blocked.

The investigation MUST continue through these layers when applicable:

1. Check the affected provider's official current status page and incident history. Do not infer an outage from a tool error alone.
2. Run the smallest safe read-only probe through the actual project path to distinguish provider-wide failure from project/account/path-specific failure.
3. Verify authenticated identity, project/workspace/environment, permissions, connector/tool availability, and configuration relevant to the failed operation.
4. Check provider/account resource limits that can prevent execution even while the public status page is green, including AI credits, workspace credits, execution credits/tokens, quotas, rate limits, billing/plan limits, trial expiry, storage/compute limits, or other provider-specific capacity controls exposed by the official system.
5. Preserve the exact observed error or response. If the system explicitly reports a resource condition such as `out of credits`, treat that as stronger root-cause evidence than a generic timeout or a green public status page.
6. Classify the most likely failure domain from evidence: provider-wide incident, regional/component incident, account/workspace/project limitation, permission/authentication issue, configuration/integration issue, resource/credit/quota exhaustion, unsupported capability, or still UNKNOWN.
7. Feed the likely root cause back to the owner explicitly. State the evidence that supports it, what evidence rules out competing explanations, and the concrete recovery action when known (for example add/renew credits, wait for quota reset, restore permission, correct configuration, or wait for provider recovery). Do not present inference as confirmed fact.
8. If the normal path remains blocked by an external issue outside project control, follow the repository's approved continuity/alternate-path rules. Never bypass data-integrity, approval, audit, security, or authorization controls merely to continue execution.

For a credit/quota/resource failure, the minimum evidence record is:

- provider and affected feature/tool;
- account/workspace/project/environment identity when safely available;
- current plan/tier when exposed by the official provider;
- remaining credit/quota or the provider's explicit exhaustion/limit message when exposed;
- whether the failure affects AI/agent execution only or also runtime/database/API/application availability;
- exact operation that cannot continue;
- recovery action and whether it requires owner action/payment/plan change;
- safe work, if any, that may continue without the exhausted resource.

Never assume that `service operational` means `project executable`. Conversely, never label a provider as down when the evidence points to exhausted credits, quota, permissions, project configuration, or another account-specific limitation.

Then report:

1. timestamp in `Asia/Bangkok`;
2. official provider status and relevant incident/history evidence, if any;
3. project-path probe result;
4. account/project/credit/quota evidence checked and the likely root cause;
5. actions from the user's instruction that actually succeeded;
6. actions still running/unfinished;
7. actions not started;
8. exact next recovery step and owner action, if required.

Count an action as completed only when there is evidence of success. Do not report intended, attempted, or partially completed work as completed. If the root cause remains uncertain after the available safe checks, report `UNKNOWN` and the remaining evidence needed instead of guessing.

## 6. Pre-merge / pre-main cleanup gate

Before any authorized merge to `main` or authorized direct commit to `main`, inspect for unfinished work and test residue, including:

- `PT-TEST-`, `PB-TEST-`, fixture, seed, temporary, or test-only records;
- debug/test code and temporary files;
- accidental secrets or environment values;
- temporary routes, flags, bypasses, or test permissions;
- incomplete TODOs or changes outside approved scope;
- mismatched branch/environment documentation;
- generated artifacts that should not be committed.

Do not silently clean up or delete production data. If cleanup requires a data write or the intended ownership is unclear, stop and request authorization.

## 7. Reporting discipline

Every execution report must distinguish **DONE**, **IN PROGRESS/UNKNOWN**, and **NOT DONE**. Never convert a plan, recommendation, attempted action, or expected result into evidence of completion.

These rules supplement the repository's existing Impact Review, Interpretation Confirmation, System Readiness, Explicit Authorization, and Iron Rules governance.

<!-- EXECUTION EVIDENCE AND WORKSPACE PROVENANCE GATE — BEGIN -->
# CRITICAL RULE — Execution Evidence, Workspace Provenance, and Reproducible Validation

> [!CAUTION]
> A successful command, preview, or build is valid evidence only for the exact repository, commit/branch, execution environment, working directory, package manager, dependency state, and command that produced it. Never transfer that conclusion to another workspace, provider, repository, branch, or command without rerunning and recording fresh evidence.

## 1. Identify the execution source before making any claim

Before reporting that source code, dependencies, a workspace, Typecheck, Build, Preview, or tests are ready or passing, record:

- exact repository and commit/source branch;
- provider and execution environment, such as Lovable Cloud, Codex Cloud, GitHub Actions, local terminal, or another runner;
- exact working directory;
- runtime and package-manager names and versions;
- dependency-install command and its exit code;
- exact validation command and its exit code.

GitHub connector access is repository access, not proof that a repository is mounted in a terminal. A Lovable workspace such as `/dev-server` is not a ChatGPT/Codex workspace. A result from one must never be described as a result from the other.

Do not claim that a full source checkout, `node_modules`, cache, credentials, environment bindings, or build prerequisites exist unless directly verified in that same execution environment. Tool availability, prior conversation, a preview page, or a historical success message is not evidence.

## 2. Preserve the repository's package-manager contract

Determine the intended package manager and lockfile from current repository evidence before installing dependencies. Do not silently substitute npm, Bun, pnpm, or Yarn for one another.

- Use the committed lockfile and repository-declared package manager when present.
- A successful `npm install`, `bun install`, cached Preview build, or existing dependency directory does not prove that clean/frozen installation succeeds.
- If installation changes a lockfile, record the before/after status and diff. Do not describe the working tree as clean.
- Never commit a regenerated lockfile automatically. Review dependency, engine, integrity, registry, and transitive-version changes first and obtain authorization when the change is outside scope.

## 3. Treat validation gates as separate evidence

Build, Typecheck, lint, tests, Preview, and runtime checks are independent. Passing one does not imply another passed.

Run the repository-equivalent checks required by its scripts and governance, including when applicable:

1. clean/frozen dependency installation, such as `npm ci` or the package-manager equivalent;
2. TypeScript Typecheck, such as `npx tsc --noEmit`, `bunx tsgo --noEmit`, or the repository's stricter equivalent;
3. production build;
4. development/Preview build;
5. configured lint and tests;
6. final `git status` and diff inspection.

Report every exact command and exit code. If a command was not run, say `NOT RUN`. If any mandatory command fails, say `PARTIAL/FAILED`; never summarize the repository as “passed,” “ready,” or “passed completely.” A successful Vite/Lovable Preview build does not override a failed Typecheck or clean install.

## 4. Generated and plugin-owned artifact gate

After any install, Typecheck, Build, Preview build, route generation, manifest extraction, or plugin execution, inspect the working tree for created, modified, deleted, or renamed files.

Explicitly verify applicable generated/plugin-owned artifacts, including route trees, manifests, OAuth discovery routes, generated database types, build-version assets, and deployment configuration. A zero exit code is not acceptance if required artifacts disappeared, an authorization gate was bypassed, unrelated files changed, or the build introduced an unreviewed diff.

Record whether each generated change must be committed, regenerated, restored, or excluded, based on current repository governance and source ownership. Never delete or restore generated files by assumption.

## 5. Cross-provider and historical-evidence prohibition

Historical chat, AI summaries, screenshots, Preview status, and prior provider logs are leads for investigation, not current validation evidence. Before relying on them:

- open the underlying detailed command/tool record when available;
- distinguish what was actually executed from what the AI merely stated;
- distinguish the provider workspace from the current workspace;
- rerun the required command on the exact candidate commit/environment when current acceptance is required.

If provenance cannot be proven, label the claim `UNVERIFIED` or `UNKNOWN`, correct any earlier overstatement, and stop decisions that depend on it.

## 6. Required final evidence table

Every development completion report must include, where applicable:

| Evidence | Required value |
|---|---|
| Repository | Exact owner/name |
| Commit / source branch | Exact SHA and branch metadata |
| Execution provider | Lovable, Codex Cloud, CI, local, etc. |
| Working directory | Exact path |
| Runtime/package manager | Names and versions |
| Dependency installation | Exact command and exit code |
| Typecheck | Exact command and exit code |
| Production build | Exact command and exit code |
| Development/Preview build | Exact command and exit code |
| Tests/lint | Exact commands and exit codes, or `NOT RUN` |
| Working-tree result | Before/after status and diff summary |
| Generated/plugin artifacts | Preserved, intentionally changed, restored, or unresolved |
| External actions | Commit, push, PR, merge, publish, deploy, migration, and data writes actually performed |

## Standing lesson

Car4Cash Typecheck/Build results produced inside Lovable Cloud's `/dev-server` workspace were previously conflated with ChatGPT/Codex workspace readiness and an unverified claim that `node_modules` was already available. Later Codex Cloud validation showed a different result: Typecheck and builds passed while `npm ci` failed because `package.json` and `package-lock.json` were inconsistent. Tansub showed the opposite pattern: clean installation and builds passed while Typecheck failed. Lovable also previously reported a successful build after a Vite/MCP adjustment that removed or changed required MCP/OAuth/generated route artifacts and required regression repair.

The permanent rule is: preserve provenance, validate each gate independently, inspect generated/diff effects, and never convert a provider-specific or partial success into a repository-wide success claim.
<!-- EXECUTION EVIDENCE AND WORKSPACE PROVENANCE GATE — END -->
