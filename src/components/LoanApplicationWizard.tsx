import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, isValidThaiId, toSatang } from "@/lib/format";
import { assertCustomerIdentityAvailable, customerDuplicateSaveMessage, normalizeIdentityDigits } from "@/lib/customerIdentity";
import { VEHICLE_TYPE_LABEL } from "@/lib/labels";
import { FALLBACK_DEFAULTS, maxLoanByLtv, type LoanDefaults } from "@/lib/loan";

const CONFIG_REFRESH_MS = 30 * 60 * 1000;

const customerSchema = z.object({
  full_name: z.string().trim().min(2, "กรุณากรอกชื่อ-นามสกุล").max(150),
  national_id: z.string().refine(isValidThaiId, "เลขบัตรประชาชนไม่ถูกต้อง"),
  phone: z.string().trim().regex(/^0\d{8,9}$/, "เบอร์โทรไม่ถูกต้อง"),
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").max(255).or(z.literal("")),
  address: z.string().trim().max(500),
  occupation: z.string().trim().max(100),
  monthly_income: z.string(),
  note: z.string().trim().max(1000),
  line_id: z.string().trim().max(100),
  document_no: z.string().trim().max(100),
});

function normalizeLoanDefaults(value: unknown): LoanDefaults {
  const raw = (value ?? {}) as Partial<LoanDefaults>;
  const terms = Array.isArray(raw.terms)
    ? raw.terms.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  return {
    ...FALLBACK_DEFAULTS,
    ...raw,
    terms: terms.length ? Array.from(new Set(terms)).sort((a, b) => a - b) : FALLBACK_DEFAULTS.terms,
  } as LoanDefaults;
}

async function fetchLatestLoanDefaults() {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value,updated_at")
    .eq("key", "loan_defaults")
    .maybeSingle();
  if (error) throw error;
  return { defaults: normalizeLoanDefaults(data?.value), updated_at: data?.updated_at ?? null };
}

type CustomerForm = z.infer<typeof customerSchema>;

type ApplicationForm = {
  customer_id: string;
  vehicle_type: string;
  brand: string;
  model: string;
  year: string;
  plate_no: string;
  plate_province: string;
  chassis_no: string;
  appraised_value: string;
  requested_amount: string;
  term_months: string;
  interest_rate: string;
  purpose: string;
  registration_due_date: string;
  guarantor_name: string;
  document_no: string;
};

const EMPTY_CUSTOMER: CustomerForm = {
  full_name: "",
  national_id: "",
  phone: "",
  email: "",
  address: "",
  occupation: "",
  monthly_income: "",
  note: "",
  line_id: "",
  document_no: "",
};

const makeEmptyApplication = (): ApplicationForm => ({
  customer_id: "",
  vehicle_type: "car",
  brand: "",
  model: "",
  year: "",
  plate_no: "",
  plate_province: "สุราษฎร์ธานี",
  chassis_no: "",
  appraised_value: "",
  requested_amount: "",
  term_months: String(FALLBACK_DEFAULTS.terms[0] ?? 12),
  interest_rate: String(FALLBACK_DEFAULTS.interest_rate),
  purpose: "",
  registration_due_date: "",
  guarantor_name: "",
  document_no: "",
});

const STEPS = ["ลูกค้า", "รถและผู้ค้ำ", "เงื่อนไขสินเชื่อ", "ตรวจสอบ"] as const;

export function LoanApplicationWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { profile } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(EMPTY_CUSTOMER);
  const [form, setForm] = useState<ApplicationForm>(makeEmptyApplication);
  const [historyQuery, setHistoryQuery] = useState("");

  const loanDefaultsQuery = useQuery({
    queryKey: ["system-setting", "loan_defaults"],
    queryFn: fetchLatestLoanDefaults,
    staleTime: CONFIG_REFRESH_MS,
    refetchInterval: CONFIG_REFRESH_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const loanDefaults = loanDefaultsQuery.data?.defaults ?? FALLBACK_DEFAULTS;

  const { data: customers } = useQuery({
    queryKey: ["customers-wizard", branchId],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, code, full_name, national_id, phone, line_id, email, occupation, monthly_income, address, note, document_no")
        .eq("status", "active")
        .order("full_name");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["global-customer-history", historyQuery],
    enabled: open && historyQuery.trim().length >= 2,
    queryFn: async () => {
      const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: any[] | null; error: { message: string } | null }>;
      const { data, error } = await rpc("global_customer_history_search", { _q: historyQuery });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const selectedCustomer = useMemo(
    () => (customers ?? []).find((c: any) => c.id === form.customer_id) as any | undefined,
    [customers, form.customer_id],
  );

  const customerOptions = (customers ?? []).map((c: any) => ({
    value: c.id,
    label: `${c.code} — ${c.full_name}`,
    keywords: [c.full_name, c.code, c.national_id, c.phone, c.line_id],
  }));

  const ltvCap = useMemo(
    () => maxLoanByLtv(
      toSatang(form.appraised_value || "0"),
      form.vehicle_type === "motorcycle" ? loanDefaults.ltv_motorcycle : loanDefaults.ltv_car,
    ),
    [form.appraised_value, form.vehicle_type, loanDefaults.ltv_car, loanDefaults.ltv_motorcycle],
  );

  const resetWizard = () => {
    setCurrentStep(1);
    setCustomerMode("existing");
    setCustomerForm(EMPTY_CUSTOMER);
    setForm(makeEmptyApplication());
    setHistoryQuery("");
  };

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    void loanDefaultsQuery.refetch().then((refreshed) => {
      const latest = refreshed.data?.defaults ?? loanDefaults;
      setForm((current) => ({
        ...current,
        term_months: String(latest.terms[0] ?? 12),
        interest_rate: String(latest.interest_rate),
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshDefaults = async () => {
    const refreshed = await loanDefaultsQuery.refetch();
    const latest = refreshed.data?.defaults ?? loanDefaults;
    setForm((current) => ({
      ...current,
      term_months: latest.terms.includes(Number(current.term_months)) ? current.term_months : String(latest.terms[0] ?? 12),
      interest_rate: String(latest.interest_rate),
    }));
    toast.success(`โหลดค่าล่าสุดแล้ว · งวด ${latest.terms.join(", ")} เดือน`);
  };

  const validateStep = (step: number) => {
    if (step === 1) {
      if (customerMode === "existing") {
        if (!form.customer_id) throw new Error("กรุณาเลือกลูกค้าเดิม หรือเพิ่มลูกค้าใหม่");
      } else {
        const parsed = customerSchema.safeParse(customerForm);
        if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
      }
    }
    if (step === 2 && !form.plate_no.trim()) throw new Error("กรุณากรอกทะเบียนรถ");
    if (step === 3) {
      const requested = toSatang(form.requested_amount || "0");
      const term = Number(form.term_months);
      if (requested <= 0) throw new Error("กรุณากรอกวงเงินที่ขอ");
      if (!loanDefaults.terms.includes(term)) throw new Error("กรุณาเลือกจำนวนงวดที่ถูกต้อง");
      if (ltvCap > 0 && requested > ltvCap) throw new Error(`วงเงินเกินเพดาน LTV (สูงสุด ฿${formatMoney(ltvCap)})`);
    }
  };

  const next = () => {
    try {
      validateStep(currentStep);
      setCurrentStep((s) => Math.min(4, s + 1));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const createAll = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      validateStep(1);
      validateStep(2);
      validateStep(3);

      let customerId = form.customer_id;
      if (customerMode === "new") {
        const parsed = customerSchema.safeParse(customerForm);
        if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
        const v = parsed.data;
        await assertCustomerIdentityAvailable(v.national_id, v.phone);
        const { data: customerCode, error: customerCodeErr } = await supabase.rpc("next_doc_no", {
          _branch: profile.branch_id,
          _doc_type: "CUS",
        });
        if (customerCodeErr) throw customerCodeErr;
        const { data: createdCustomer, error: customerErr } = await supabase
          .from("customers")
          .insert({
            code: customerCode as string,
            branch_id: profile.branch_id,
            full_name: v.full_name,
            national_id: normalizeIdentityDigits(v.national_id),
            phone: normalizeIdentityDigits(v.phone),
            email: v.email || null,
            address: v.address || null,
            occupation: v.occupation || null,
            monthly_income: v.monthly_income ? Math.round(parseFloat(v.monthly_income) * 100) : null,
            note: v.note || null,
            created_by: profile.id,
            line_id: v.line_id || null,
            document_no: v.document_no || null,
          } as never)
          .select("id")
          .single();
        if (customerErr) throw customerErr;
        customerId = createdCustomer.id;
      }

      if (!customerId) throw new Error("ไม่พบข้อมูลลูกค้า");

      // Preserve the existing application save sequence and execution-time config refresh.
      const latest = (await fetchLatestLoanDefaults()).defaults;
      const requested = toSatang(form.requested_amount || "0");
      const term = parseInt(form.term_months, 10);
      const currentLtv = form.vehicle_type === "motorcycle" ? latest.ltv_motorcycle : latest.ltv_car;
      const currentLtvCap = maxLoanByLtv(toSatang(form.appraised_value || "0"), currentLtv);
      if (!latest.terms.includes(term)) throw new Error(`จำนวนงวดไม่ตรงกับค่าล่าสุด กรุณาเลือกใหม่ (${latest.terms.join(", ")} เดือน)`);
      if (currentLtvCap > 0 && requested > currentLtvCap) throw new Error(`วงเงินเกินเพดาน LTV ล่าสุด (สูงสุด ฿${formatMoney(currentLtvCap)})`);

      const { data: vehicle, error: vErr } = await supabase
        .from("vehicles")
        .insert({
          branch_id: profile.branch_id,
          customer_id: customerId,
          vehicle_type: form.vehicle_type,
          brand: form.brand || null,
          model: form.model || null,
          year: form.year ? parseInt(form.year, 10) : null,
          plate_no: form.plate_no.trim(),
          plate_province: form.plate_province || null,
          chassis_no: form.chassis_no || null,
          appraised_value: toSatang(form.appraised_value || "0"),
          registration_due_date: form.registration_due_date || null,
        } as never)
        .select("id")
        .single();
      if (vErr) throw vErr;

      const { data: code, error: cErr } = await supabase.rpc("next_doc_no", {
        _branch: profile.branch_id,
        _doc_type: "APP",
      });
      if (cErr) throw cErr;

      const { data: app, error } = await supabase
        .from("loan_applications")
        .insert({
          branch_id: profile.branch_id,
          code: code as string,
          customer_id: customerId,
          vehicle_id: vehicle.id,
          requested_amount: requested,
          interest_rate: parseFloat(form.interest_rate),
          term_months: term,
          fee_amount: Math.round((requested * latest.fee_percent) / 100),
          purpose: form.purpose || null,
          status: "submitted",
          created_by: profile.id,
          document_no: customerMode === "new" ? customerForm.document_no || null : form.document_no || null,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      if (form.guarantor_name.trim()) {
        const { error: gErr } = await supabase.from("loan_guarantors").insert({
          branch_id: profile.branch_id,
          application_id: app.id,
          full_name: form.guarantor_name.trim(),
        } as never);
        if (gErr) throw gErr;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกลูกค้าและคำขอสินเชื่อเรียบร้อย");
      onOpenChange(false);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(customerDuplicateSaveMessage(e.message)),
  });

  const displayCustomer = customerMode === "existing" ? selectedCustomer : customerForm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(94vh,900px)] max-h-[94vh] overflow-hidden p-0 sm:max-w-[min(96vw,1500px)] [&>button]:hidden">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b px-8 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl">สร้างลูกค้าและคำขอสินเชื่อ</DialogTitle>
                <DialogDescription className="sr-only">Wizard 4 ขั้นตอนสำหรับสร้างลูกค้าและคำขอสินเชื่อ</DialogDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="ปิด">
                <X className="size-5" />
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-4 items-center">
              {STEPS.map((label, index) => {
                const step = index + 1;
                const done = step < currentStep;
                const active = step === currentStep;
                return (
                  <div key={label} className="flex items-center last:flex-none">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <div className={`flex size-9 items-center justify-center rounded-full border text-sm font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary text-primary" : "border-border bg-background text-foreground"}`}>
                        {done ? <Check className="size-5" /> : step}
                      </div>
                      <span className={active || done ? "font-medium text-primary" : "text-muted-foreground"}>{label}</span>
                    </div>
                    {step < 4 && <div className={`mx-4 h-px min-w-8 flex-1 ${step < currentStep ? "bg-primary" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-5">
            {currentStep === 1 && (
              <section className="rounded-xl border p-5">
                <h3 className="mb-4 text-xl font-semibold">ข้อมูลลูกค้า</h3>
                <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="space-y-1.5">
                    <Label>ค้นหาลูกค้าเดิม</Label>
                    <SearchableCombobox
                      value={form.customer_id}
                      onValueChange={(v) => { setForm({ ...form, customer_id: v }); setCustomerMode("existing"); }}
                      options={customerOptions}
                      placeholder="ชื่อ / รหัส / เลขบัตร / เบอร์โทร / LINE ID"
                      searchPlaceholder="พิมพ์ชื่อ รหัส เลขบัตร โทร หรือ LINE ID"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={() => { setCustomerMode("new"); setForm({ ...form, customer_id: "" }); }}>
                      <Plus className="size-4" /> เพิ่มลูกค้าใหม่
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="ชื่อ-นามสกุล *" value={displayCustomer?.full_name ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, full_name: v })} />
                  <Field label="เลขบัตรประชาชน *" value={displayCustomer?.national_id ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, national_id: v })} />
                  <Field label="เบอร์โทรศัพท์ *" value={displayCustomer?.phone ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, phone: v })} />
                  <Field label="LINEID" value={displayCustomer?.line_id ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, line_id: v })} />
                  <Field label="เลขที่ใบกำกับ (Document No.)" value={displayCustomer?.document_no ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, document_no: v })} />
                  <Field label="อีเมล" value={displayCustomer?.email ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, email: v })} />
                  <Field label="อาชีพ" value={displayCustomer?.occupation ?? ""} readOnly={customerMode === "existing"} onChange={(v) => setCustomerForm({ ...customerForm, occupation: v })} />
                  <Field label="รายได้ต่อเดือน (บาท)" value={customerMode === "existing" && displayCustomer?.monthly_income != null ? String(Number(displayCustomer.monthly_income) / 100) : customerForm.monthly_income} readOnly={customerMode === "existing"} type="number" onChange={(v) => setCustomerForm({ ...customerForm, monthly_income: v })} />
                  <div className="md:col-span-2 space-y-1.5"><Label>ที่อยู่</Label><Textarea value={displayCustomer?.address ?? ""} readOnly={customerMode === "existing"} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} rows={2} /></div>
                  <div className="md:col-span-2 space-y-1.5"><Label>หมายเหตุ</Label><Textarea value={displayCustomer?.note ?? ""} readOnly={customerMode === "existing"} onChange={(e) => setCustomerForm({ ...customerForm, note: e.target.value })} rows={2} /></div>
                </div>

                <div className="mt-5 rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2 font-medium"><Search className="size-4" /> ตรวจประวัติทุกสาขา</div>
                  <Input value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} placeholder="ชื่อ / เลขบัตร / เบอร์โทร / LINEID" />
                  {historyQuery.trim().length >= 2 && <div className="mt-2 max-h-36 overflow-auto text-xs">{(history ?? []).length === 0 ? <p className="text-muted-foreground">ไม่พบประวัติ</p> : (history ?? []).map((h: any, i: number) => <div key={`${h.reference_no}-${i}`} className="border-b py-1">{h.full_name} · {h.history_type === "guarantor" ? "ผู้ค้ำประกัน" : "ผู้กู้"} · {h.reference_no} · {h.branch_name}</div>)}</div>}
                </div>
              </section>
            )}

            {currentStep === 2 && (
              <section className="rounded-xl border p-5">
                <h3 className="mb-4 text-xl font-semibold">ข้อมูลรถและผู้ค้ำประกัน</h3>
                <div className="mb-5 rounded-lg border bg-muted/30 px-4 py-3">ลูกค้า: {customerMode === "existing" ? `${selectedCustomer?.code ?? ""} · ${selectedCustomer?.full_name ?? ""}` : customerForm.full_name}</div>
                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-1.5"><Label>ประเภทรถ</Label><Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(VEHICLE_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                  <Field label="ยี่ห้อ" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
                  <Field label="รุ่น" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
                  <Field label="ปีจดทะเบียน" value={form.year} type="number" onChange={(v) => setForm({ ...form, year: v })} />
                  <Field label="ทะเบียนรถ *" value={form.plate_no} onChange={(v) => setForm({ ...form, plate_no: v })} />
                  <Field label="จังหวัดทะเบียน" value={form.plate_province} onChange={(v) => setForm({ ...form, plate_province: v })} />
                  <Field label="เลขตัวถัง" value={form.chassis_no} onChange={(v) => setForm({ ...form, chassis_no: v })} />
                  <Field label="วันที่ครบกำหนดต่อทะเบียน" value={form.registration_due_date} type="date" onChange={(v) => setForm({ ...form, registration_due_date: v })} />
                  <Field label="ชื่อ-สกุลผู้ค้ำประกัน" value={form.guarantor_name} onChange={(v) => setForm({ ...form, guarantor_name: v })} />
                </div>
              </section>
            )}

            {currentStep === 3 && (
              <section className="rounded-xl border p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">เงื่อนไขสินเชื่อ</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refreshDefaults()} disabled={loanDefaultsQuery.isFetching}>
                    <RefreshCw className={`size-4 ${loanDefaultsQuery.isFetching ? "animate-spin" : ""}`} /> โหลดค่าล่าสุด
                  </Button>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="ราคาประเมินรถ (บาท)" value={form.appraised_value} type="number" onChange={(v) => setForm({ ...form, appraised_value: v })} />
                  <Field label="วงเงินที่ขอ (บาท) *" value={form.requested_amount} type="number" onChange={(v) => setForm({ ...form, requested_amount: v })} />
                  <div className="space-y-1.5"><Label>จำนวนงวด *</Label><Select value={form.term_months} onValueChange={(v) => setForm({ ...form, term_months: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{loanDefaults.terms.map((term) => <SelectItem key={term} value={String(term)}>{term} เดือน</SelectItem>)}</SelectContent></Select></div>
                  <Field label="อัตราดอกเบี้ย (%)" value={form.interest_rate} type="number" onChange={(v) => setForm({ ...form, interest_rate: v })} />
                  <Field label="Document No." value={form.document_no} onChange={(v) => setForm({ ...form, document_no: v })} />
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm"><div className="text-muted-foreground">เพดาน LTV</div><div className="mt-1 font-semibold">฿{formatMoney(ltvCap)}</div></div>
                  <div className="space-y-1.5 md:col-span-2 lg:col-span-3"><Label>วัตถุประสงค์</Label><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={3} /></div>
                </div>
              </section>
            )}

            {currentStep === 4 && (
              <section className="rounded-xl border p-5">
                <h3 className="mb-4 text-xl font-semibold">ตรวจสอบข้อมูลก่อนบันทึก</h3>
                <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4 font-medium">ตรวจสอบข้อมูลให้ถูกต้อง หากยืนยันจะไม่สามารถแก้ไขหรือลบได้</div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <Review title="ลูกค้า" rows={[
                    ["ชื่อ-นามสกุล", customerMode === "existing" ? selectedCustomer?.full_name : customerForm.full_name],
                    ["เลขบัตรประชาชน", customerMode === "existing" ? selectedCustomer?.national_id : customerForm.national_id],
                    ["เบอร์โทร", customerMode === "existing" ? selectedCustomer?.phone : customerForm.phone],
                    ["LINEID", customerMode === "existing" ? selectedCustomer?.line_id : customerForm.line_id],
                  ]} />
                  <Review title="รถและผู้ค้ำ" rows={[
                    ["ประเภทรถ", VEHICLE_TYPE_LABEL[form.vehicle_type] ?? form.vehicle_type],
                    ["ยี่ห้อ / รุ่น", `${form.brand || "-"} ${form.model || ""}`],
                    ["ทะเบียน", `${form.plate_no} ${form.plate_province}`],
                    ["ผู้ค้ำประกัน", form.guarantor_name || "-"],
                  ]} />
                  <Review title="เงื่อนไขสินเชื่อ" rows={[
                    ["ราคาประเมิน", `฿${Number(form.appraised_value || 0).toLocaleString("th-TH")}`],
                    ["วงเงินที่ขอ", `฿${Number(form.requested_amount || 0).toLocaleString("th-TH")}`],
                    ["จำนวนงวด", `${form.term_months} เดือน`],
                    ["อัตราดอกเบี้ย", `${form.interest_rate}%`],
                  ]} />
                </div>
              </section>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-8 py-4">
            {currentStep === 1 ? <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button> : <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}>ย้อนกลับ</Button>}
            {currentStep < 4 ? <Button className="min-w-36" onClick={next}>ถัดไป</Button> : <Button className="min-w-40" onClick={() => createAll.mutate()} disabled={createAll.isPending}>{createAll.isPending ? "กำลังบันทึก..." : "ยืนยันและบันทึก"}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, readOnly = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; readOnly?: boolean; type?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} readOnly={readOnly} className={readOnly ? "bg-muted/50" : undefined} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Review({ title, rows }: { title: string; rows: Array<[string, unknown]> }) {
  return <div className="rounded-lg border p-4"><h4 className="mb-3 font-semibold">{title}</h4><dl className="space-y-2 text-sm">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{String(value ?? "-")}</dd></div>)}</dl></div>;
}

