# Tansub UI & Data Pattern Baseline — 2026-08-12

Approved requirements for the customer/loan workflow.

## Standard UI pattern
- Main first-level operational/list pages use the same **Search + Filter + Pagination + Table/List + Standard Dialog** pattern where those controls are relevant to the dataset.
- Thai text search is first-class and searches the fields relevant to each table, not only record codes.
- Record selectors inside dialogs use a type-ahead searchable combobox and show close matches after partial input.
- Standard pagination is applied **after search/filtering**, defaults to 25 rows, supports 25/50/100 rows per page, shows the current range and total filtered rows, and resets to page 1 whenever search/filter/branch/page-size changes.
- Pagination applies to the first-level list screens only unless a child/sub-screen has an explicit pagination requirement.
- Current first-level pagination scope: Customers, Loan Applications, Contracts, Payments, Finance Expenses, Collections, Approvals, System Status.
- For any future first-level list screen, confirm and use this Search + Filter + Pagination pattern before implementing a different list-navigation pattern.

## Approved data ownership
- Vehicle registration renewal due date: `vehicles.registration_due_date`.
- Guarantors: relational `loan_guarantors`; keep snapshot identity/contact fields so historical guarantor searches remain valid.
- Document number: generic `document_no`, not a VAT/tax invoice number.
- Delete actions are logical status changes through approval; no physical delete for customer/application workflows.
- Contract place (`ทำที่`) comes from `branches.address`; do not hardcode the operating branch address in the contract renderer. Branches without a maintained address remain blank/placeholder until the branch master is updated.

## Customer/application exception workflow
- Edit/delete is a request first. Store requested change payload and reason in `approval_requests`.
- Approval evidence must retain requester, approver (`decided_by`) and timestamp (`decided_at`).
- Customer deactivation is locked while the customer has an account/contract that is not closed.
- Application cancellation is locked while the related account is not closed.
- Once at least one non-voided payment exists, principal/approved amount, interest rate and term are locked from modification.
- Approved edits that are allowed must update all dependent data consistently; execute server-side/transactionally rather than as unrelated browser updates.

## New application confirmation
Before the first database save, show an explicit confirmation:

> ตรวจสอบข้อมูลให้ถูกต้อง หากยืนยันจะไม่สามารถแก้ไขหรือลบได้

Worst-case edit/delete remains available only through the approval workflow.

## Global customer history mini report
Customer and application dialogs need a dedicated global search by name / national ID / phone / LINE ID. It returns whether the person has prior loan history or guarantor history and identifies the branch where each history record was found.

Do not weaken normal branch RLS to implement this. Use a narrowly scoped server/RPC search with only the fields required by the mini report. This pattern is intended to be reusable by future cross-branch reports.

## Customer wording / blacklist terminology
- User-facing wording is **ลูกค้าไม่พึงประสงค์**.
- Do not show **รายชื่อลูกค้าที่ไม่ต้องการ** or **บัญชีดำ** in normal UI copy.
- Keep backend enum/status value `blacklist` unchanged for compatibility.
- Blacklist/unblacklist approval workflow is explicitly deferred to a later change. This baseline changes wording only.

## Contract legal form
- Legal wording is immutable for UI/layout work: do not delete, shorten, paraphrase, or rewrite clauses merely to fit the page.
- Typography, line wrapping, paragraph line count, line spacing, alignment and field widths may be adjusted so the complete legal text fits one professional A4 page.
- Preview and Print/Save PDF must render the **same `ContractPromisPrint` component and exact A4 stylesheet**.
- Individual print uses an isolated print route so application shell/sidebar/table layout cannot affect pagination or paper geometry.
- The individual printer button may bypass Preview and open the isolated print-ready page directly.
- Clause numbering uses one common hanging-indent alignment; clause 7 must align with clauses 1–6 and 8–9.
- The footer `เอกสารสร้างจากระบบ ...` remains anchored at the lower-right edge of the A4 contract.

## Configuration freshness and concurrency
- `system_settings` and `integration_secrets` are DB source-of-truth; do not keep a long-lived server cache for values that control an event or external integration.
- **Execution-time rule:** whenever an event/action actually uses a config (LINE push, status sync, login callback, future integration event), read the required config from DB at the beginning of that execution. This guarantees that the event uses the latest committed value.
- Read config once per event and reuse it inside that event; do not query the same setting repeatedly inside loops. Example: status sync reads `line_notify` once per sync, then sends all incident notifications with that snapshot.
- `integration_secrets` must be read server-side. DB value takes precedence; environment variables are fallback only when the DB value is empty.
- **UI rule:** configuration screens refetch on mount, when the browser window regains focus, after any save, on explicit manual refresh, and at most every 30 minutes while the page remains open.
- UI caching is display-only. A cached UI value must never be trusted for an external action; the server action reads DB again before execution.
- After config mutation, invalidate/refetch all relevant query keys immediately so the current browser reflects the committed DB state instead of waiting for the 30-minute interval.
- Config writes that modify a nested JSON setting must read the latest DB row on the server and merge only the intended fields, preserving unrelated fields. Avoid writing a stale browser snapshot back over the whole JSON object.
- Favor one small indexed row read per config key/event over frequent polling. This keeps DB transactions short and minimizes contention under concurrent users while preserving fresh execution behavior.
- Future screens/events that introduce config must follow this pattern before adding a custom cache or polling interval.
