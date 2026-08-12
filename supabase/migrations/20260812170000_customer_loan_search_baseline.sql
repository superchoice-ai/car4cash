-- Tansub customer/loan UX baseline approved 2026-08-12
-- Additive migration only. Existing enum/backend value `blacklist` is intentionally preserved.

alter table public.customers
  add column if not exists line_id text,
  add column if not exists document_no text;

alter table public.vehicles
  add column if not exists registration_due_date date;

alter table public.loan_applications
  add column if not exists document_no text;

create table if not exists public.loan_guarantors (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  application_id uuid not null references public.loan_applications(id) on delete cascade,
  customer_id uuid references public.customers(id),
  full_name text not null,
  national_id text,
  phone text,
  line_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loan_guarantors_application_idx on public.loan_guarantors(application_id);
create index if not exists loan_guarantors_customer_idx on public.loan_guarantors(customer_id);
create index if not exists loan_guarantors_national_id_idx on public.loan_guarantors(national_id);
create index if not exists loan_guarantors_phone_idx on public.loan_guarantors(phone);
create index if not exists loan_guarantors_line_id_idx on public.loan_guarantors(line_id);
create index if not exists customers_line_id_idx on public.customers(line_id);
create index if not exists customers_document_no_idx on public.customers(document_no);
create index if not exists vehicles_registration_due_date_idx on public.vehicles(registration_due_date);
create index if not exists loan_applications_document_no_idx on public.loan_applications(document_no);

alter table public.loan_guarantors enable row level security;

-- Keep normal branch visibility aligned with the rest of the application.
-- Cross-branch history/blacklist reporting will be exposed later through narrowly scoped RPCs,
-- not by weakening table RLS.
drop policy if exists "loan_guarantors_select_branch" on public.loan_guarantors;
create policy "loan_guarantors_select_branch" on public.loan_guarantors
for select to authenticated
using (
  branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and branch_id is null)
);

drop policy if exists "loan_guarantors_insert_branch" on public.loan_guarantors;
create policy "loan_guarantors_insert_branch" on public.loan_guarantors
for insert to authenticated
with check (
  branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and branch_id is null)
);

drop policy if exists "loan_guarantors_update_branch" on public.loan_guarantors;
create policy "loan_guarantors_update_branch" on public.loan_guarantors
for update to authenticated
using (
  branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and branch_id is null)
)
with check (
  branch_id = (select branch_id from public.profiles where id = auth.uid())
  or exists (select 1 from public.profiles where id = auth.uid() and branch_id is null)
);
