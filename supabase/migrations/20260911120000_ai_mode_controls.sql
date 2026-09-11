-- AI Mode controls are stored in the existing system_settings table.
-- Existing RLS already permits authenticated reads and restricts writes to Admin.
-- Default ON preserves existing behavior until an Admin deliberately disables a channel.
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'ai_modes',
  '{"chat_tools":true,"external_mcp":true,"assistant":true}'::jsonb,
  'ควบคุมการเปิด/ปิดช่องทาง AI: แชท tools/LINE, MCP ภายนอก และผู้ช่วย AI'
)
ON CONFLICT (key) DO NOTHING;
