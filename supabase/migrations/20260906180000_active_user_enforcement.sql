-- Active-user enforcement for every authenticated business-data path.
-- Service-role operations remain unchanged; inactive users are denied by RLS
-- and by every client-callable SECURITY DEFINER path.

CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND active = true
      )
$$;

REVOKE ALL ON FUNCTION public.is_current_user_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO authenticated;

-- Keep the existing branch/role semantics while making account activity a
-- mandatory prerequisite for callable helpers and approval workflows.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_user_active()
     AND EXISTS (
       SELECT 1
       FROM public.user_roles
       WHERE user_id = _user_id
         AND role = _role
     )
$$;

CREATE OR REPLACE FUNCTION public.is_hq(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_user_active()
     AND (
       EXISTS (
         SELECT 1
         FROM public.user_roles
         WHERE user_id = _user_id
           AND role = 'admin'
       )
       OR EXISTS (
         SELECT 1
         FROM public.profiles p
         JOIN public.branches b ON b.id = p.branch_id
         WHERE p.id = _user_id
           AND b.is_hq
       )
     )
$$;

CREATE OR REPLACE FUNCTION public.my_branch(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id
  FROM public.profiles
  WHERE id = _user_id
    AND public.is_current_user_active()
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_branch uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_user_active()
     AND auth.uid() IS NOT NULL
     AND (
       public.is_hq(auth.uid())
       OR _branch = public.my_branch(auth.uid())
     )
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_current_user_active()
     AND (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'manager')
     )
$$;

-- A restrictive policy is AND-ed with every existing permissive policy. Apply
-- it to every current public table that already has RLS enabled, so branch,
-- approval, finance, audit, settings, legacy-import and support tables share
-- the same active-user prerequisite without rewriting their business policies.
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'active authenticated users only',
      target.relname
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_current_user_active()) WITH CHECK (public.is_current_user_active())',
      'active authenticated users only',
      target.relname
    );
  END LOOP;
END
$$;

-- Recreate the two authenticated search RPCs that otherwise read across
-- branches as SECURITY DEFINER and therefore do not depend on table RLS.
CREATE OR REPLACE FUNCTION public.global_customer_history_search(_q text)
RETURNS TABLE (
  person_id uuid,
  full_name text,
  national_id text,
  phone text,
  line_id text,
  branch_name text,
  branch_code text,
  history_type text,
  reference_no text,
  status text,
  event_date timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH needle AS (
  SELECT lower(trim(coalesce(_q,''))) AS q,
         regexp_replace(coalesce(_q,''),'\D','','g') AS digits
), borrower AS (
  SELECT c.id AS person_id,
         c.full_name,
         c.national_id,
         c.phone,
         c.line_id,
         b.name AS branch_name,
         b.code AS branch_code,
         'borrower'::text AS history_type,
         coalesce(ct.code, la.code, c.code) AS reference_no,
         coalesce(ct.status::text, la.status::text, c.status::text) AS status,
         coalesce(ct.created_at, la.created_at, c.created_at) AS event_date
  FROM public.customers c
  JOIN public.branches b ON b.id = c.branch_id
  LEFT JOIN public.loan_applications la ON la.customer_id = c.id
  LEFT JOIN public.contracts ct ON ct.application_id = la.id
  CROSS JOIN needle n
  WHERE public.is_current_user_active()
    AND n.q <> ''
    AND (
      lower(c.full_name) LIKE '%' || n.q || '%'
      OR (n.digits <> '' AND coalesce(c.national_id,'') LIKE '%' || n.digits || '%')
      OR (n.digits <> '' AND coalesce(c.phone,'') LIKE '%' || n.digits || '%')
      OR lower(coalesce(c.line_id,'')) LIKE '%' || n.q || '%'
    )
), guarantor AS (
  SELECT g.customer_id AS person_id,
         g.full_name,
         g.national_id,
         g.phone,
         g.line_id,
         b.name AS branch_name,
         b.code AS branch_code,
         'guarantor'::text AS history_type,
         la.code AS reference_no,
         la.status::text AS status,
         g.created_at AS event_date
  FROM public.loan_guarantors g
  JOIN public.branches b ON b.id = g.branch_id
  JOIN public.loan_applications la ON la.id = g.application_id
  CROSS JOIN needle n
  WHERE public.is_current_user_active()
    AND n.q <> ''
    AND (
      lower(g.full_name) LIKE '%' || n.q || '%'
      OR (n.digits <> '' AND coalesce(g.national_id,'') LIKE '%' || n.digits || '%')
      OR (n.digits <> '' AND coalesce(g.phone,'') LIKE '%' || n.digits || '%')
      OR lower(coalesce(g.line_id,'')) LIKE '%' || n.q || '%'
    )
), all_rows AS (
  SELECT * FROM borrower
  UNION ALL
  SELECT * FROM guarantor
)
SELECT * FROM all_rows
ORDER BY event_date DESC NULLS LAST
LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.global_customer_history_search(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_customer_history_search(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_customer_identity_duplicate(
  _national_id text,
  _phone text,
  _exclude_customer_id uuid DEFAULT NULL
)
RETURNS TABLE(
  conflict_field text,
  customer_id uuid,
  customer_code text,
  customer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_national_id text := regexp_replace(COALESCE(_national_id, ''), '\D', '', 'g');
  v_phone text := regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
BEGIN
  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Account inactive';
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN v_national_id <> '' AND regexp_replace(COALESCE(c.national_id, ''), '\D', '', 'g') = v_national_id THEN 'national_id'
      ELSE 'phone'
    END,
    c.id,
    c.code,
    c.full_name
  FROM public.customers c
  WHERE (_exclude_customer_id IS NULL OR c.id <> _exclude_customer_id)
    AND (
      (v_national_id <> '' AND regexp_replace(COALESCE(c.national_id, ''), '\D', '', 'g') = v_national_id)
      OR
      (v_phone <> '' AND regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g') = v_phone)
    )
  ORDER BY
    CASE WHEN v_national_id <> '' AND regexp_replace(COALESCE(c.national_id, ''), '\D', '', 'g') = v_national_id THEN 0 ELSE 1 END,
    c.created_at
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.check_customer_identity_duplicate(text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_customer_identity_duplicate(text,text,uuid) TO authenticated;

