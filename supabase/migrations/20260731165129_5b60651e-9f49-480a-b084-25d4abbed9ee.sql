REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_hq(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_branch(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_branch(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.next_doc_no(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hq(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_doc_no(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "notif insert" ON public.notifications;
DROP POLICY IF EXISTS "notif update" ON public.notifications;
CREATE POLICY "notif insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (branch_id IS NULL OR public.can_access_branch(branch_id));
CREATE POLICY "notif update" ON public.notifications FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid() OR public.is_manager())
  WITH CHECK (target_user_id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "appr decide" ON public.approval_requests;
CREATE POLICY "appr decide" ON public.approval_requests FOR UPDATE TO authenticated
  USING (public.can_access_branch(branch_id) AND (public.is_manager() OR public.has_role(auth.uid(),'approver')))
  WITH CHECK (public.can_access_branch(branch_id) AND (public.is_manager() OR public.has_role(auth.uid(),'approver')));