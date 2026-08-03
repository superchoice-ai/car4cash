import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatThaiDateTime } from "@/lib/format";
import { APPROVAL_STATUS_LABEL, APPROVAL_TYPE_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/approvals/")({
  head: () => ({
    meta: [
      { title: "คำขออนุมัติ | ธารทรัพย์" },
      { name: "description", content: "ศูนย์กลางการอนุมัติคำขอสินเชื่อ การลบข้อมูล และรายการที่ต้องผ่านผู้มีอำนาจ" },
      { property: "og:title", content: "คำขออนุมัติ | ธารทรัพย์" },
      { property: "og:description", content: "จัดการคำขออนุมัติทุกประเภทในระบบ" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { profile, canApprove } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["approvals", branchId],
    queryFn: async () => {
      let q = supabase
        .from("approval_requests")
        .select("*, branches:branch_id(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: approve ? "approved" : "rejected",
          decided_by: profile?.id ?? null,
          decided_at: new Date().toISOString(),
          decision_note: note || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกผลการพิจารณาแล้ว");
      setNote("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader title="คำขออนุมัติ" description="รายการที่ต้องผ่านการอนุมัติจากผู้มีอำนาจ" />

      {canApprove && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <Input placeholder="หมายเหตุประกอบการพิจารณา (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState title="ไม่มีคำขออนุมัติ" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{APPROVAL_TYPE_LABEL[a.type] ?? a.type}</TableCell>
                      <TableCell className="tabular font-medium">{a.entity_label ?? "-"}</TableCell>
                      <TableCell className="max-w-64 truncate">{a.reason ?? "-"}</TableCell>
                      <TableCell>{a.branches?.name ?? "-"}</TableCell>
                      <TableCell className="tabular text-muted-foreground">{formatThaiDateTime(a.created_at)}</TableCell>
                      <TableCell>
                        <StatusPill status={a.status} label={APPROVAL_STATUS_LABEL[a.status] ?? a.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {a.status === "pending" && canApprove && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" onClick={() => decide.mutate({ id: a.id, approve: true })}>
                              <Check className="size-3.5" /> อนุมัติ
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, approve: false })}>
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
    </div>
  );
}
