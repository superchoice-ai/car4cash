import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, toSatang } from "@/lib/format";
import { APPLICATION_STATUS_LABEL, VEHICLE_TYPE_LABEL } from "@/lib/labels";
import { FALLBACK_DEFAULTS, buildSchedule, maxLoanByLtv } from "@/lib/loan";

export const Route = createFileRoute("/_authenticated/applications/")({
  head: () => ({
    meta: [
      { title: "คำขอสินเชื่อ | ธารทรัพย์" },
      { name: "description", content: "สร้างคำขอสินเชื่อจำนำเล่มทะเบียน ประเมินราคารถ และส่งเรื่องขออนุมัติ" },
      { property: "og:title", content: "คำขอสินเชื่อ | ธารทรัพย์" },
      { property: "og:description", content: "ยื่นและติดตามคำขอสินเชื่อรถแลกเงิน" },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const { profile, canApprove, isHQ } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: apps, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select(
          "*, customers:customer_id(code, full_name), vehicles:vehicle_id(plate_no, brand, model, appraised_value), branches:branch_id(name)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, code, full_name").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
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
    term_months: "12",
    interest_rate: String(FALLBACK_DEFAULTS.interest_rate),
    purpose: "",
  });

  const preview = useMemo(() => {
    const principal = toSatang(form.requested_amount || "0");
    if (!principal) return null;
    return buildSchedule(
      { principal, interestRate: parseFloat(form.interest_rate) || 0, termMonths: parseInt(form.term_months, 10) || 12 },
      new Date().toISOString().slice(0, 10),
    );
  }, [form.requested_amount, form.interest_rate, form.term_months]);

  const ltvCap = useMemo(() => {
    const appraised = toSatang(form.appraised_value || "0");
    const ltv = form.vehicle_type === "motorcycle" ? FALLBACK_DEFAULTS.ltv_motorcycle : FALLBACK_DEFAULTS.ltv_car;
    return maxLoanByLtv(appraised, ltv);
  }, [form.appraised_value, form.vehicle_type]);

  const createApp = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      if (!form.customer_id) throw new Error("กรุณาเลือกลูกค้า");
      if (!form.plate_no.trim()) throw new Error("กรุณากรอกทะเบียนรถ");
      const requested = toSatang(form.requested_amount || "0");
      if (requested <= 0) throw new Error("กรุณากรอกวงเงินที่ขอ");
      if (ltvCap > 0 && requested > ltvCap)
        throw new Error(`วงเงินเกินเพดาน LTV (สูงสุด ฿${formatMoney(ltvCap)})`);

      const { data: vehicle, error: vErr } = await supabase
        .from("vehicles")
        .insert({
          branch_id: profile.branch_id,
          customer_id: form.customer_id,
          vehicle_type: form.vehicle_type,
          brand: form.brand || null,
          model: form.model || null,
          year: form.year ? parseInt(form.year, 10) : null,
          plate_no: form.plate_no.trim(),
          plate_province: form.plate_province || null,
          chassis_no: form.chassis_no || null,
          appraised_value: toSatang(form.appraised_value || "0"),
        })
        .select("id")
        .single();
      if (vErr) throw vErr;

      const { data: code, error: cErr } = await supabase.rpc("next_doc_no", {
        _branch: profile.branch_id,
        _doc_type: "APP",
      });
      if (cErr) throw cErr;

      const { error } = await supabase.from("loan_applications").insert({
        branch_id: profile.branch_id,
        code: code as string,
        customer_id: form.customer_id,
        vehicle_id: vehicle.id,
        requested_amount: requested,
        interest_rate: parseFloat(form.interest_rate),
        term_months: parseInt(form.term_months, 10),
        fee_amount: Math.round((requested * FALLBACK_DEFAULTS.fee_percent) / 100),
        purpose: form.purpose || null,
        status: "submitted",
        created_by: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกคำขอสินเชื่อเรียบร้อย");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitApproval = useMutation({
    mutationFn: async (app: { id: string; code: string; branch_id: string; requested_amount: number }) => {
      const { error: uErr } = await supabase
        .from("loan_applications")
        .update({ status: "pending_approval" })
        .eq("id", app.id);
      if (uErr) throw uErr;
      const { error } = await supabase.from("approval_requests").insert({
        branch_id: app.branch_id,
        type: "loan_approval",
        entity_table: "loan_applications",
        entity_id: app.id,
        entity_label: app.code,
        reason: `ขออนุมัติวงเงิน ฿${formatMoney(app.requested_amount)}`,
        requested_by: profile?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ส่งเรื่องขออนุมัติแล้ว");
      void qc.invalidateQueries({ queryKey: ["applications"] });
      void qc.invalidateQueries({ queryKey: ["approvals-pending-count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve, amount }: { id: string; approve: boolean; amount: number }) => {
      const { error } = await supabase
        .from("loan_applications")
        .update(
          approve
            ? { status: "approved", approved_amount: amount, approved_by: profile?.id, approved_at: new Date().toISOString() }
            : { status: "rejected", reject_reason: "ไม่ผ่านเกณฑ์พิจารณา" },
        )
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกผลการพิจารณาแล้ว");
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (apps ?? []).filter((a) => statusFilter === "all" || a.status === statusFilter);

  return (
    <div>
      <PageHeader
        title="คำขอสินเชื่อ"
        description="ยื่นคำขอ ประเมินราคารถ และติดตามผลการอนุมัติ"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> สร้างคำขอใหม่
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              {Object.entries(APPLICATION_STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีคำขอสินเชื่อ" description="เริ่มต้นโดยกดปุ่ม “สร้างคำขอใหม่”" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่คำขอ</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>รถ</TableHead>
                    <TableHead className="text-right">วงเงินที่ขอ</TableHead>
                    <TableHead>งวด</TableHead>
                    {isHQ && <TableHead>สาขา</TableHead>}
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="tabular font-medium">{a.code}</TableCell>
                      <TableCell>{a.customers?.full_name ?? "-"}</TableCell>
                      <TableCell className="text-sm">
                        {a.vehicles?.plate_no} · {a.vehicles?.brand} {a.vehicles?.model}
                      </TableCell>
                      <TableCell className="tabular text-right">฿{formatMoney(a.requested_amount)}</TableCell>
                      <TableCell className="tabular">{a.term_months} ด.</TableCell>
                      {isHQ && <TableCell>{a.branches?.name ?? "-"}</TableCell>}
                      <TableCell>
                        <StatusPill status={a.status} label={APPLICATION_STATUS_LABEL[a.status] ?? a.status} />
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">{formatThaiDate(a.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {a.status === "submitted" && (
                          <Button size="sm" variant="outline" onClick={() => submitApproval.mutate(a)}>
                            <Send className="size-3.5" /> ขออนุมัติ
                          </Button>
                        )}
                        {a.status === "pending_approval" && canApprove && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              onClick={() => decide.mutate({ id: a.id, approve: true, amount: a.requested_amount })}
                            >
                              <Check className="size-3.5" /> อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decide.mutate({ id: a.id, approve: false, amount: 0 })}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>สร้างคำขอสินเชื่อ</DialogTitle>
            <DialogDescription>บันทึกข้อมูลรถหลักประกันและวงเงินที่ลูกค้าต้องการ</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ลูกค้า *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกลูกค้า" />
                </SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ประเภทรถ</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>ยี่ห้อ</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>รุ่น</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>ปีจดทะเบียน</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>ทะเบียนรถ *</Label>
              <Input value={form.plate_no} onChange={(e) => setForm({ ...form, plate_no: e.target.value })} maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label>จังหวัดทะเบียน</Label>
              <Input value={form.plate_province} onChange={(e) => setForm({ ...form, plate_province: e.target.value })} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>เลขตัวถัง</Label>
              <Input value={form.chassis_no} onChange={(e) => setForm({ ...form, chassis_no: e.target.value })} maxLength={40} />
            </div>

            <div className="space-y-1.5">
              <Label>ราคาประเมิน (บาท)</Label>
              <Input
                type="number"
                value={form.appraised_value}
                onChange={(e) => setForm({ ...form, appraised_value: e.target.value })}
              />
              {ltvCap > 0 && <p className="text-xs text-muted-foreground">วงเงินสูงสุดตาม LTV: ฿{formatMoney(ltvCap)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>วงเงินที่ขอ (บาท) *</Label>
              <Input
                type="number"
                value={form.requested_amount}
                onChange={(e) => setForm({ ...form, requested_amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>จำนวนงวด</Label>
              <Select value={form.term_months} onValueChange={(v) => setForm({ ...form, term_months: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FALLBACK_DEFAULTS.terms.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t} เดือน
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ดอกเบี้ย (% ต่อเดือน)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>วัตถุประสงค์</Label>
              <Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2} maxLength={500} />
            </div>
          </div>

          {preview && (
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium">ประมาณการค่างวด (Flat rate)</p>
              <div className="tabular mt-1 grid gap-1 sm:grid-cols-3">
                <span>ค่างวด/เดือน: ฿{formatMoney(preview.installment)}</span>
                <span>ดอกเบี้ยรวม: ฿{formatMoney(preview.totalInterest)}</span>
                <span>ยอดชำระรวม: ฿{formatMoney(preview.totalPayable)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => createApp.mutate()} disabled={createApp.isPending}>
              บันทึกคำขอ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
