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
