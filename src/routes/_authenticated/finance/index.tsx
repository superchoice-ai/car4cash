import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatCard } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO } from "@/lib/format";
import {
  CASH_CATEGORIES,
  CASH_CATEGORY_LABEL,
  CASH_DIRECTION_LABEL,
  type CashCategory,
  type CashDirection,
} from "@/lib/cashbook";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({
    meta: [
      { title: "สมุดรายรับ-รายจ่าย | ธารทรัพย์" },
      {
        name: "description",
        content: "สมุดบัญชีรายรับและรายจ่ายรวมของสาขา แยกตามหมวดดอกเบี้ย ค่าปรับ ประกัน ทะเบียน และค่าติดตาม",
      },
      { property: "og:title", content: "สมุดรายรับ-รายจ่าย | ธารทรัพย์" },
      { property: "og:description", content: "สรุปกระแสเงินสดรับ-จ่ายของสาขาแยกหมวด" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CashbookPage,
});

function CashbookPage() {
  const { isHQ, branch } = useAuth();
  const { branchId, scopeName } = useBranchFilter();
  const monthStart = todayISO().slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayISO());
  const [direction, setDirection] = useState<"all" | CashDirection>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["cashbook", from, to, branchId],
    queryFn: async () => {
      let q = supabase
        .from("cash_entries")
        .select("*, branches:branch_id(name), cash_entry_lines(id, category, amount)")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .eq("voided", false)
        .order("entry_date", { ascending: false })
        .order("doc_no", { ascending: false })
        .limit(1000);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = data ?? [];
  const rows = all.filter(
    (r) =>
      (direction === "all" || r.direction === direction) &&
      (categoryFilter === "all" || r.cash_entry_lines.some((l) => l.category === categoryFilter)),
  );

  const income = all.filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.total_amount), 0);
  const expense = all.filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.total_amount), 0);

  const byCategory = CASH_CATEGORIES.map((c) => {
    const pick = (d: CashDirection) =>
      all
        .filter((r) => r.direction === d)
        .reduce(
          (s, r) => s + r.cash_entry_lines.filter((l) => l.category === c.key).reduce((a, l) => a + Number(l.amount), 0),
          0,
        );
    return { key: c.key as CashCategory, label: c.label, income: pick("income"), expense: pick("expense") };
  }).filter((c) => c.income > 0 || c.expense > 0);

  return (
    <div>
      <PageHeader
        title="สมุดรายรับ-รายจ่าย"
        description="รวมรายการรับเงินจากลูกค้าและรายจ่ายของสาขาไว้ในสมุดเดียว แยกตามหมวดบัญชี"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/finance/expenses">บันทึกรายจ่าย</Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> พิมพ์
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="รายรับรวม"
          value={`฿${formatMoney(income)}`}
          tone="success"
          icon={<ArrowDownCircle className="size-5" />}
        />
        <StatCard
          label="รายจ่ายรวม"
          value={`฿${formatMoney(expense)}`}
          tone="danger"
          icon={<ArrowUpCircle className="size-5" />}
        />
        <StatCard
          label="คงเหลือสุทธิ"
          value={`฿${formatMoney(income - expense)}`}
          sub={`${formatThaiDate(from)} ถึง ${formatThaiDate(to)}`}
          tone={income - expense >= 0 ? "success" : "danger"}
          icon={<Scale className="size-5" />}
        />
      </div>

      <Card className="no-print mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>ตั้งแต่วันที่</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ถึงวันที่</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ทิศทาง</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as "all" | CashDirection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="income">รายรับ</SelectItem>
                <SelectItem value="expense">รายจ่าย</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>หมวด</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวด</SelectItem>
                {CASH_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">รายการเคลื่อนไหว ({branch?.name ?? "ทุกสาขา"})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6">
                <EmptyState title="ไม่มีรายการในช่วงที่เลือก" />
              </div>
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่</TableHead>
                      <TableHead>วันที่</TableHead>
                      <TableHead>รายการ</TableHead>
                      {isHQ && <TableHead>สาขา</TableHead>}
                      <TableHead className="text-right">รับ</TableHead>
                      <TableHead className="text-right">จ่าย</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="tabular">{r.doc_no}</TableCell>
                        <TableCell className="tabular whitespace-nowrap">{formatThaiDate(r.entry_date)}</TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {r.party_name || CASH_DIRECTION_LABEL[r.direction]}
                          <span className="block text-muted-foreground">
                            {r.cash_entry_lines.map((l) => CASH_CATEGORY_LABEL[l.category]).join(", ")}
                          </span>
                        </TableCell>
                        {isHQ && <TableCell>{r.branches?.name ?? "-"}</TableCell>}
                        <TableCell className="tabular text-right text-success">
                          {r.direction === "income" ? formatMoney(r.total_amount) : ""}
                        </TableCell>
                        <TableCell className="tabular text-right text-destructive">
                          {r.direction === "expense" ? formatMoney(r.total_amount) : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={isHQ ? 4 : 3} className="text-right font-semibold">
                        รวม
                      </TableCell>
                      <TableCell className="tabular text-right font-bold">
                        {formatMoney(rows.filter((r) => r.direction === "income").reduce((s, r) => s + Number(r.total_amount), 0))}
                      </TableCell>
                      <TableCell className="tabular text-right font-bold">
                        {formatMoney(rows.filter((r) => r.direction === "expense").reduce((s, r) => s + Number(r.total_amount), 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">สรุปยอดบัญชีแยกประเภท</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {byCategory.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>หมวด</TableHead>
                    <TableHead className="text-right">รับ</TableHead>
                    <TableHead className="text-right">จ่าย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell>{c.label}</TableCell>
                      <TableCell className="tabular text-right">{c.income ? formatMoney(c.income) : "-"}</TableCell>
                      <TableCell className="tabular text-right">{c.expense ? formatMoney(c.expense) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">รวม</TableCell>
                    <TableCell className="tabular text-right font-bold">{formatMoney(income)}</TableCell>
                    <TableCell className="tabular text-right font-bold">{formatMoney(expense)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
