-- Complete executable approval semantics and dependent-data consistency.
-- Replaces the first implementation without weakening RLS.

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
  new_requested bigint;
  new_approved bigint;
  new_rate numeric;
  new_term int;
  ctr contracts%ROWTYPE;
  v_principal bigint;
  v_interest_per_month bigint;
  v_total_payable bigint;
  v_installment bigint;
  v_principal_per_month bigint;
  v_principal_left bigint;
  v_paid_total bigint;
  v_seq_no int;
  v_row_principal bigint;
  v_row_total bigint;
  v_row_interest bigint;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Unauthenticated'; END IF;
  IF NOT (public.is_manager() OR public.has_role(actor,'approver')) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์อนุมัติรายการ';
  END IF;

  SELECT * INTO req FROM approval_requests WHERE id = _approval_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบคำขออนุมัติ'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'รายการนี้ถูกพิจารณาแล้ว'; END IF;
  IF NOT public.can_access_branch(req.branch_id) THEN RAISE EXCEPTION 'ไม่มีสิทธิ์ในสาขานี้'; END IF;

  p := coalesce(req.payload,'{}'::jsonb);
  op := coalesce(p->>'operation','');

  IF NOT _approve THEN
    UPDATE approval_requests SET status='rejected', decided_by=actor, decided_at=now(), decision_note=nullif(trim(_decision_note),'') WHERE id=req.id;
    INSERT INTO audit_logs(branch_id,user_id,action,entity_table,entity_id,detail)
    VALUES(req.branch_id,actor,'approval_rejected',req.entity_table,req.entity_id,jsonb_build_object('approval_id',req.id,'note',_decision_note));
    RETURN jsonb_build_object('ok',true,'executed',false,'status','rejected');
  END IF;

  IF req.type = 'loan_approval' AND req.entity_table = 'loan_applications' THEN
    UPDATE loan_applications
      SET status='approved',
          approved_amount=coalesce(approved_amount,requested_amount),
          approved_by=actor,
          approved_at=now()
      WHERE id=req.entity_id AND status IN ('submitted','pending_approval');

  ELSIF req.entity_table = 'customers' AND op = 'deactivate' THEN
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

    UPDATE loan_guarantors g SET
      full_name = c.full_name,
      national_id = c.national_id,
      phone = c.phone,
      line_id = c.line_id,
      updated_at = now()
    FROM customers c
    WHERE c.id=req.entity_id AND g.customer_id=c.id;

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
    WHERE id=req.entity_id
    RETURNING requested_amount,approved_amount,interest_rate,term_months
      INTO new_requested,new_approved,new_rate,new_term;

    FOR ctr IN SELECT * FROM contracts WHERE application_id=req.entity_id FOR UPDATE LOOP
      SELECT count(*) INTO payment_count FROM payments WHERE contract_id=ctr.id AND voided=false;
      IF payment_count = 0 THEN
        v_principal := coalesce(new_approved,new_requested);
        v_interest_per_month := round(v_principal * new_rate / 100.0);
        v_total_payable := v_principal + v_interest_per_month * new_term;
        v_installment := round(v_total_payable::numeric / greatest(new_term,1));
        v_principal_per_month := floor(v_principal::numeric / greatest(new_term,1));

        UPDATE contracts c SET
          principal=v_principal,
          interest_rate=new_rate,
          term_months=new_term,
          installment_amount=v_installment,
          total_payable=v_total_payable,
          outstanding=v_total_payable,
          end_date=(coalesce(ctr.first_due_date,ctr.start_date) + ((new_term-1)||' months')::interval)::date
        WHERE c.id=ctr.id;

        DELETE FROM installments i WHERE i.contract_id=ctr.id;
        v_principal_left := v_principal;
        v_paid_total := 0;
        FOR v_seq_no IN 1..new_term LOOP
          IF v_seq_no = new_term THEN
            v_row_principal := v_principal_left;
            v_row_total := v_total_payable - v_paid_total;
          ELSE
            v_row_principal := v_principal_per_month;
            v_row_total := v_installment;
          END IF;
          v_row_interest := v_row_total - v_row_principal;
          INSERT INTO installments(branch_id,contract_id,seq,due_date,principal_amount,interest_amount,total_amount)
          VALUES(ctr.branch_id,ctr.id,v_seq_no,(coalesce(ctr.first_due_date,ctr.start_date)+((v_seq_no-1)||' months')::interval)::date,v_row_principal,v_row_interest,v_row_total);
          v_principal_left := v_principal_left - v_row_principal;
          v_paid_total := v_paid_total + v_row_total;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  UPDATE approval_requests SET status='approved', decided_by=actor, decided_at=now(), decision_note=nullif(trim(_decision_note),'') WHERE id=req.id;
  INSERT INTO audit_logs(branch_id,user_id,action,entity_table,entity_id,detail)
  VALUES(req.branch_id,actor,'approval_executed',req.entity_table,req.entity_id,
         jsonb_build_object('approval_id',req.id,'type',req.type,'operation',op,'payload',p,'note',_decision_note));

  RETURN jsonb_build_object('ok',true,'executed',true,'status','approved','operation',op,'type',req.type);
END;
$$;
GRANT EXECUTE ON FUNCTION public.execute_approval_request(uuid,boolean,text) TO authenticated;
