-- Fix Thai text global-history search so non-numeric queries do not match every national ID/phone via LIKE '%%'.
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
  WHERE auth.uid() IS NOT NULL
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
  WHERE auth.uid() IS NOT NULL
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

GRANT EXECUTE ON FUNCTION public.global_customer_history_search(text) TO authenticated;
