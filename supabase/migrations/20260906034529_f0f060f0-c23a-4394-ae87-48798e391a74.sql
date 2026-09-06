ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_line_user_id_key ON public.profiles (line_user_id) WHERE line_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hq uuid; first_user boolean;
BEGIN
  SELECT id INTO hq FROM public.branches WHERE is_hq LIMIT 1;
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO first_user;
  INSERT INTO public.profiles (id, full_name, email, branch_id, line_user_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email, hq,
          NULLIF(btrim(NEW.raw_user_meta_data->>'line_user_id'), ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'staff'::public.app_role END);
  RETURN NEW;
END; $function$;

UPDATE public.profiles p
SET line_user_id = NULLIF(btrim(u.raw_user_meta_data->>'line_user_id'), '')
FROM auth.users u
WHERE u.id = p.id AND p.line_user_id IS NULL AND NULLIF(btrim(u.raw_user_meta_data->>'line_user_id'), '') IS NOT NULL;