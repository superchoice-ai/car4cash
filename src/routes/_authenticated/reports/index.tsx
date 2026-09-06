import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, StatCard } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, todayISO, formatThaiDate } from "@/lib/format";
import { REPORTS } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "รายงานผล | SuperChoice AI" },
      { name: "description", content: "เมนูรายงานผลทั้งหมด — รายรับ รายจ่าย บัญชีลูกหนี้ ค้างชำระ และการติดตามหนี้ พิมพ์ A4 ภาษาไทย" },
      { property: "og:title", content: "รายงานผล | SuperChoice AI" },
      { property: "og:description", content: "เมนูรายงานรูปแบบเดียวกับระบบเดิม พิมพ์กระดาษ A4" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const today = todayISO();
  const { branchId, scopeName } = useBranchFilter();

  const { data } = useQuery({
    queryKey: ["report-summary", today, branchId],
    queryFn: async () => {
      const bf = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
        branchId ? q.eq("branch_id", branchId) : q;
      const [inc, exp, ctr] = await Promise.all([
        bf(supabase.from("cash_entries").select("total_amount").eq("direction", "income").eq("voided", false).eq("entry_date", today)),
        bf(supabase.from("cash_entries").select("total_amount").eq("direction", "expense").eq("voided", false).eq("entry_date", today)),
        bf(supabase.from("contracts").select("outstanding").in("status", ["active", "overdue"])),
      ]);
      return {
        income: (inc.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0),
        expense: (exp.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0),
        outstanding: (ctr.data ?? []).reduce((s, r) => s + Number(r.outstanding), 0),
      };
    },
  });

  const groups = Array.from(new Set(REPORTS.map((r) => r.group)));

  return (
    <div>
      <PageHeader
        title="รายงานผล"
        description={`เลือกรายงานที่ต้องการพิมพ์ · ขอบเขต: ${scopeName} · ข้อมูล ณ วันที่ ${formatThaiDate(today)}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/reports/legacy">รายงานข้อมูลระบบเดิม</Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> พิมพ์หน้านี้
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="รายรับวันนี้" value={`฿${formatMoney(data?.income ?? 0)}`} tone="success" />
        <StatCard label="รายจ่ายวันนี้" value={`฿${formatMoney(data?.expense ?? 0)}`} tone="danger" />
        <StatCard label="ยอดคงค้างรวม" value={`฿${formatMoney(data?.outstanding ?? 0)}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{g}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 p-3">
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <Link
                  key={r.id}
                  to="/reports/$reportId"
                  params={{ reportId: r.id }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  <FileBarChart className="size-4 shrink-0 text-primary" />
                  <span className="flex-1">{r.title}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
