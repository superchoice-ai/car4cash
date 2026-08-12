-- Operational search + approval workflow implementation
-- 2026-08-12 approved baseline

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
    SELECT lower(trim(coalesce(_q,''))) q
  ), borrower AS (
    SELECT c.id person_id, c.full_name, c.national_id, c.phone, c.line_id,
           b.name branch_name, b.code branch_code,
           'borrower'::text history_type,
           coalesce(ct.code, la.code, c.code) reference_no,
           coalesce(ct.status::text, la.status::text, c.status::text) status,
           coalesce(ct.created_at, la.created_at, c.created_at) event_date
    FROM customers c
    JOIN branches b ON b.id = c.branch_id
    LEFT JOIN loan_applications la ON la.customer_id = c.id
    LEFT JOIN contracts ct ON ct.application_id = la.id
    CROSS JOIN needle n
    WHERE auth.uid() IS NOT NULL
      AND n.q <> ''
      AND (
        lower(c.full_name) LIKE '%'||n.q||'%' OR
        coalesce(c.national_id,'') LIKE '%'||regexp_replace(n.q,'\\D','','g')||'%' OR
        coalesce(c.phone,'') LIKE '%'||regexp_replace(n.q,'\\D','','g')||'%' OR
        lower(coalesce(c.line_id,'')) LIKE '%'||n.q||'%'
      )
  ), guarantor AS (
    SELECT g.customer_id person_id, g.full_name, g.national_id, g.phone, g.line_id,
           b.name branch_name, b.code branch_code,
           'guarantor'::text history_type,
           la.code reference_no,
           la.status::text status,
           g.created_at event_date
    FROM loan_guarantors g
    JOIN branches b ON b.id = g.branch_id
    JOIN loan_applications la ON la.id = g.application_id
    CROSS JOIN needle n
    WHERE auth.uid() IS NOT NULL
      AND n.q <> ''
      AND (
        lower(g.full_name) LIKE '%'||n.q||'%' OR
        coalesce(g.national_id,'') LIKE '%'||regexp_replace(n.q,'\\D','','g')||'%' OR
        coalesce(g.phone,'') LIKE '%'||regexp_replace(n.q,'\\D','','g')||'%' OR
        lower(coalesce(g.line_id,'')) LIKE '%'||n.q||'%'
      )
  )
  SELECT * FROM borrower
  UNION ALL
  SELECT * FROM guarantor
  ORDER BY event_date DESC NULLS LAST
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.global_customer_history_search(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.execute_approval_request(_approval_id uuid, _approve boolean, _decision_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req approval_requests%ROWTYPE;
  actor uuid := auth.uid();
  op text;
  active_count int;
  payment_count int;
  p jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  IF NOT (public.is_manager() OR public.has_role(actor,'approver')) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์อนุมัติรายการ';
  END IF;

  SELECT * INTO req FROM approval_requests WHERE id = _approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบคำขออนุมัติ'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'รายการนี้ถูกพิจารณาแล้ว'; END IF;
  IF NOT public.can_access_branch(req.branch_id) THEN RAISE EXCEPTION 'ไม่มีสิทธิ์ในสาขานี้'; END IF;

  UPDATE approval_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      decided_by = actor, decided_at = now(), decision_note = nullif(trim(_decision_note),'')
  WHERE id = req.id;

  IF NOT _approve THEN
    INSERT INTO audit_logs(branch_id,user_id,action,entity_table,entity_id,detail)
    VALUES(req.branch_id,actor,'approval_rejected',req.entity_table,req.entity_id,jsonb_build_object('approval_id',req.id,'note',_decision_note));
    RETURN jsonb_build_object('ok',true,'executed',false,'status','rejected');
  END IF;

  p := coalesce(req.payload,'{}'::jsonb);
  op := coalesce(p->>'operation','');

  IF req.entity_table = 'customers' AND op = 'deactivate' THEN
    SELECT count(*) INTO active_count FROM contracts WHERE customer_id=req.entity_id AND status <> 'closed';
    IF active_count > 0 THEN RAISE EXCEPTION 'ยังมีบัญชีที่ไม่ปิด ไม่สามารถปรับลูกค้าเป็นไม่ใช้งานได้'; END IF;
    UPDATE customers SET status='inactive' WHERE id=req.entity_id;

  ELSIF req.entity_table = 'customers' AND op = 'edit' THEN
    UPDATE customers SET
      full_name = coalesce(p->'changes'->>'full_name', full_name),
      national_id = coalesce(p->'changes'->>'national_id', national_id),
      phone = coalesce(p->'changes'->>'phone', phone),
      line_id = coalesce(p->'changes'->>'line_id', line_id),
      document_no = coalesce(p->'changes'->>'document_no', document_no),
      address = coalesce(p->'changes'->>'address', address),
      occupation = coalesce(p->'changes'->>'occupation', occupation)
    WHERE id=req.entity_id;

  ELSIF req.entity_table = 'loan_applications' AND op = 'cancel' THEN
    SELECT count(*) INTO active_count FROM contracts WHERE application_id=req.entity_id AND status <> 'closed';
    IF active_count > 0 THEN RAISE EXCEPTION 'บัญชียังไม่ปิด ไม่สามารถยกเลิกคำขอสินเชื่อได้'; END IF;
    UPDATE loan_applications SET status='cancelled' WHERE id=req.entity_id;

  ELSIF req.entity_table = 'loan_applications' AND op = 'edit' THEN
    SELECT count(*) INTO payment_count
      FROM payments pmt JOIN contracts ct ON ct.id=pmt.contract_id
      WHERE ct.application_id=req.entity_id AND pmt.voided=false;
    IF payment_count > 0 AND (
      (p->'changes' ? 'requested_amount') OR (p->'changes' ? 'approved_amount') OR
      (p->'changes' ? 'interest_rate') OR (p->'changes' ? 'term_months')
    ) THEN RAISE EXCEPTION 'มีการชำระแล้วอย่างน้อย 1 งวด จึงล็อกวงเงินต้น ดอกเบี้ย และจำนวนงวด'; END IF;

    UPDATE loan_applications SET
      requested_amount = coalesce((p->'changes'->>'requested_amount')::bigint, requested_amount),
      approved_amount = coalesce((p->'changes'->>'approved_amount')::bigint, approved_amount),
      interest_rate = coalesce((p->'changes'->>'interest_rate')::numeric, interest_rate),
      term_months = coalesce((p->'changes'->>'term_months')::int, term_months),
      purpose = coalesce(p->'changes'->>'purpose', purpose),
      document_no = coalesce(p->'changes'->>'document_no', document_no)
    WHERE id=req.entity_id;
  END IF;

  INSERT INTO audit_logs(branch_id,user_id,action,entity_table,entity_id,detail)
  VALUES(req.branch_id,actor,'approval_executed',req.entity_table,req.entity_id,
         jsonb_build_object('approval_id',req.id,'operation',op,'payload',p,'note',_decision_note));

  RETURN jsonb_build_object('ok',true,'executed',true,'status','approved','operation',op);
END;
$$;
GRANT EXECUTE ON FUNCTION public.execute_approval_request(uuid,boolean,text) TO authenticated;
