import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneCall, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, EmptyState, StatCard } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatMoney, formatThaiDate, todayISO, daysBetween } from "@/lib/format";
import { COLLECTION_CHANNEL_LABEL } from "@/lib/labels";
import { calcPenalty, FALLBACK_DEFAULTS } from "@/lib/loan";

export const Route = createFileRoute("/_authenticated/collections/")({
  head: () => ({
    meta: [
      { title: "ติดตามหนี้ | ธารทรัพย์" },
      { name: "description", content: "รายการค่างวดค้างชำระ คำนวณค่าปรับ และบันทึกผลการติดตามทวงถาม" },
      { property: "og:title", content: "ติดตามหนี้ | ธารทรัพย์" },
      { property: "og:description", content: "ติดตามค่างวดค้างชำระและบันทึกผลการทวงถาม" },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState("");
  const [channel, setChannel] = useState("phone");
  const [result, setResult] = useState("");
  const [detail, setDetail] = useState("");
  const [promiseDate, setPromiseDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => {
      const [overdue, acts] = await Promise.all([
        supabase
          .from("installments")
          .select("*, contracts:contract_id(id, code, customers:customer_id(full_name, phone))")
          .lt("due_date", today)
          .neq("status", "paid")
          .order("due_date"),
        supabase
          .from("collection_activities")
          .select("*, contracts:contract_id(code, customers:customer_id(full_name))")
          .order("acted_at", { ascending: false })
          .limit(100),
      ]);
      return { overdue: overdue.data ?? [], activities: acts.data ?? [] };
    },
  });

  const overdue = data?.overdue ?? [];
  const totalOverdue = overdue.reduce((s, i) => s + (i.total_amount - i.paid_amount), 0);
  const contractsInvolved = new Set(overdue.map((i) => i.contract_id)).size;

  const logActivity = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      if (!contractId) throw new Error("กรุณาเลือกสัญญา");
      const { error } = await supabase.from("collection_activities").insert({
        branch_id: profile.branch_id,
        contract_id: contractId,
        acted_at: today,
        channel,
        result: result || null,
        detail: detail || null,
        promise_date: promiseDate || null,
        created_by: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกผลการติดตามเรียบร้อย");
      setOpen(false);
      setResult("");
      setDetail("");
      setPromiseDate("");
      void qc.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uniqueContracts = Array.from(
    new Map(overdue.map((i) => [i.contract_id, i.contracts])).entries(),
  ) as [string, { code: string; customers: { full_name: string } | null } | null][];

  return (
    <div>
      <PageHeader
        title="ติดตามหนี้"
        description="รายการค่างวดที่เกินกำหนดชำระ พร้อมค่าปรับล่าช้า"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> บันทึกผลติดตาม
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="ยอดค้างชำระรวม" value={`฿${formatMoney(totalOverdue)}`} tone="danger" icon={<PhoneCall className="size-5" />} />
        <StatCard label="งวดที่ค้าง" value={String(overdue.length)} tone="warning" />
        <StatCard label="สัญญาที่ค้างชำระ" value={String(contractsInvolved)} tone="warning" />
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">งวดค้างชำระ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : overdue.length === 0 ? (
            <div className="p-6">
              <EmptyState title="ไม่มีงวดค้างชำระ" description="ยินดีด้วย ทุกสัญญาชำระตรงกำหนด" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สัญญา</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>เบอร์โทร</TableHead>
                    <TableHead>งวด</TableHead>
                    <TableHead>ครบกำหนด</TableHead>
                    <TableHead className="text-right">ค้างชำระ</TableHead>
                    <TableHead className="text-right">เกิน (วัน)</TableHead>
                    <TableHead className="text-right">ค่าปรับโดยประมาณ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdue.map((i) => {
                    const days = daysBetween(i.due_date, today);
                    const due = i.total_amount - i.paid_amount;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="tabular font-medium">{i.contracts?.code ?? "-"}</TableCell>
                        <TableCell>{i.contracts?.customers?.full_name ?? "-"}</TableCell>
                        <TableCell className="tabular">{i.contracts?.customers?.phone ?? "-"}</TableCell>
                        <TableCell className="tabular">{i.seq}</TableCell>
                        <TableCell className="tabular">{formatThaiDate(i.due_date)}</TableCell>
                        <TableCell className="tabular text-right">฿{formatMoney(due)}</TableCell>
                        <TableCell className="tabular text-right text-destructive">{days}</TableCell>
                        <TableCell className="tabular text-right">
                          ฿{formatMoney(calcPenalty(due, FALLBACK_DEFAULTS.penalty_rate_per_day, days))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ประวัติการติดตาม</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.activities ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีบันทึกการติดตาม</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>สัญญา</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>ช่องทาง</TableHead>
                  <TableHead>ผล</TableHead>
                  <TableHead>นัดชำระ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.activities ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="tabular">{formatThaiDate(a.acted_at)}</TableCell>
                    <TableCell className="tabular">{a.contracts?.code ?? "-"}</TableCell>
                    <TableCell>{a.contracts?.customers?.full_name ?? "-"}</TableCell>
                    <TableCell>{COLLECTION_CHANNEL_LABEL[a.channel] ?? a.channel}</TableCell>
                    <TableCell>{a.result ?? "-"}</TableCell>
                    <TableCell className="tabular">{a.promise_date ? formatThaiDate(a.promise_date) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>บันทึกผลการติดตาม</DialogTitle>
            <DialogDescription>บันทึกการทวงถามลูกหนี้เพื่อใช้อ้างอิงภายหลัง</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>สัญญา *</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสัญญาที่ค้างชำระ" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueContracts.map(([id, c]) => (
                    <SelectItem key={id} value={id}>
                      {c?.code} — {c?.customers?.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>ช่องทาง</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLLECTION_CHANNEL_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>วันที่นัดชำระ</Label>
                <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>ผลการติดตาม</Label>
              <Input value={result} onChange={(e) => setResult(e.target.value)} placeholder="เช่น ติดต่อได้ / ไม่รับสาย" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>รายละเอียด</Label>
              <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={1000} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => logActivity.mutate()} disabled={logActivity.isPending}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
