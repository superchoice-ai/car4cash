import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  FileSignature,
  Wallet,
  AlertTriangle,
  TrendingUp,
  CheckSquare,
  Building2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, StatCard } from "@/components/Common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney, formatNumber, todayISO, formatThaiDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ดผู้บริหาร | SuperChoice AI" },
      { name: "description", content: "ภาพรวมยอดปล่อยสินเชื่อ ยอดคงค้าง หนี้ค้างชำระ และผลงานรายสาขาแบบเรียลไทม์" },
      { property: "og:title", content: "แดชบอร์ดผู้บริหาร | SuperChoice AI" },
      { property: "og:description", content: "ภาพรวมสินเชื่อและผลงานรายสาขา" },
    ],
  }),
  component: DashboardPage,
});

interface ContractRow {
  id: string;
  branch_id: string;
  principal: number;
  outstanding: number;
  status: string;
  created_at: string;
}

function DashboardPage() {
  const { isHQ, branch } = useAuth();
  const { branchId, scopeName } = useBranchFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", branchId],
    queryFn: async () => {
      const today = todayISO();
      const bf = <T extends { eq: (c: string, v: string) => T }>(q: T): T =>
        branchId ? q.eq("branch_id", branchId) : q;

      const [customers, contracts, payments, overdue, pendingAppr, branches] = await Promise.all([
        bf(supabase.from("customers").select("id", { count: "exact", head: true })),
        bf(supabase.from("contracts").select("id, branch_id, principal, outstanding, status, created_at")),
        bf(supabase.from("payments").select("amount, paid_at, branch_id").eq("voided", false)),
        bf(
          supabase
            .from("installments")
            .select("id, total_amount, paid_amount, due_date, contract_id")
            .lt("due_date", today)
            .in("status", ["unpaid", "partial", "overdue"]),
        ),
        bf(supabase.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
        supabase.from("branches").select("id, code, name").eq("active", true),
      ]);

      const cash = await bf(
        supabase
          .from("cash_entries")
          .select("direction, total_amount, entry_date")
          .eq("voided", false)
          .gte("entry_date", today.slice(0, 8) + "01"),
      );

      return {
        customerCount: customers.count ?? 0,
        contracts: (contracts.data ?? []) as ContractRow[],
        payments: (payments.data ?? []) as { amount: number; paid_at: string; branch_id: string }[],
        overdue: (overdue.data ?? []) as { total_amount: number; paid_amount: number }[],
        pendingApprovals: pendingAppr.count ?? 0,
        branches: (branches.data ?? []) as { id: string; code: string; name: string }[],
        cash: (cash.data ?? []) as { direction: string; total_amount: number; entry_date: string }[],
      };
    },
  });

  const contracts = data?.contracts ?? [];
  const activeContracts = contracts.filter((c) => c.status === "active" || c.status === "overdue");
  const totalOutstanding = activeContracts.reduce((s, c) => s + Number(c.outstanding), 0);
  const totalDisbursed = contracts.reduce((s, c) => s + Number(c.principal), 0);
  const overdueAmount = (data?.overdue ?? []).reduce(
    (s, i) => s + (Number(i.total_amount) - Number(i.paid_amount)),
    0,
  );
  const npl = totalOutstanding > 0 ? (overdueAmount / totalOutstanding) * 100 : 0;

  const today = todayISO();
  const month = today.slice(0, 7);
  const todayCollected = (data?.payments ?? [])
    .filter((p) => p.paid_at === today)
    .reduce((s, p) => s + Number(p.amount), 0);
  const monthCollected = (data?.payments ?? [])
    .filter((p) => p.paid_at.startsWith(month))
    .reduce((s, p) => s + Number(p.amount), 0);

  const cashRows = data?.cash ?? [];
  const sumCash = (dir: string, onlyToday: boolean) =>
    cashRows
      .filter((r) => r.direction === dir && (!onlyToday || r.entry_date === today))
      .reduce((s, r) => s + Number(r.total_amount), 0);
  const incomeToday = sumCash("income", true);
  const expenseToday = sumCash("expense", true);
  const incomeMonth = sumCash("income", false);
  const expenseMonth = sumCash("expense", false);

  // แนวโน้ม 6 เดือนย้อนหลัง
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("th-TH", { month: "short" }),
    });
  }
  const trend = months.map((m) => ({
    name: m.label,
    ปล่อยสินเชื่อ: contracts
      .filter((c) => c.created_at.startsWith(m.key))
      .reduce((s, c) => s + Number(c.principal), 0) / 100,
    รับชำระ: (data?.payments ?? [])
      .filter((p) => p.paid_at.startsWith(m.key))
      .reduce((s, p) => s + Number(p.amount), 0) / 100,
  }));

  const byBranch = (data?.branches ?? []).map((b) => ({
    name: b.code,
    fullName: b.name,
    ยอดคงค้าง: activeContracts.filter((c) => c.branch_id === b.id).reduce((s, c) => s + Number(c.outstanding), 0) / 100,
    สัญญา: activeContracts.filter((c) => c.branch_id === b.id).length,
  }));

  return (
    <div>
      <PageHeader
        title="แดชบอร์ดผู้บริหาร"
        description={
          isHQ
            ? "ภาพรวมทุกสาขาในจังหวัดสุราษฎร์ธานี"
            : `ภาพรวมของ ${branch?.name ?? "สาขา"} — ข้อมูล ณ ${formatThaiDate(today)}`
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/reports">ดูรายงาน</Link>
            </Button>
            <Button asChild>
              <Link to="/applications">สร้างคำขอสินเชื่อ</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="ยอดคงค้างทั้งหมด"
          value={`฿${formatMoney(totalOutstanding)}`}
          sub={`สัญญาที่ยังไม่ปิด ${formatNumber(activeContracts.length)} ฉบับ`}
          icon={<FileSignature className="size-5" />}
        />
        <StatCard
          label="ยอดปล่อยสินเชื่อสะสม"
          value={`฿${formatMoney(totalDisbursed)}`}
          sub={`ลูกค้าทั้งหมด ${formatNumber(data?.customerCount ?? 0)} ราย`}
          icon={<TrendingUp className="size-5" />}
          tone="success"
        />
        <StatCard
          label="รับชำระวันนี้"
          value={`฿${formatMoney(todayCollected)}`}
          sub={`เดือนนี้ ฿${formatMoney(monthCollected)}`}
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="ยอดค้างชำระ (NPL)"
          value={`฿${formatMoney(overdueAmount)}`}
          sub={`คิดเป็น ${npl.toFixed(1)}% ของยอดคงค้าง`}
          icon={<AlertTriangle className="size-5" />}
          tone={npl > 10 ? "danger" : "warning"}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="รออนุมัติ"
          value={formatNumber(data?.pendingApprovals ?? 0)}
          sub="รายการที่ต้องดำเนินการ"
          icon={<CheckSquare className="size-5" />}
          tone={(data?.pendingApprovals ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard label="ลูกค้าทั้งหมด" value={formatNumber(data?.customerCount ?? 0)} icon={<Users className="size-5" />} />
        <StatCard
          label="สาขาที่เปิดใช้งาน"
          value={formatNumber(data?.branches.length ?? 0)}
          sub="จ.สุราษฎร์ธานี"
          icon={<Building2 className="size-5" />}
        />
        <StatCard
          label="ค่างวดเฉลี่ยต่อสัญญา"
          value={`฿${formatMoney(activeContracts.length ? Math.round(totalOutstanding / activeContracts.length) : 0)}`}
          icon={<Wallet className="size-5" />}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="รายรับวันนี้ (สมุดบัญชี)"
          value={`฿${formatMoney(incomeToday)}`}
          sub={`เดือนนี้ ฿${formatMoney(incomeMonth)}`}
          tone="success"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="รายจ่ายวันนี้"
          value={`฿${formatMoney(expenseToday)}`}
          sub={`เดือนนี้ ฿${formatMoney(expenseMonth)}`}
          tone="danger"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="กำไรขั้นต้นวันนี้"
          value={`฿${formatMoney(incomeToday - expenseToday)}`}
          sub={`เดือนนี้ ฿${formatMoney(incomeMonth - expenseMonth)}`}
          tone={incomeToday - expenseToday >= 0 ? "success" : "danger"}
          icon={<TrendingUp className="size-5" />}
        />
        <StatCard
          label="ยอดตัดค่างวดวันนี้"
          value={`฿${formatMoney(todayCollected)}`}
          sub={`เดือนนี้ ฿${formatMoney(monthCollected)}`}
          icon={<Wallet className="size-5" />}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">แนวโน้ม 6 เดือน (บาท)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="h-full animate-pulse rounded bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `฿${v.toLocaleString("th-TH")}`} />
                  <Line type="monotone" dataKey="ปล่อยสินเชื่อ" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="รับชำระ" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ยอดคงค้างรายสาขา (บาท)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <div className="h-full animate-pulse rounded bg-muted" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBranch}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `฿${v.toLocaleString("th-TH")}`} />
                  <Bar dataKey="ยอดคงค้าง" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
