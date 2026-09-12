-- Customer master identity integrity.
-- UI duplicate checks are intentionally consumed only by Dashboard wizard and Customer screen.
-- Database indexes are the concurrency-safe final backstop for every write path.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.customers
    WHERE NULLIF(regexp_replace(COALESCE(national_id, ''), '\D', '', 'g'), '') IS NOT NULL
    GROUP BY regexp_replace(COALESCE(national_id, ''), '\D', '', 'g')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce customer national_id uniqueness: existing duplicates found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customers
    WHERE NULLIF(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '') IS NOT NULL
    GROUP BY regexp_replace(COALESCE(phone, ''), '\D', '', 'g')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce customer phone uniqueness: existing duplicates found';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS customers_national_id_normalized_uidx
  ON public.customers ((regexp_replace(COALESCE(national_id, ''), '\D', '', 'g')))
  WHERE NULLIF(regexp_replace(COALESCE(national_id, ''), '\D', '', 'g'), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_normalized_uidx
  ON public.customers ((regexp_replace(COALESCE(phone, ''), '\D', '', 'g')))
  WHERE NULLIF(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '') IS NOT NULL;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated';
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

REVOKE ALL ON FUNCTION public.check_customer_identity_duplicate(text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_customer_identity_duplicate(text,text,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_customer_identity_duplicate(text,text,uuid) TO authenticated;

