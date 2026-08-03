DO $$
DECLARE
  b RECORD;
  v_first text[] := ARRAY['สมชาย','สุนิสา','ประเสริฐ','วิภาวดี','ธนากร','ปรีชา','กัลยา','อนุชา','ศิริพร','ณัฐพงษ์','จันทร์เพ็ญ','วีระชัย','พรทิพย์','สมพงษ์','อรวรรณ','ชัยวัฒน์','เบญจวรรณ','ธีรยุทธ','มะลิวัลย์','สุรชัย','กนกวรรณ','ภาณุพงศ์','รัตนา','ยุทธนา','ดวงใจ','อภิชาติ'];
  v_last  text[] := ARRAY['ทองใส','แซ่ลิ้ม','ชูเมือง','พรหมเมือง','สุขสำราญ','ขาวสนิท','เพชรรัตน์','ไชยยศ','นาคสุวรรณ','บุญมาก','ศรีสุข','ด้วงคง','จันทร์แก้ว','รอดภัย','คงทอง','เรืองฤทธิ์','อินทร์จันทร์','ช่วยบำรุง','หนูเพชร','แก้วมณี','พูลสวัสดิ์','สงวนศักดิ์','ทิพย์รัตน์','มากมณี','เกิดทอง','ฉิมพลี'];
  v_brand text[] := ARRAY['Toyota','Isuzu','Honda','Nissan','Mitsubishi','Ford','Mazda','Chevrolet'];
  v_model text[] := ARRAY['Vios','D-Max','City','Almera','Triton','Ranger','BT-50','Colorado'];
  v_color text[] := ARRAY['ขาว','เทา','ดำ','บรอนซ์เงิน','แดง','น้ำเงิน'];
  v_occ   text[] := ARRAY['ค้าขาย','รับจ้างทั่วไป','เกษตรกร (สวนปาล์ม)','เกษตรกร (สวนยาง)','พนักงานบริษัท','ข้าราชการ','ขับรถรับจ้าง','เจ้าของร้านอาหาร'];
  v_dist  text[] := ARRAY['พุนพิน','เมืองสุราษฎร์ธานี','บ้านนาสาร','เวียงสระ','กาญจนดิษฐ์','ท่าฉาง'];
  n_cust int; i int; j int;
  cust_id uuid; veh_id uuid; app_id uuid; ctr_id uuid; ins_id uuid; pay_id uuid; entry_id uuid;
  principal bigint; rate numeric; term int; inst_amt bigint; total_pay bigint; outstanding bigint;
  start_d date; due_d date; paid_cnt int; st text; app_status text;
  p_part bigint; i_part bigint; pen bigint; ins_fee bigint; reg_fee bigint; fu_fee bigint; tot bigint;
  seq_no int := 0; doc int := 0;
  name_full text;
BEGIN
  FOR b IN SELECT id, code, name, is_hq FROM public.branches WHERE code IN ('HQ','B06') ORDER BY code DESC LOOP
    n_cust := CASE WHEN b.code = 'HQ' THEN 24 ELSE 12 END;

    FOR i IN 1..n_cust LOOP
      seq_no := seq_no + 1;
      name_full := v_first[1 + (seq_no * 7) % array_length(v_first,1)] || ' ' || v_last[1 + (seq_no * 5) % array_length(v_last,1)];

      INSERT INTO public.customers (branch_id, code, full_name, national_id, phone, phone2, address, district, province,
                                    postcode, occupation, monthly_income, emergency_name, emergency_phone, emergency_relation, status, note)
      VALUES (b.id,
              'CUS-' || b.code || '-' || lpad(i::text,4,'0'),
              name_full,
              '1' || lpad(((seq_no * 8419) % 1000000000000)::text, 12, '0'),
              '08' || lpad(((seq_no * 137) % 100000000)::text, 8, '0'),
              NULL,
              (10 + (seq_no % 200))::text || ' หมู่ ' || (1 + seq_no % 9)::text || ' ต.' || v_dist[1 + seq_no % array_length(v_dist,1)],
              v_dist[1 + seq_no % array_length(v_dist,1)],
              'สุราษฎร์ธานี', '84' || lpad(((seq_no*13) % 200)::text,3,'0'),
              v_occ[1 + seq_no % array_length(v_occ,1)],
              (12000 + (seq_no % 20) * 1500)::bigint * 100,
              v_first[1 + (seq_no*3) % array_length(v_first,1)] || ' ' || v_last[1 + (seq_no*2) % array_length(v_last,1)],
              '09' || lpad(((seq_no * 331) % 100000000)::text, 8, '0'),
              'ญาติ',
              (CASE WHEN b.code='HQ' AND i IN (23,24) THEN 'blacklist' ELSE 'active' END)::public.customer_status,
              CASE WHEN b.code='HQ' AND i IN (23,24) THEN 'ผิดนัดชำระต่อเนื่อง ไม่ติดต่อกลับ' ELSE NULL END)
      RETURNING id INTO cust_id;

      INSERT INTO public.vehicles (branch_id, customer_id, vehicle_type, brand, model, year, color, plate_no, plate_province,
                                   chassis_no, engine_no, mileage, appraised_value, book_status)
      VALUES (b.id, cust_id, CASE WHEN seq_no % 5 = 0 THEN 'motorcycle' ELSE 'car' END,
              v_brand[1 + seq_no % array_length(v_brand,1)],
              v_model[1 + seq_no % array_length(v_model,1)],
              2012 + (seq_no % 11),
              v_color[1 + seq_no % array_length(v_color,1)],
              chr(3585 + (seq_no % 40)) || chr(3585 + ((seq_no*3) % 40)) || ' ' || lpad(((seq_no * 77) % 9999)::text,4,'0'),
              'สุราษฎร์ธานี',
              'MR0' || lpad(((seq_no*9173) % 100000000)::text,8,'0'),
              'EG' || lpad(((seq_no*577) % 1000000)::text,6,'0'),
              40000 + (seq_no * 3137) % 180000,
              ((120000 + (seq_no % 12) * 35000)::bigint) * 100,
              'received')
      RETURNING id INTO veh_id;

      principal := ((60000 + (seq_no % 10) * 20000)::bigint) * 100;
      rate := 1.25;
      term := (ARRAY[12,18,24,36])[1 + seq_no % 4];
      inst_amt := ((principal + (principal * rate / 100 * term)::bigint) / term)::bigint;
      total_pay := inst_amt * term;

      app_status := CASE
        WHEN b.code='HQ' AND i = 21 THEN 'pending_approval'
        WHEN b.code='HQ' AND i = 22 THEN 'submitted'
        WHEN b.code='HQ' AND i = 23 THEN 'rejected'
        ELSE 'contracted' END;

      INSERT INTO public.loan_applications (branch_id, code, customer_id, vehicle_id, requested_amount, approved_amount,
                                            interest_rate, term_months, fee_amount, status, purpose, note)
      VALUES (b.id, 'APP-' || b.code || '-' || lpad(i::text,4,'0'), cust_id, veh_id, principal,
              CASE WHEN app_status = 'contracted' THEN principal ELSE NULL END,
              rate, term, 50000,
              app_status::public.application_status,
              (ARRAY['ใช้หมุนเวียนในการค้า','ค่าเทอมบุตร','ลงทุนสวนปาล์ม','ซ่อมบ้าน','ค่ารักษาพยาบาล'])[1 + seq_no % 5],
              NULL)
      RETURNING id INTO app_id;

      CONTINUE WHEN app_status <> 'contracted';

      start_d := (current_date - ((6 + (seq_no % 12)) || ' months')::interval)::date;
      paid_cnt := LEAST(term, GREATEST(0, (6 + (seq_no % 12)) - (seq_no % 4)));
      st := CASE WHEN paid_cnt >= term THEN 'closed'
                 WHEN (seq_no % 4) >= 2 THEN 'overdue'
                 ELSE 'active' END;
      outstanding := GREATEST(total_pay - inst_amt * paid_cnt, 0);

      INSERT INTO public.contracts (branch_id, code, application_id, customer_id, vehicle_id, principal, interest_rate,
                                    term_months, installment_amount, total_payable, outstanding, fee_amount,
                                    start_date, first_due_date, end_date, status)
      VALUES (b.id, 'CTR-' || b.code || '-' || lpad(i::text,4,'0'), app_id, cust_id, veh_id, principal, rate, term,
              inst_amt, total_pay, outstanding, 50000, start_d,
              (start_d + interval '1 month')::date, (start_d + (term || ' months')::interval)::date,
              st::public.contract_status)
      RETURNING id INTO ctr_id;

      INSERT INTO public.disbursements (branch_id, contract_id, paid_at, amount, method, reference)
      VALUES (b.id, ctr_id, start_d, principal, 'transfer', 'TRF' || lpad(seq_no::text,6,'0'));

      FOR j IN 1..term LOOP
        due_d := (start_d + (j || ' months')::interval)::date;
        ins_id := gen_random_uuid();
        INSERT INTO public.installments (id, branch_id, contract_id, seq, due_date, principal_amount, interest_amount,
                                         total_amount, paid_amount, penalty_amount, paid_date, status)
        VALUES (ins_id, b.id, ctr_id, j, due_d,
                (principal / term)::bigint,
                inst_amt - (principal / term)::bigint,
                inst_amt,
                CASE WHEN j <= paid_cnt THEN inst_amt ELSE 0 END,
                CASE WHEN j > paid_cnt AND due_d < current_date THEN 20000 ELSE 0 END,
                CASE WHEN j <= paid_cnt THEN due_d ELSE NULL END,
                (CASE WHEN j <= paid_cnt THEN 'paid'
                      WHEN due_d < current_date THEN 'overdue'
                      ELSE 'unpaid' END)::public.installment_status);

        CONTINUE WHEN j > paid_cnt;

        doc := doc + 1;
        p_part := (principal / term)::bigint;
        i_part := inst_amt - p_part;
        pen := CASE WHEN j % 7 = 0 THEN 15000 ELSE 0 END;
        ins_fee := CASE WHEN j = 1 THEN 120000 ELSE 0 END;
        reg_fee := CASE WHEN j = 1 THEN 65000 ELSE 0 END;
        fu_fee  := CASE WHEN j % 9 = 0 THEN 30000 ELSE 0 END;
        tot := inst_amt + pen + ins_fee + reg_fee + fu_fee;

        INSERT INTO public.payments (branch_id, receipt_no, contract_id, installment_id, paid_at, amount,
                                     principal_part, interest_part, penalty_part, method, voided)
        VALUES (b.id, 'RCP-' || b.code || '-' || lpad(doc::text,5,'0'), ctr_id, ins_id, due_d, tot,
                p_part, i_part, pen, CASE WHEN doc % 3 = 0 THEN 'transfer' ELSE 'cash' END, false)
        RETURNING id INTO pay_id;

        INSERT INTO public.cash_entries (branch_id, direction, doc_no, entry_date, party_name, customer_id, contract_id,
                                         payment_id, method, total_amount, change_amount, voided)
        VALUES (b.id, 'income', 'RCP-' || b.code || '-' || lpad(doc::text,5,'0'), due_d, name_full, cust_id, ctr_id,
                pay_id, CASE WHEN doc % 3 = 0 THEN 'transfer' ELSE 'cash' END, tot, 0, false)
        RETURNING id INTO entry_id;

        INSERT INTO public.cash_entry_lines (entry_id, branch_id, direction, category, amount)
        SELECT entry_id, b.id, 'income', x.cat::public.cash_category, x.amt
        FROM (VALUES ('principal', p_part), ('interest', i_part), ('penalty', pen),
                     ('insurance', ins_fee), ('registration', reg_fee), ('follow_up', fu_fee)) AS x(cat, amt)
        WHERE x.amt > 0;
      END LOOP;

      IF st = 'overdue' THEN
        INSERT INTO public.collection_activities (branch_id, contract_id, acted_at, channel, result, detail, promise_date, next_action_date)
        VALUES (b.id, ctr_id, (current_date - ((seq_no % 20) || ' days')::interval)::date,
                (ARRAY['phone','line','visit','sms'])[1 + seq_no % 4],
                (ARRAY['ติดต่อได้ รับปากจะชำระ','ติดต่อไม่ได้ ปิดเครื่อง','ญาติรับสาย แจ้งให้ติดต่อกลับ','ลงพื้นที่พบลูกค้าที่บ้าน'])[1 + seq_no % 4],
                'ยอดค้างชำระ ' || (outstanding/100)::text || ' บาท',
                (current_date + ((3 + seq_no % 10) || ' days')::interval)::date,
                (current_date + ((5 + seq_no % 12) || ' days')::interval)::date);
      END IF;
    END LOOP;

    FOR i IN 0..2 LOOP
      doc := doc + 1;
      INSERT INTO public.cash_entries (branch_id, direction, doc_no, entry_date, party_name, method, total_amount, voided, note)
      VALUES (b.id, 'expense', 'EXP-' || b.code || '-' || lpad(doc::text,5,'0'),
              (date_trunc('month', current_date) - (i || ' months')::interval + interval '27 days')::date,
              'ค่าใช้จ่ายประจำเดือน ' || b.name, 'transfer',
              CASE WHEN b.is_hq THEN 28500000 ELSE 14250000 END, false, 'ตั้งเบิกรวมประจำเดือน')
      RETURNING id INTO entry_id;

      INSERT INTO public.cash_entry_lines (entry_id, branch_id, direction, category, amount)
      SELECT entry_id, b.id, 'expense', x.cat::public.cash_category,
             CASE WHEN b.is_hq THEN x.amt ELSE (x.amt/2)::bigint END
      FROM (VALUES ('salary', 18000000::bigint), ('office', 4500000::bigint), ('insurance', 1500000::bigint),
                   ('registration', 1000000::bigint), ('follow_up', 1500000::bigint), ('interest', 2000000::bigint)) AS x(cat, amt);
    END LOOP;

    IF b.is_hq THEN
      doc := doc + 1;
      INSERT INTO public.cash_entries (branch_id, direction, doc_no, entry_date, party_name, method, total_amount, voided, note)
      VALUES (b.id, 'expense', 'EXP-' || b.code || '-' || lpad(doc::text,5,'0'),
              (date_trunc('month', current_date) + interval '9 days')::date,
              'ธนาคารออมสิน สาขาสุราษฎร์ธานี', 'transfer', 52000000, false, 'ชำระคืนเงินกู้พร้อมดอกเบี้ย')
      RETURNING id INTO entry_id;
      INSERT INTO public.cash_entry_lines (entry_id, branch_id, direction, category, amount) VALUES
        (entry_id, b.id, 'expense', 'loan_repay', 45000000),
        (entry_id, b.id, 'expense', 'interest', 7000000);

      INSERT INTO public.approval_requests (branch_id, type, entity_table, entity_id, entity_label, reason, status, payload)
      SELECT b.id, 'delete_record', 'cash_entries', ce.id, ce.doc_no, 'บันทึกซ้ำ ต้องการลบรายการ', 'pending', '{}'::jsonb
      FROM public.cash_entries ce WHERE ce.branch_id = b.id AND ce.direction = 'expense' LIMIT 1;

      INSERT INTO public.approval_requests (branch_id, type, entity_table, entity_id, entity_label, reason, status, payload)
      SELECT b.id, 'loan_approval', 'loan_applications', la.id, la.code, 'ขออนุมัติวงเงินสินเชื่อ', 'pending', '{}'::jsonb
      FROM public.loan_applications la WHERE la.branch_id = b.id AND la.status = 'pending_approval' LIMIT 1;

      INSERT INTO public.notifications (branch_id, event_type, title, message, audience, payload, status) VALUES
        (b.id, 'approval_pending', 'มีคำขออนุมัติรอดำเนินการ', 'คำขอสินเชื่อและคำขอลบรายการรอการอนุมัติจากผู้จัดการ', 'branch', '{}'::jsonb, 'sent'),
        (b.id, 'overdue_alert', 'แจ้งเตือนลูกหนี้ค้างชำระ', 'พบสัญญาค้างชำระเกินกำหนดในสำนักงานใหญ่ กรุณาตรวจสอบเมนูติดตามหนี้', 'branch', '{}'::jsonb, 'sent'),
        (b.id, 'daily_summary', 'สรุปยอดรับชำระประจำวัน', 'ระบบบันทึกใบเสร็จรับชำระประจำวันเรียบร้อยแล้ว', 'branch', '{}'::jsonb, 'sent');
    END IF;
  END LOOP;
END $$;