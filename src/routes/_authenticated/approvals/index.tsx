import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Info, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { StandardPagination, paginateRows } from "@/components/StandardPagination";
import { StandardSearch, includesThaiSearch } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDateTime } from "@/lib/format";
import { APPROVAL_STATUS_LABEL, APPROVAL_TYPE_LABEL, APPLICATION_STATUS_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/approvals/")({ component: ApprovalsPage });

function formatPayloadValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ApprovalsPage() {
  const { canApprove } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", branchId],
    queryFn: async () => {
      let q = supabase.from("approval_requests").select("*, branches:branch_id(name)").order("created_at", { ascending: false }).limit(1000);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  const { data: profiles } = useQuery({
    queryKey: ["approval-profiles", branchId],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, branch_id");
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const profileNames = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.full_name])), [profiles]);

  const applicationIds = useMemo(
    () => Array.from(new Set((data ?? []).filter((a) => a.entity_table === "loan_applications" && a.entity_id).map((a) => a.entity_id as string))),
    [data],
  );

  const { data: applicationDetails } = useQuery({
    queryKey: ["approval-application-details", applicationIds.join(",")],
    enabled: applicationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_applications")
        .select("id, code, requested_amount, approved_amount, interest_rate, term_months, status, purpose, document_no, customers:customer_id(full_name, national_id, phone), vehicles:vehicle_id(plate_no, brand, model)")
        .in("id", applicationIds);
      if (error) throw error;
      return data ?? [];
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const applicationMap = useMemo(() => new Map((applicationDetails ?? []).map((a) => [a.id, a])), [applicationDetails]);

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("execute_approval_request" as never, {
        _approval_id: id,
        _approve: approve,
        _decision_note: note.trim() || null,
      } as never);
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_result, variables) => {
      toast.success(variables.approve ? "อนุมัติและดำเนินการตามคำขอเรียบร้อย" : "ไม่อนุมัติคำขอเรียบร้อย");
      setNote("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["approvals"] }),
        qc.invalidateQueries({ queryKey: ["approval-application-details"] }),
        qc.invalidateQueries({ queryKey: ["applications"] }),
        qc.invalidateQueries({ queryKey: ["customers"] }),
        qc.invalidateQueries({ queryKey: ["contracts"] }),
        qc.invalidateQueries({ queryKey: ["contract"] }),
        qc.invalidateQueries({ queryKey: ["approved-apps"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((a) =>
    (status === "all" || a.status === status) && includesThaiSearch(search, [a.entity_label, a.reason, a.type, APPROVAL_TYPE_LABEL[a.type], a.branches?.name, a.status, APPROVAL_STATUS_LABEL[a.status], profileNames.get(a.decided_by ?? ""), profileNames.get(a.requested_by ?? "")])
  );
  useEffect(() => setPage(1), [search, status, branchId, pageSize]);
  const pagination = paginateRows(filtered, page, pageSize);

  const approvalDetails = (a: any) => {
    const payload = (a.payload ?? {}) as Record<string, any>;
    const changes = (payload['changes'] ?? {}) as Record<string, unknown>;
    const app = a.entity_table === "loan_applications" && a.entity_id ? applicationMap.get(a.entity_id) : undefined;
    const requester = a.requested_by ? (profileNames.get(a.requested_by) ?? a.requested_by) : "—";
    const customer = app?.customers as any;
    const vehicle = app?.vehicles as any;

    return (
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-semibold">ข้อมูลประกอบการพิจารณา</p>
          <p className="text-xs text-muted-foreground">คำขอ {a.entity_label ?? a.id}</p>
        </div>
        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
          <span className="text-muted-foreground">ประเภท</span><span>{APPROVAL_TYPE_LABEL[a.type] ?? a.type}</span>
          <span className="text-muted-foreground">ผู้ขอ</span><span>{requester}</span>
          <span className="text-muted-foreground">สาขา</span><span>{a.branches?.name ?? "—"}</span>
          <span className="text-muted-foreground">เวลาขอ</span><span>{formatThaiDateTime(a.created_at)}</span>
          <span className="text-muted-foreground">เหตุผล</span><span>{a.reason ?? "—"}</span>
          {payload['operation'] && <><span className="text-muted-foreground">การดำเนินการ</span><span>{formatPayloadValue(payload['operation'])}</span></>}
        </div>

        {app && (
          <div className="rounded-md border bg-muted/30 p-2.5">
            <p className="mb-1.5 font-medium">คำขอสินเชื่อปัจจุบัน</p>
            <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
              <span className="text-muted-foreground">ลูกค้า</span><span>{customer?.full_name ?? "—"}</span>
              <span className="text-muted-foreground">เลขบัตร</span><span className="tabular">{customer?.national_id ?? "—"}</span>
              <span className="text-muted-foreground">รถ</span><span>{[vehicle?.plate_no, vehicle?.brand, vehicle?.model].filter(Boolean).join(" · ") || "—"}</span>
              <span className="text-muted-foreground">วงเงินที่ขอ</span><span className="font-medium">฿{formatMoney(app.requested_amount ?? 0)}</span>
              <span className="text-muted-foreground">วงเงินอนุมัติ</span><span>{app.approved_amount != null ? `฿${formatMoney(app.approved_amount)}` : "—"}</span>
              <span className="text-muted-foreground">ดอกเบี้ย</span><span>{app.interest_rate}% / เดือน</span>
              <span className="text-muted-foreground">จำนวนงวด</span><span>{app.term_months} เดือน</span>
              <span className="text-muted-foreground">สถานะ</span><span>{APPLICATION_STATUS_LABEL[app.status] ?? app.status}</span>
              {app.purpose && <><span className="text-muted-foreground">วัตถุประสงค์</span><span>{app.purpose}</span></>}
            </div>
          </div>
        )}

        {Object.keys(changes).length > 0 && (
          <div className="rounded-md border p-2.5">
            <p className="mb-1.5 font-medium">ค่าที่ขอเปลี่ยน</p>
            <div className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1">
              {Object.entries(changes).map(([key, value]) => (
                <span key={key} className="contents">
                  <span className="break-all text-muted-foreground">{key}</span>
                  <span className="break-words font-medium">{formatPayloadValue(value)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {a.decision_note && <p className="rounded-md bg-muted p-2"><span className="font-medium">หมายเหตุผลพิจารณา:</span> {a.decision_note}</p>}
      </div>
    );
  };

  return <div>
    <PageHeader title="คำขออนุมัติ" description="ศูนย์กลางคำขอแก้ไข ยกเลิก และรายการที่ต้องผ่านผู้มีอำนาจ" />
    <Card className="mb-4"><CardContent className="flex flex-wrap gap-3 p-4"><StandardSearch value={search} onChange={setSearch} placeholder="ค้นหาประเภท / รายการ / เหตุผล / สาขา / ผู้ขอ / ผู้อนุมัติ / สถานะ" /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem>{Object.entries(APPROVAL_STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    {canApprove && <Card className="mb-4"><CardContent className="p-4"><Input placeholder="หมายเหตุประกอบการพิจารณา (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></CardContent></Card>}
    <Card><CardContent className="p-0">{isLoading ? <div className="p-6">กำลังโหลด...</div> : filtered.length === 0 ? <div className="p-6"><EmptyState title="ไม่มีคำขออนุมัติที่ตรงเงื่อนไข" /></div> : <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ประเภท</TableHead><TableHead>รายการ</TableHead><TableHead>เหตุผล</TableHead><TableHead>สาขา</TableHead><TableHead>เวลาขอ</TableHead><TableHead>สถานะ</TableHead><TableHead>ผู้อนุมัติ</TableHead><TableHead>เวลาพิจารณา</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader><TableBody>{pagination.rows.map((a) => <TableRow key={a.id}><TableCell>{APPROVAL_TYPE_LABEL[a.type] ?? a.type}</TableCell><TableCell className="tabular font-medium"><HoverCard openDelay={250}><HoverCardTrigger asChild><button type="button" className="inline-flex items-center gap-1.5 text-left underline-offset-4 hover:text-primary hover:underline"><Info className="size-3.5 text-muted-foreground" />{a.entity_label ?? "-"}</button></HoverCardTrigger><HoverCardContent align="start" className="w-[420px] max-w-[90vw]">{approvalDetails(a)}</HoverCardContent></HoverCard></TableCell><TableCell className="max-w-72"><HoverCard openDelay={250}><HoverCardTrigger asChild><span className="line-clamp-2 cursor-help">{a.reason ?? "-"}</span></HoverCardTrigger><HoverCardContent align="start" className="w-[420px] max-w-[90vw]">{approvalDetails(a)}</HoverCardContent></HoverCard></TableCell><TableCell>{a.branches?.name ?? "-"}</TableCell><TableCell className="tabular text-muted-foreground">{formatThaiDateTime(a.created_at)}</TableCell><TableCell><StatusPill status={a.status} label={APPROVAL_STATUS_LABEL[a.status] ?? a.status} /></TableCell><TableCell>{a.decided_by ? (profileNames.get(a.decided_by) ?? a.decided_by) : "-"}</TableCell><TableCell className="tabular text-muted-foreground">{a.decided_at ? formatThaiDateTime(a.decided_at) : "-"}</TableCell><TableCell className="text-right">{a.status === "pending" && canApprove && <div className="flex justify-end gap-1"><Button size="sm" onClick={() => decide.mutate({ id: a.id, approve: true })} disabled={decide.isPending}><Check className="size-3.5" /> อนุมัติ</Button><Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, approve: false })} disabled={decide.isPending}><X className="size-3.5" /> ไม่อนุมัติ</Button></div>}</TableCell></TableRow>)}</TableBody></Table></div><StandardPagination page={pagination.page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize}/></>}</CardContent></Card>
  </div>;
}

