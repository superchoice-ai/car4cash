CREATE TABLE IF NOT EXISTS public.integration_secrets (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  value text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.integration_secrets TO service_role;
ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
-- ไม่มี policy สำหรับ authenticated: เข้าถึงได้ผ่านฟังก์ชันที่ควบคุมสิทธิ์เท่านั้น

CREATE OR REPLACE FUNCTION public.mask_secret(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _v IS NULL OR length(_v) = 0 THEN ''
    WHEN length(_v) <= 4 THEN repeat('•', length(_v))
    ELSE repeat('•', LEAST(length(_v) - 4, 24)) || right(_v, 4)
  END
$$;

CREATE OR REPLACE FUNCTION public.list_integration_secrets()
RETURNS TABLE (key text, label text, category text, masked text, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.key, s.label, s.category, public.mask_secret(s.value), s.updated_at
  FROM public.integration_secrets s
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY s.category, s.label
$$;

CREATE OR REPLACE FUNCTION public.set_integration_secret(_key text, _label text, _category text, _value text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกคีย์ได้';
  END IF;
  IF _value IS NULL OR length(btrim(_value)) = 0 THEN
    RAISE EXCEPTION 'กรุณาระบุค่าคีย์';
  END IF;
  INSERT INTO public.integration_secrets (key, label, category, value, updated_by, updated_at)
  VALUES (btrim(_key), _label, COALESCE(NULLIF(_category,''),'general'), btrim(_value), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET label = EXCLUDED.label, category = EXCLUDED.category, value = EXCLUDED.value,
        updated_by = auth.uid(), updated_at = now();
  SELECT public.mask_secret(btrim(_value)) INTO m;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.delete_integration_secret(_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบคีย์ได้';
  END IF;
  DELETE FROM public.integration_secrets WHERE key = _key;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.list_integration_secrets() FROM public;
REVOKE ALL ON FUNCTION public.set_integration_secret(text,text,text,text) FROM public;
REVOKE ALL ON FUNCTION public.delete_integration_secret(text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_integration_secrets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_integration_secret(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_integration_secret(text) TO authenticated;