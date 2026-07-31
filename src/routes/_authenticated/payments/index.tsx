import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, EmptyState } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatMoney, formatThaiDate, todayISO, toSatang } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/payments/")({
  head: () => ({
    meta: [
      { title: "รับชำระเงิน | ธารทรัพย์" },
      { name: "description", content: "บันทึกการรับชำระค่างวด ออกเลขที่ใบเสร็จ และตัดยอดคงค้างอัตโนมัติ" },
      { property: "og:title", content: "รับชำระเงิน | ธารทรัพย์" },
      { property: "og:description", content: "บันทึกการรับชำระค่างวดสินเชื่อ" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { profile, isHQ } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [contractId, setContractId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contracts:contract_id(code, customers:customer_id(full_name)), branches:branch_id(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: activeContracts } = useQuery({
    queryKey: ["contracts-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, code, outstanding, installment_amount, customers:customer_id(full_name)")
        .in("status", ["active", "overdue"])
        .order("code");
      return data ?? [];
    },
  });

  const receive = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      if (!contractId) throw new Error("กรุณาเลือกสัญญา");
      const amt = toSatang(amount || "0");
      if (amt <= 0) throw new Error("กรุณากรอกจำนวนเงิน");

      const { data: receiptNo, error: rErr } = await supabase.rpc("next_doc_no", {
        _branch: profile.branch_id,
        _doc_type: "RCP",
      });
      if (rErr) throw rErr;

      const { data: installments, error: iErr } = await supabase
        .from("installments")
        .select("*")
        .eq("contract_id", contractId)
        .neq("status", "paid")
        .order("seq");
      if (iErr) throw iErr;

      let remaining = amt;
      let principalPart = 0;
      let interestPart = 0;
      let firstInstallmentId: string | null = null;

      for (const ins of installments ?? []) {
        if (remaining <= 0) break;
        const due = ins.total_amount - ins.paid_amount;
        const applied = Math.min(remaining, due);
        remaining -= applied;
        if (!firstInstallmentId) firstInstallmentId = ins.id;

        const ratio = ins.total_amount > 0 ? applied / ins.total_amount : 0;
        principalPart += Math.round(ins.principal_amount * ratio);
        interestPart += Math.round(ins.interest_amount * ratio);

        const newPaid = ins.paid_amount + applied;
        const { error } = await supabase
          .from("installments")
          .update({
            paid_amount: newPaid,
            status: newPaid >= ins.total_amount ? "paid" : "partial",
            paid_date: newPaid >= ins.total_amount ? paidAt : null,
          })
          .eq("id", ins.id);
        if (error) throw error;
      }

      const { error: pErr } = await supabase.from("payments").insert({
        branch_id: profile.branch_id,
        receipt_no: receiptNo as string,
        contract_id: contractId,
        installment_id: firstInstallmentId,
        paid_at: paidAt,
        amount: amt,
        principal_part: principalPart,
        interest_part: interestPart,
        method,
        reference: reference || null,
        note: note || null,
        received_by: profile.id,
      });
      if (pErr) throw pErr;

      const contract = (activeContracts ?? []).find((c) => c.id === contractId);
      const newOutstanding = Math.max(0, (contract?.outstanding ?? 0) - amt);
      const { error: cErr } = await supabase
        .from("contracts")
        .update({ outstanding: newOutstanding, status: newOutstanding === 0 ? "closed" : "active" })
        .eq("id", contractId);
      if (cErr) throw cErr;
    },
    onSuccess: () => {
      toast.success("บันทึกการรับชำระเรียบร้อย");
      setOpen(false);
      setAmount("");
      setReference("");
      setNote("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = (activeContracts ?? []).find((c) => c.id === contractId);

  return (
    <div>
      <PageHeader
        title="รับชำระเงิน"
        description="บันทึกการรับชำระค่างวด ระบบจะตัดยอดตามลำดับงวดให้อัตโนมัติ"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Receipt className="size-4" /> รับชำระใหม่
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (payments ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีรายการรับชำระ" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่ใบเสร็จ</TableHead>
                    <TableHead>สัญญา</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>วันที่ชำระ</TableHead>
                    <TableHead>ช่องทาง</TableHead>
                    {isHQ && <TableHead>สาขา</TableHead>}
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(payments ?? []).map((p) => (
                    <TableRow key={p.id} className={p.voided ? "opacity-50 line-through" : ""}>
                      <TableCell className="tabular font-medium">{p.receipt_no}</TableCell>
                      <TableCell className="tabular">{p.contracts?.code ?? "-"}</TableCell>
                      <TableCell>{p.contracts?.customers?.full_name ?? "-"}</TableCell>
                      <TableCell className="tabular">{formatThaiDate(p.paid_at)}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TableCell>
                      {isHQ && <TableCell>{p.branches?.name ?? "-"}</TableCell>}
                      <TableCell className="tabular text-right font-medium">฿{formatMoney(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>บันทึกการรับชำระ</DialogTitle>
            <DialogDescription>ระบบจะตัดชำระงวดที่ค้างเรียงตามลำดับ</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>สัญญา *</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสัญญา" />
                </SelectTrigger>
                <SelectContent>
                  {(activeContracts ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.customers?.full_name} — คงค้าง ฿{formatMoney(c.outstanding)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-xs text-muted-foreground">
                  ค่างวดปกติ ฿{formatMoney(selected.installment_amount)} · คงค้าง ฿{formatMoney(selected.outstanding)}
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>จำนวนเงิน (บาท) *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>วันที่ชำระ</Label>
                <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ช่องทาง</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>เลขที่อ้างอิง</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={60} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>หมายเหตุ</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => receive.mutate()} disabled={receive.isPending}>
              บันทึกและออกใบเสร็จ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
