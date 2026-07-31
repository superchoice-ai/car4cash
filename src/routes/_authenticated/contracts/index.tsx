import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatMoney, formatThaiDate, todayISO, addMonths } from "@/lib/format";
import { CONTRACT_STATUS_LABEL } from "@/lib/labels";
import { buildSchedule } from "@/lib/loan";

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({
    meta: [
      { title: "สัญญาสินเชื่อ | ธารทรัพย์" },
      { name: "description", content: "จัดทำสัญญาจากคำขอที่อนุมัติแล้ว สร้างตารางผ่อนชำระ และติดตามยอดคงค้าง" },
      { property: "og:title", content: "สัญญาสินเชื่อ | ธารทรัพย์" },
      { property: "og:description", content: "จัดทำและติดตามสัญญาสินเชื่อรถแลกเงิน" },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const { profile, isHQ } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [firstDue, setFirstDue] = useState(addMonths(todayISO(), 1));

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, customers:customer_id(full_name), vehicles:vehicle_id(plate_no), branches:branch_id(name)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: approvedApps } = useQuery({
    queryKey: ["approved-apps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loan_applications")
        .select("id, code, customer_id, vehicle_id, approved_amount, requested_amount, interest_rate, term_months, fee_amount, customers:customer_id(full_name)")
        .eq("status", "approved");
      return data ?? [];
    },
  });

  const createContract = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      const app = (approvedApps ?? []).find((a) => a.id === appId);
      if (!app) throw new Error("กรุณาเลือกคำขอที่อนุมัติแล้ว");

      const principal = app.approved_amount ?? app.requested_amount;
      const summary = buildSchedule(
        { principal, interestRate: Number(app.interest_rate), termMonths: app.term_months },
        firstDue,
      );

      const { data: code, error: cErr } = await supabase.rpc("next_doc_no", {
        _branch: profile.branch_id,
        _doc_type: "CTR",
      });
      if (cErr) throw cErr;

      const lastDue = summary.schedule[summary.schedule.length - 1]!.dueDate;
      const { data: contract, error } = await supabase
        .from("contracts")
        .insert({
          branch_id: profile.branch_id,
          code: code as string,
          application_id: app.id,
          customer_id: app.customer_id,
          vehicle_id: app.vehicle_id,
          principal,
          interest_rate: Number(app.interest_rate),
          term_months: app.term_months,
          installment_amount: summary.installment,
          total_payable: summary.totalPayable,
          outstanding: summary.totalPayable,
          fee_amount: app.fee_amount ?? 0,
          start_date: startDate,
          first_due_date: firstDue,
          end_date: lastDue,
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = summary.schedule.map((s) => ({
        branch_id: profile.branch_id!,
        contract_id: contract.id,
        seq: s.seq,
        due_date: s.dueDate,
        principal_amount: s.principalAmount,
        interest_amount: s.interestAmount,
        total_amount: s.totalAmount,
      }));
      const { error: iErr } = await supabase.from("installments").insert(rows);
      if (iErr) throw iErr;

      const { error: dErr } = await supabase.from("disbursements").insert({
        branch_id: profile.branch_id,
        contract_id: contract.id,
        paid_at: startDate,
        amount: principal - (app.fee_amount ?? 0),
        method: "transfer",
        paid_by: profile.id,
      });
      if (dErr) throw dErr;

      await supabase.from("loan_applications").update({ status: "contracted" }).eq("id", app.id);
      await supabase.from("vehicles").update({ book_status: "received" }).eq("id", app.vehicle_id!);
    },
    onSuccess: () => {
      toast.success("สร้างสัญญาและตารางผ่อนชำระเรียบร้อย");
      setOpen(false);
      setAppId("");
      void qc.invalidateQueries({ queryKey: ["contracts"] });
      void qc.invalidateQueries({ queryKey: ["approved-apps"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="สัญญาสินเชื่อ"
        description="จัดทำสัญญาจากคำขอที่อนุมัติ พร้อมตารางผ่อนชำระอัตโนมัติ"
        actions={
          <Button onClick={() => setOpen(true)}>
            <FilePlus2 className="size-4" /> ทำสัญญาใหม่
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
          ) : (contracts ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีสัญญา" description="เมื่อคำขอได้รับการอนุมัติ จะสามารถจัดทำสัญญาได้" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่สัญญา</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>ทะเบียนรถ</TableHead>
                    <TableHead className="text-right">เงินต้น</TableHead>
                    <TableHead className="text-right">ค่างวด</TableHead>
                    <TableHead className="text-right">คงค้าง</TableHead>
                    {isHQ && <TableHead>สาขา</TableHead>}
                    <TableHead>เริ่มสัญญา</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(contracts ?? []).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="tabular font-medium">
                        <Link to="/contracts/$contractId" params={{ contractId: c.id }} className="text-primary hover:underline">
                          {c.code}
                        </Link>
                      </TableCell>
                      <TableCell>{c.customers?.full_name ?? "-"}</TableCell>
                      <TableCell>{c.vehicles?.plate_no ?? "-"}</TableCell>
                      <TableCell className="tabular text-right">฿{formatMoney(c.principal)}</TableCell>
                      <TableCell className="tabular text-right">฿{formatMoney(c.installment_amount)}</TableCell>
                      <TableCell className="tabular text-right font-medium">฿{formatMoney(c.outstanding)}</TableCell>
                      {isHQ && <TableCell>{c.branches?.name ?? "-"}</TableCell>}
                      <TableCell className="tabular">{formatThaiDate(c.start_date)}</TableCell>
                      <TableCell>
                        <StatusPill status={c.status} label={CONTRACT_STATUS_LABEL[c.status] ?? c.status} />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ทำสัญญาใหม่</DialogTitle>
            <DialogDescription>เลือกคำขอที่อนุมัติแล้ว ระบบจะสร้างตารางผ่อนชำระให้อัตโนมัติ</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>คำขอที่อนุมัติแล้ว *</Label>
              <Select value={appId} onValueChange={setAppId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกคำขอ" />
                </SelectTrigger>
                <SelectContent>
                  {(approvedApps ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.customers?.full_name} — ฿{formatMoney(a.approved_amount ?? a.requested_amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>วันเริ่มสัญญา</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>วันครบกำหนดงวดแรก</Label>
                <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => createContract.mutate()} disabled={createContract.isPending}>
              สร้างสัญญา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
