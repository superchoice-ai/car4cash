-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin','manager','approver','staff','viewer');
CREATE TYPE public.customer_status AS ENUM ('active','inactive','blacklist');
CREATE TYPE public.vehicle_book_status AS ENUM ('pending','received','returned','seized');
CREATE TYPE public.application_status AS ENUM ('draft','submitted','pending_approval','approved','rejected','cancelled','contracted');
CREATE TYPE public.contract_status AS ENUM ('active','closed','overdue','defaulted','cancelled');
CREATE TYPE public.installment_status AS ENUM ('unpaid','partial','paid','overdue','waived');
CREATE TYPE public.approval_type AS ENUM ('delete_record','loan_approval','contract_cancel','restructure','payment_void','other');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','cancelled');
CREATE TYPE public.notify_status AS ENUM ('queued','sent','failed');

-- ========== BRANCHES ==========
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  district text,
  address text,
  phone text,
  is_hq boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== HELPER FUNCTIONS ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_hq(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
      OR EXISTS (SELECT 1 FROM public.profiles p JOIN public.branches b ON b.id = p.branch_id
                 WHERE p.id = _user_id AND b.is_hq)
$$;

CREATE OR REPLACE FUNCTION public.my_branch(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND (public.is_hq(auth.uid()) OR _branch = public.my_branch(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hq uuid; first_user boolean;
BEGIN
  SELECT id INTO hq FROM public.branches WHERE is_hq LIMIT 1;
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO first_user;
  INSERT INTO public.profiles (id, full_name, email, branch_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, hq);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- policies for base tables
CREATE POLICY "branches readable" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches admin write" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_hq(auth.uid()) OR branch_id = public.my_branch(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_hq(auth.uid()));
CREATE POLICY "roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== CUSTOMERS ==========
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  national_id text,
  birth_date date,
  phone text,
  phone2 text,
  email text,
  address text,
  district text,
  province text DEFAULT 'สุราษฎร์ธานี',
  postcode text,
  occupation text,
  monthly_income bigint DEFAULT 0,
  emergency_name text,
  emergency_phone text,
  emergency_relation text,
  status public.customer_status NOT NULL DEFAULT 'active',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers branch read" ON public.customers FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "customers branch insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "customers branch update" ON public.customers FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "customers manager delete" ON public.customers FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== VEHICLES ==========
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL DEFAULT 'car',
  brand text,
  model text,
  year int,
  color text,
  plate_no text,
  plate_province text DEFAULT 'สุราษฎร์ธานี',
  chassis_no text,
  engine_no text,
  mileage int,
  appraised_value bigint NOT NULL DEFAULT 0,
  book_status public.vehicle_book_status NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles branch read" ON public.vehicles FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "vehicles branch insert" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "vehicles branch update" ON public.vehicles FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "vehicles manager delete" ON public.vehicles FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== LOAN APPLICATIONS ==========
CREATE TABLE public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  code text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  requested_amount bigint NOT NULL DEFAULT 0,
  approved_amount bigint,
  interest_rate numeric(6,3) NOT NULL DEFAULT 1.25,
  term_months int NOT NULL DEFAULT 12,
  fee_amount bigint NOT NULL DEFAULT 0,
  status public.application_status NOT NULL DEFAULT 'draft',
  purpose text,
  note text,
  reject_reason text,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_applications TO authenticated;
GRANT ALL ON public.loan_applications TO service_role;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps branch read" ON public.loan_applications FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "apps branch insert" ON public.loan_applications FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "apps branch update" ON public.loan_applications FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "apps manager delete" ON public.loan_applications FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== CONTRACTS ==========
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  code text NOT NULL UNIQUE,
  application_id uuid REFERENCES public.loan_applications(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  principal bigint NOT NULL DEFAULT 0,
  interest_rate numeric(6,3) NOT NULL DEFAULT 1.25,
  term_months int NOT NULL DEFAULT 12,
  installment_amount bigint NOT NULL DEFAULT 0,
  total_payable bigint NOT NULL DEFAULT 0,
  outstanding bigint NOT NULL DEFAULT 0,
  fee_amount bigint NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  first_due_date date,
  end_date date,
  status public.contract_status NOT NULL DEFAULT 'active',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts branch read" ON public.contracts FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "contracts branch insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "contracts branch update" ON public.contracts FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "contracts manager delete" ON public.contracts FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== INSTALLMENTS ==========
CREATE TABLE public.installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  seq int NOT NULL,
  due_date date NOT NULL,
  principal_amount bigint NOT NULL DEFAULT 0,
  interest_amount bigint NOT NULL DEFAULT 0,
  total_amount bigint NOT NULL DEFAULT 0,
  paid_amount bigint NOT NULL DEFAULT 0,
  penalty_amount bigint NOT NULL DEFAULT 0,
  paid_date date,
  status public.installment_status NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, seq)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installments TO authenticated;
GRANT ALL ON public.installments TO service_role;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inst branch read" ON public.installments FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "inst branch insert" ON public.installments FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "inst branch update" ON public.installments FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "inst manager delete" ON public.installments FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== PAYMENTS ==========
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  receipt_no text NOT NULL UNIQUE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  amount bigint NOT NULL DEFAULT 0,
  principal_part bigint NOT NULL DEFAULT 0,
  interest_part bigint NOT NULL DEFAULT 0,
  penalty_part bigint NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  note text,
  voided boolean NOT NULL DEFAULT false,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay branch read" ON public.payments FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "pay branch insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "pay branch update" ON public.payments FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "pay manager delete" ON public.payments FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== DISBURSEMENTS ==========
CREATE TABLE public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  amount bigint NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  note text,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disbursements TO authenticated;
GRANT ALL ON public.disbursements TO service_role;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disb branch read" ON public.disbursements FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "disb branch insert" ON public.disbursements FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "disb branch update" ON public.disbursements FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "disb manager delete" ON public.disbursements FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== APPROVAL REQUESTS ==========
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  type public.approval_type NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  entity_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status public.approval_status NOT NULL DEFAULT 'pending',
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appr branch read" ON public.approval_requests FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "appr branch insert" ON public.approval_requests FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "appr decide" ON public.approval_requests FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id) AND (public.is_manager() OR public.has_role(auth.uid(),'approver')))
  WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "appr admin delete" ON public.approval_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ========== COLLECTIONS ==========
CREATE TABLE public.collection_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  acted_at date NOT NULL DEFAULT CURRENT_DATE,
  channel text NOT NULL DEFAULT 'phone',
  result text,
  detail text,
  promise_date date,
  next_action_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_activities TO authenticated;
GRANT ALL ON public.collection_activities TO service_role;
ALTER TABLE public.collection_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coll branch read" ON public.collection_activities FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "coll branch insert" ON public.collection_activities FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "coll branch update" ON public.collection_activities FOR UPDATE TO authenticated USING (public.can_access_branch(branch_id)) WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "coll manager delete" ON public.collection_activities FOR DELETE TO authenticated USING (public.can_access_branch(branch_id) AND public.is_manager());

-- ========== DOCUMENTS ==========
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  entity_table text NOT NULL,
  entity_id uuid NOT NULL,
  doc_type text,
  file_path text NOT NULL,
  file_name text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc branch read" ON public.documents FOR SELECT TO authenticated USING (public.can_access_branch(branch_id));
CREATE POLICY "doc branch insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.can_access_branch(branch_id));
CREATE POLICY "doc branch delete" ON public.documents FOR DELETE TO authenticated USING (public.can_access_branch(branch_id));

-- ========== SETTINGS ==========
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== NOTIFICATIONS ==========
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id),
  event_type text NOT NULL,
  title text NOT NULL,
  message text,
  audience text NOT NULL DEFAULT 'staff',
  target_user_id uuid,
  entity_table text,
  entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.notify_status NOT NULL DEFAULT 'queued',
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif read" ON public.notifications FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR branch_id IS NULL OR public.can_access_branch(branch_id));
CREATE POLICY "notif insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "notif update" ON public.notifications FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid() OR public.is_manager()) WITH CHECK (true);

-- ========== AUDIT ==========
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id),
  user_id uuid,
  action text NOT NULL,
  entity_table text,
  entity_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_hq(auth.uid()) OR public.can_access_branch(branch_id));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ========== BACKUPS ==========
CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  file_path text,
  size_bytes bigint,
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup read" ON public.backup_runs FOR SELECT TO authenticated USING (public.is_hq(auth.uid()));
CREATE POLICY "backup admin write" ON public.backup_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== TRIGGERS ==========
CREATE TRIGGER t_branches_upd BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_customers_upd BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_vehicles_upd BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_apps_upd BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_contracts_upd BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_inst_upd BEFORE UPDATE ON public.installments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_appr_upd BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== INDEXES ==========
CREATE INDEX idx_customers_branch ON public.customers(branch_id);
CREATE INDEX idx_vehicles_customer ON public.vehicles(customer_id);
CREATE INDEX idx_apps_branch ON public.loan_applications(branch_id, status);
CREATE INDEX idx_contracts_branch ON public.contracts(branch_id, status);
CREATE INDEX idx_inst_contract ON public.installments(contract_id, seq);
CREATE INDEX idx_inst_due ON public.installments(due_date, status);
CREATE INDEX idx_pay_contract ON public.payments(contract_id);
CREATE INDEX idx_appr_status ON public.approval_requests(status, branch_id);

-- ========== DOC NUMBER GENERATOR ==========
CREATE TABLE public.doc_counters (
  branch_id uuid NOT NULL,
  doc_type text NOT NULL,
  period text NOT NULL,
  last_no int NOT NULL DEFAULT 0,
  PRIMARY KEY (branch_id, doc_type, period)
);
GRANT SELECT ON public.doc_counters TO authenticated;
GRANT ALL ON public.doc_counters TO service_role;
ALTER TABLE public.doc_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters read" ON public.doc_counters FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_doc_no(_branch uuid, _doc_type text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text; n int; bcode text;
BEGIN
  IF NOT public.can_access_branch(_branch) THEN RAISE EXCEPTION 'ไม่มีสิทธิ์ในสาขานี้'; END IF;
  p := to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM');
  SELECT code INTO bcode FROM public.branches WHERE id = _branch;
  INSERT INTO public.doc_counters (branch_id, doc_type, period, last_no)
  VALUES (_branch, _doc_type, p, 1)
  ON CONFLICT (branch_id, doc_type, period) DO UPDATE SET last_no = public.doc_counters.last_no + 1
  RETURNING last_no INTO n;
  RETURN _doc_type || '-' || COALESCE(bcode,'XX') || p || '-' || lpad(n::text, 4, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.next_doc_no(uuid, text) TO authenticated;

-- ========== SEED ==========
INSERT INTO public.branches (code, name, district, is_hq) VALUES
 ('HQ','สำนักงานใหญ่ (อ.เมือง)','เมืองสุราษฎร์ธานี', true),
 ('B01','สาขาพุนพิน','พุนพิน', false),
 ('B02','สาขากาญจนดิษฐ์','กาญจนดิษฐ์', false),
 ('B03','สาขาเกาะสมุย','เกาะสมุย', false),
 ('B04','สาขาไชยา','ไชยา', false),
 ('B05','สาขาท่าฉาง','ท่าฉาง', false),
 ('B06','สาขาบ้านนาสาร','บ้านนาสาร', false),
 ('B07','สาขาเวียงสระ','เวียงสระ', false),
 ('B08','สาขาพระแสง','พระแสง', false),
 ('B09','สาขาคีรีรัฐนิคม','คีรีรัฐนิคม', false),
 ('B10','สาขาดอนสัก','ดอนสัก', false);

INSERT INTO public.system_settings (key, value, description) VALUES
 ('loan_defaults', '{"interest_rate":1.25,"terms":[12,18,24,36],"penalty_rate_per_day":0.05,"fee_percent":1.0,"ltv_car":0.7,"ltv_motorcycle":0.5,"branch_approval_limit":300000}', 'ค่าเริ่มต้นการคำนวณสินเชื่อ'),
 ('company', '{"name":"ธารทรัพย์ สินเชื่อรถยนต์ รถจักรยานยนต์","address":"อ.เมือง จ.สุราษฎร์ธานี","phone":"","tax_id":""}', 'ข้อมูลบริษัทสำหรับเอกสาร'),
 ('notify', '{"webhook_url":"","enabled_events":["approval_requested","approval_decided","loan_approved","payment_due","overdue","backup_result","maintenance"]}', 'ตั้งค่าการแจ้งเตือน/Webhook');