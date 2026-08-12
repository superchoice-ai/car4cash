# Tansub UI & Data Pattern Baseline — 2026-08-12

Approved requirements for the customer/loan workflow.

## Standard UI pattern
- Main operational pages use the same Search + Filter + Table + Standard Dialog pattern.
- Thai text search is first-class and searches the fields relevant to each table, not only record codes.
- Record selectors inside dialogs use a type-ahead searchable combobox and show close matches after partial input.
- Target pages: Customers, Loan Applications, Contracts, Payments, Collections, Approvals.

## Approved data ownership
- Vehicle registration renewal due date: `vehicles.registration_due_date`.
- Guarantors: relational `loan_guarantors`; keep snapshot identity/contact fields so historical guarantor searches remain valid.
- Document number: generic `document_no`, not a VAT/tax invoice number.
- Delete actions are logical status changes through approval; no physical delete for customer/application workflows.

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
Contract preview/print must preserve the supplied legal PDF/Crystal Report form exactly. Do not reconstruct or paraphrase legal wording. Use the original fixed template and overlay variable data. This remains a separate implementation item because it requires the source legal form asset and print validation.
