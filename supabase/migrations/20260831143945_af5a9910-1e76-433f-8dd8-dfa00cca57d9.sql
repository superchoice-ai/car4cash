-- 1) Revoke blanket EXECUTE from PUBLIC and anon on all public functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- 2) Revoke EXECUTE from authenticated on internal-only functions
REVOKE ALL ON FUNCTION public.guard_collection_contract_lifecycle() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_contract_cancel_request() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_contract_first_payment_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_payment_void_request() FROM authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.mark_contract_payment_event() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_payment_physical_delete() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.mask_secret(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.perform_contract_cancel(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.perform_payment_void(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.execute_approval_request_phase_a_contract_cancel(uuid, boolean, text) FROM authenticated;

-- 3) Keep EXECUTE for signed-in users on functions the app / RLS policies need
GRANT EXECUTE ON FUNCTION public.can_access_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hq(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_doc_no(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.global_customer_history_search(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_approval_request(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_integration_secrets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_integration_secret(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_integration_secret(text) TO authenticated;

-- 4) service_role keeps full access for server-side/admin paths
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;