-- Move LINE notification recipients out of readable system_settings into integration_secrets.
-- Idempotent and preserves legacy config fields except plaintext `to`.

WITH cfg AS (
  SELECT value
  FROM public.system_settings
  WHERE key = 'line_notify'
), recipients AS (
  SELECT array_to_string(
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(value -> 'to')),
      ARRAY[]::text[]
    ),
    ','
  ) AS raw
  FROM cfg
)
INSERT INTO public.integration_secrets (key, label, category, value, updated_at)
SELECT 'LINE_NOTIFY_RECIPIENTS', 'LINE Notify – Recipients', 'line_oa', raw, now()
FROM recipients
WHERE btrim(COALESCE(raw, '')) <> ''
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    category = EXCLUDED.category,
    value = CASE
      WHEN btrim(EXCLUDED.value) <> '' THEN EXCLUDED.value
      ELSE public.integration_secrets.value
    END,
    updated_at = now();

UPDATE public.system_settings
SET value = (COALESCE(value, '{}'::jsonb) - 'to')
            || jsonb_build_object('recipients_source', 'integration_secrets'),
    updated_at = now()
WHERE key = 'line_notify';
