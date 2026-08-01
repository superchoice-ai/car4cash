-- ===== Legacy migration staging =====
CREATE TABLE public.legacy_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  dataset text NOT NULL,
  source_file text,
  row_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.legacy_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  import_run_id uuid REFERENCES public.legacy_import_runs(id) ON DELETE SET NULL,
  legacy_code text NOT NULL,
  old_code text,
  full_name text,
  address text,
  national_id text,
  tel text,
  car_brand text,
  car_type text,
  plate_no text,
  color text,
  loan_amount bigint NOT NULL DEFAULT 0,
  hire_price bigint NOT NULL DEFAULT 0,
  installment_amount bigint NOT NULL DEFAULT 0,
  term_months integer,
  outstanding bigint NOT NULL DEFAULT 0,
  contract_date text,
  tax_due_date text,
  guarantor_name text,
  guarantor_tel text,
  note text,
  status text NOT NULL DEFAULT 'imported',
  migrated_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  migrated_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, legacy_code)
);
CREATE INDEX legacy_customers_branch_idx ON public.legacy_customers (branch_id);
CREATE INDEX legacy_customers_code_idx ON public.legacy_customers (legacy_code);

CREATE TABLE public.legacy_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  import_run_id uuid REFERENCES public.legacy_import_runs(id) ON DELETE SET NULL,
  legacy_code text NOT NULL,
  full_name text,
  bill_no text NOT NULL,
  paid_on date,
  paid_on_raw text,
  principal_amount bigint NOT NULL DEFAULT 0,
  interest_amount bigint NOT NULL DEFAULT 0,
  penalty_amount bigint NOT NULL DEFAULT 0,
  follow_up_amount bigint NOT NULL DEFAULT 0,
  insurance_amount bigint NOT NULL DEFAULT 0,
  registration_amount bigint NOT NULL DEFAULT 0,
  change_amount bigint NOT NULL DEFAULT 0,
  total_amount bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, bill_no, legacy_code)
);
CREATE INDEX legacy_receipts_branch_date_idx ON public.legacy_receipts (branch_id, paid_on DESC);
CREATE INDEX legacy_receipts_code_idx ON public.legacy_receipts (legacy_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_import_runs TO authenticated;
GRANT ALL ON public.legacy_import_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_customers TO authenticated;
GRANT ALL ON public.legacy_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_receipts TO authenticated;
GRANT ALL ON public.legacy_receipts TO service_role;

ALTER TABLE public.legacy_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legacy_runs_select" ON public.legacy_import_runs
  FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "legacy_runs_write" ON public.legacy_import_runs
  FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id) AND public.is_manager())
  WITH CHECK (public.can_access_branch(branch_id) AND public.is_manager());

CREATE POLICY "legacy_customers_select" ON public.legacy_customers
  FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "legacy_customers_write" ON public.legacy_customers
  FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id) AND public.is_manager())
  WITH CHECK (public.can_access_branch(branch_id) AND public.is_manager());

CREATE POLICY "legacy_receipts_select" ON public.legacy_receipts
  FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "legacy_receipts_write" ON public.legacy_receipts
  FOR ALL TO authenticated
  USING (public.can_access_branch(branch_id) AND public.is_manager())
  WITH CHECK (public.can_access_branch(branch_id) AND public.is_manager());

CREATE TRIGGER legacy_runs_updated_at BEFORE UPDATE ON public.legacy_import_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER legacy_customers_updated_at BEFORE UPDATE ON public.legacy_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Platform status incidents =====
CREATE TABLE public.status_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guid text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'lovable',
  title text NOT NULL,
  link text,
  severity text NOT NULL DEFAULT 'info',
  incident_state text NOT NULL DEFAULT 'investigating',
  impact_summary text,
  situation text,
  raw_content text,
  started_at timestamptz,
  resolved_at timestamptz,
  published_at timestamptz NOT NULL DEFAULT now(),
  notified_browser boolean NOT NULL DEFAULT false,
  notified_line boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX status_incidents_published_idx ON public.status_incidents (published_at DESC);

GRANT SELECT ON public.status_incidents TO authenticated;
GRANT ALL ON public.status_incidents TO service_role;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_incidents_select" ON public.status_incidents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_incidents_admin_write" ON public.status_incidents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER status_incidents_updated_at BEFORE UPDATE ON public.status_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.status_incidents;
ALTER TABLE public.status_incidents REPLICA IDENTITY FULL;

INSERT INTO public.system_settings (key, value, description) VALUES
  ('status_feed', '{"url":"https://status.lovable.dev/feed.rss","enabled":true,"line_notify_min_severity":"major"}'::jsonb, 'การเฝ้าระวังสถานะระบบและการแจ้งเตือน'),
  ('line_notify', '{"channel_access_token_secret":"LINE_CHANNEL_ACCESS_TOKEN","to":[],"enabled":false}'::jsonb, 'ตั้งค่าการแจ้งเตือนผ่าน LINE / LINE OA')
ON CONFLICT (key) DO NOTHING;