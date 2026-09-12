-- Keep a rejected loan approval and its application status consistent.
-- This is intentionally scoped to loan_approval only; all other approval
-- workflows retain their existing rejection behavior.

CREATE OR REPLACE FUNCTION public.reflect_rejected_loan_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF OLD.status = 'pending'
     AND NEW.status = 'rejected'
     AND NEW.type = 'loan_approval'
     AND NEW.entity_table = 'loan_applications'
     AND NEW.entity_id IS NOT NULL THEN

    UPDATE public.loan_applications
    SET status = 'rejected',
        updated_at = now()
    WHERE id = NEW.entity_id
      AND status = 'pending_approval';

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'คำขอสินเชื่อไม่อยู่ในสถานะรออนุมัติ หรือไม่พบข้อมูล';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reflect_rejected_loan_approval() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reflect_rejected_loan_approval() FROM authenticated;

DROP TRIGGER IF EXISTS trg_reflect_rejected_loan_approval
ON public.approval_requests;

CREATE TRIGGER trg_reflect_rejected_loan_approval
AFTER UPDATE OF status ON public.approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.reflect_rejected_loan_approval();

