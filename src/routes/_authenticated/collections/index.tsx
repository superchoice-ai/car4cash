import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneCall, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatCard } from "@/components/Common";
import { SearchableCombobox, StandardSearch, includesThaiSearch } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO, daysBetween } from "@/lib/format";
import { COLLECTION_CHANNEL_LABEL } from "@/lib/labels";
import { calcPenalty, FALLBACK_DEFAULTS } from "@/lib/loan";

export const Route = createFileRoute("/_authenticated/collections/")({ component: CollectionsPage });

function CollectionsPage() {
  const { profile } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [contractId, setContractId] = useState("");
  const [channel, setChannel] = useState("phone");
  const [result, setResult] = useState("");
  const [detail, setDetail] = useState("");
  const [promiseDate, setPromiseDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["collections", branchId],
    queryFn: async () => {
      const bf = <T extends { eq: (c: string, v: string) => T }>(q: T): T => branchId ? q.eq("branch_id", branchId) : q;
      const [overdue, acts] = await Promise.all([
        bf(supabase.from("installments").select("*, contracts:contract_id(id, code, customers:customer_id(full_name, phone, national_id, line_id), vehicles:vehicle_id(plate_no))").lt("due_date", today).neq("status", "paid").order("due_date")),
        bf(supabase.from("collection_activities").select("*, contracts:contract_id(code, customers:customer_id(full_name, phone, national_id, line_id))").order("acted_at", { ascending: false }).limit(100)),
      ]);
      return { overdue: overdue.data ?? [], activities: acts.data ?? [] };
    },
  });

  const overdue = (data?.overdue ?? []).filter((i: any) => includesThaiSearch(search, [i.contracts?.code, i.contracts?.customers?.full_name, i.contracts?.customers?.phone, i.contracts?.customers?.national_id, i.contracts?.customers?.line_id, i.contracts?.vehicles?.plate_no, i.seq, i.due_date]));
  const activities = (data?.activities ?? []).filter((a: any) => includesThaiSearch(search, [a.contracts?.code, a.contracts?.customers?.full_name, a.contracts?.customers?.phone, a.contracts?.customers?.national_id, a.contracts?.customers?.line_id, a.channel, COLLECTION_CHANNEL_LABEL[a.channel], a.result, a.detail, a.promise_date]));
  const totalOverdue = overdue.reduce((s, i: any) => s + (i.total_amount - i.paid_amount), 0);
  const contractsInvolved = new Set(overdue.map((i: any) => i.contract_id)).size;

  const logActivity = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      if (!contractId) throw new Error("กรุณาเลือกสัญญา");
      const { error } = await supabase.from("collection_activities").insert({ branch_id: profile.branch_id, contract_id: contractId, acted_at: today, channel, result: result || null, detail: detail || null, promise_date: promiseDate || null, created_by: profile.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("บันทึกผลการติดตามเรียบร้อย"); setOpen(false); setResult(""); setDetail(""); setPromiseDate(""); void qc.invalidateQueries({ queryKey: ["collections"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const uniqueContracts = Array.from(new Map((data?.overdue ?? []).map((i: any) => [i.contract_id, i.contracts])).entries()) as [string, any][];
  const contractOptions = uniqueContracts.map(([id, c]) => ({ value: id, label: `${c?.code ?? "-"} — ${c?.customers?.full_name ?? "-"}`, keywords: [c?.code, c?.customers?.full_name, c?.customers?.phone, c?.customers?.national_id, c?.customers?.line_id, c?.vehicles?.plate_no] }));

  return <div>
    <PageHeader title="ติดตามหนี้" description="รายการค่างวดเกินกำหนด พร้อมบันทึกผลการติดตาม" actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> บันทึกผลติดตาม</Button>} />
    <Card className="mb-4"><CardContent className="p-4"><StandardSearch value={search} onChange={setSearch} placeholder="ค้นหาสัญญา / ชื่อไทย / เลขบัตร / โทร / LINEID / ทะเบียน / ผลติดตาม" /></CardContent></Card>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><StatCard label="ยอดค้างชำระรวม" value={`฿${formatMoney(totalOverdue)}`} tone="danger" icon={<PhoneCall className="size-5" />} /><StatCard label="งวดที่ค้าง" value={String(overdue.length)} tone="warning" /><StatCard label="สัญญาที่ค้างชำระ" value={String(contractsInvolved)} tone="warning" /></div>
    <Card className="mb-4"><CardHeader className="pb-2"><CardTitle className="text-base">งวดค้างชำระ</CardTitle></CardHeader><CardContent className="p-0">{isLoading ? <div className="p-6">กำลังโหลด...</div> : overdue.length === 0 ? <div className="p-6"><EmptyState title="ไม่พบงวดค้างชำระ" /></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>สัญญา</TableHead><TableHead>ลูกค้า</TableHead><TableHead>เบอร์โทร</TableHead><TableHead>งวด</TableHead><TableHead>ครบกำหนด</TableHead><TableHead className="text-right">ค้างชำระ</TableHead><TableHead className="text-right">เกิน (วัน)</TableHead><TableHead className="text-right">ค่าปรับโดยประมาณ</TableHead></TableRow></TableHeader><TableBody>{overdue.map((i: any) => { const days = daysBetween(i.due_date, today); const due = i.total_amount - i.paid_amount; return <TableRow key={i.id}><TableCell className="font-medium">{i.contracts?.code ?? "-"}</TableCell><TableCell>{i.contracts?.customers?.full_name ?? "-"}</TableCell><TableCell>{i.contracts?.customers?.phone ?? "-"}</TableCell><TableCell>{i.seq}</TableCell><TableCell>{formatThaiDate(i.due_date)}</TableCell><TableCell className="text-right">฿{formatMoney(due)}</TableCell><TableCell className="text-right text-destructive">{days}</TableCell><TableCell className="text-right">฿{formatMoney(calcPenalty(due, FALLBACK_DEFAULTS.penalty_rate_per_day, days))}</TableCell></TableRow>; })}</TableBody></Table></div>}</CardContent></Card>
    <Card><CardHeader className="pb-2"><CardTitle className="text-base">ประวัติการติดตาม</CardTitle></CardHeader><CardContent className="p-0">{activities.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">ไม่พบประวัติการติดตาม</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>วันที่</TableHead><TableHead>สัญญา</TableHead><TableHead>ลูกค้า</TableHead><TableHead>ช่องทาง</TableHead><TableHead>ผล</TableHead><TableHead>นัดชำระ</TableHead></TableRow></TableHeader><TableBody>{activities.map((a: any) => <TableRow key={a.id}><TableCell>{formatThaiDate(a.acted_at)}</TableCell><TableCell>{a.contracts?.code ?? "-"}</TableCell><TableCell>{a.contracts?.customers?.full_name ?? "-"}</TableCell><TableCell>{COLLECTION_CHANNEL_LABEL[a.channel] ?? a.channel}</TableCell><TableCell>{a.result ?? "-"}</TableCell><TableCell>{a.promise_date ? formatThaiDate(a.promise_date) : "-"}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>บันทึกผลการติดตาม</DialogTitle><DialogDescription>ค้นหาสัญญาค้างชำระด้วยชื่อไทยหรือข้อมูลบางส่วนได้</DialogDescription></DialogHeader><div className="grid gap-3"><div><Label>สัญญา *</Label><SearchableCombobox value={contractId} onValueChange={setContractId} options={contractOptions} placeholder="ค้นหา/เลือกสัญญาค้างชำระ" searchPlaceholder="เลขสัญญา / ชื่อ / เลขบัตร / โทร / LINEID / ทะเบียน" /></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>ช่องทาง</Label><Select value={channel} onValueChange={setChannel}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(COLLECTION_CHANNEL_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div><Label>วันที่นัดชำระ</Label><Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} /></div></div><div><Label>ผลการติดตาม</Label><Input value={result} onChange={(e) => setResult(e.target.value)} placeholder="เช่น ติดต่อได้ / ไม่รับสาย" /></div><div><Label>รายละเอียด</Label><Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button><Button onClick={() => logActivity.mutate()} disabled={logActivity.isPending}>บันทึก</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
