CREATE TYPE public.cash_direction AS ENUM ('income','expense');
CREATE TYPE public.cash_category AS ENUM (
  'principal','interest','penalty','insurance','registration','follow_up',
  'salary','office','loan_repay','inter_branch','other'
);

CREATE TABLE public.cash_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  direction public.cash_direction NOT NULL,
  doc_no text NOT NULL,
  legacy_code text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  party_name text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  method text NOT NULL DEFAULT 'cash',
  total_amount bigint NOT NULL DEFAULT 0,
  change_amount bigint NOT NULL DEFAULT 0,
  note text,
  voided boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cash_entry_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.cash_entries(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  direction public.cash_direction NOT NULL,
  category public.cash_category NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_entries_branch_date ON public.cash_entries (branch_id, entry_date DESC);
CREATE INDEX idx_cash_entries_direction ON public.cash_entries (direction, entry_date DESC);
CREATE INDEX idx_cash_entries_contract ON public.cash_entries (contract_id);
CREATE UNIQUE INDEX idx_cash_entries_docno ON public.cash_entries (branch_id, doc_no);
CREATE INDEX idx_cash_lines_entry ON public.cash_entry_lines (entry_id);
CREATE INDEX idx_cash_lines_cat ON public.cash_entry_lines (branch_id, direction, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO authenticated;
GRANT ALL ON public.cash_entries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entry_lines TO authenticated;
GRANT ALL ON public.cash_entry_lines TO service_role;

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_entries_select" ON public.cash_entries FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));
CREATE POLICY "cash_entries_insert" ON public.cash_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "cash_entries_update" ON public.cash_entries FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "cash_entries_delete" ON public.cash_entries FOR DELETE TO authenticated
  USING (public.can_access_branch(branch_id) AND public.is_manager());

CREATE POLICY "cash_lines_select" ON public.cash_entry_lines FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_id));
CREATE POLICY "cash_lines_insert" ON public.cash_entry_lines FOR INSERT TO authenticated
  WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "cash_lines_update" ON public.cash_entry_lines FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "cash_lines_delete" ON public.cash_entry_lines FOR DELETE TO authenticated
  USING (public.can_access_branch(branch_id) AND public.is_manager());

CREATE TRIGGER trg_cash_entries_updated_at BEFORE UPDATE ON public.cash_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();