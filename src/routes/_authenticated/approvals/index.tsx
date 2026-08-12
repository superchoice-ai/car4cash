import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { StandardPagination, paginateRows } from "@/components/StandardPagination";
import { StandardSearch, includesThaiSearch } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatThaiDateTime } from "@/lib/format";
import { APPROVAL_STATUS_LABEL, APPROVAL_TYPE_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/approvals/")({ component: ApprovalsPage });

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
  });
  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { error } = await rpc("execute_approval_request", { _approval_id: id, _approve: approve, _decision_note: note || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { toast.success("บันทึกผลและดำเนินการตามคำขอเรียบร้อย"); setNote(""); void qc.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (data ?? []).filter((a) =>
    (status === "all" || a.status === status) && includesThaiSearch(search, [a.entity_label, a.reason, a.type, APPROVAL_TYPE_LABEL[a.type], a.branches?.name, a.status, APPROVAL_STATUS_LABEL[a.status], profileNames.get(a.decided_by ?? "")])
  );
  useEffect(() => setPage(1), [search, status, branchId, pageSize]);
  const pagination = paginateRows(filtered, page, pageSize);

  return <div>
    <PageHeader title="คำขออนุมัติ" description="ศูนย์กลางคำขอแก้ไข ยกเลิก และรายการที่ต้องผ่านผู้มีอำนาจ" />
    <Card className="mb-4"><CardContent className="flex flex-wrap gap-3 p-4"><StandardSearch value={search} onChange={setSearch} placeholder="ค้นหาประเภท / รายการ / เหตุผล / สาขา / ผู้อนุมัติ / สถานะ" /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทุกสถานะ</SelectItem>{Object.entries(APPROVAL_STATUS_LABEL).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    {canApprove && <Card className="mb-4"><CardContent className="p-4"><Input placeholder="หมายเหตุประกอบการพิจารณา (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></CardContent></Card>}
    <Card><CardContent className="p-0">{isLoading ? <div className="p-6">กำลังโหลด...</div> : filtered.length === 0 ? <div className="p-6"><EmptyState title="ไม่มีคำขออนุมัติที่ตรงเงื่อนไข" /></div> : <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ประเภท</TableHead><TableHead>รายการ</TableHead><TableHead>เหตุผล</TableHead><TableHead>สาขา</TableHead><TableHead>เวลาขอ</TableHead><TableHead>สถานะ</TableHead><TableHead>ผู้อนุมัติ</TableHead><TableHead>เวลาพิจารณา</TableHead><TableHead className="text-right">จัดการ</TableHead></TableRow></TableHeader><TableBody>{pagination.rows.map((a) => <TableRow key={a.id}><TableCell>{APPROVAL_TYPE_LABEL[a.type] ?? a.type}</TableCell><TableCell className="tabular font-medium">{a.entity_label ?? "-"}</TableCell><TableCell className="max-w-72"><span className="line-clamp-2">{a.reason ?? "-"}</span></TableCell><TableCell>{a.branches?.name ?? "-"}</TableCell><TableCell className="tabular text-muted-foreground">{formatThaiDateTime(a.created_at)}</TableCell><TableCell><StatusPill status={a.status} label={APPROVAL_STATUS_LABEL[a.status] ?? a.status} /></TableCell><TableCell>{a.decided_by ? (profileNames.get(a.decided_by) ?? a.decided_by) : "-"}</TableCell><TableCell className="tabular text-muted-foreground">{a.decided_at ? formatThaiDateTime(a.decided_at) : "-"}</TableCell><TableCell className="text-right">{a.status === "pending" && canApprove && <div className="flex justify-end gap-1"><Button size="sm" onClick={() => decide.mutate({ id: a.id, approve: true })} disabled={decide.isPending}><Check className="size-3.5" /> อนุมัติ</Button><Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, approve: false })} disabled={decide.isPending}><X className="size-3.5" /> ไม่อนุมัติ</Button></div>}</TableCell></TableRow>)}</TableBody></Table></div><StandardPagination page={pagination.page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize}/></>}</CardContent></Card>
  </div>;
}