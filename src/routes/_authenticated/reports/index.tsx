import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "รายงานประจำวัน | ธารทรัพย์" },
      { name: "description", content: "รายงานรับชำระประจำวันและสรุปยอดคงค้าง พร้อมพิมพ์กระดาษ A4 ภาษาไทย" },
      { property: "og:title", content: "รายงานประจำวัน | ธารทรัพย์" },
      { property: "og:description", content: "รายงาน A4 ภาษาไทยสำหรับสาขาและสำนักงานใหญ่" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const today = todayISO();

  const { data, isLoading } = useQuery({
    queryKey: ["report-daily", today],
    queryFn: async () => {
      const [pay, ctr] = await Promise.all([
        supabase
          .from("payments")
          .select("receipt_no, paid_at, amount, method, contracts:contract_id(code, customers:customer_id(full_name))")
          .eq("paid_at", today)
          .eq("voided", false)
          .order("receipt_no"),
        supabase.from("contracts").select("outstanding, status").in("status", ["active", "overdue"]),
      ]);
      return { payments: pay.data ?? [], contracts: ctr.data ?? [] };
    },
  });

  const total = (data?.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = (data?.contracts ?? []).reduce((s, c) => s + Number(c.outstanding), 0);

  return (
    <div>
      <PageHeader
        title="รายงานประจำวัน"
        description={`ข้อมูล ณ วันที่ ${formatThaiDate(today)}`}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> พิมพ์ A4
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">รายงานรับชำระประจำวัน</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded bg-muted" />
          ) : (data?.payments ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState title="วันนี้ยังไม่มีรายการรับชำระ" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ใบเสร็จ</TableHead>
                  <TableHead>สัญญา</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.payments ?? []).map((p) => (
                  <TableRow key={p.receipt_no}>
                    <TableCell className="tabular">{p.receipt_no}</TableCell>
                    <TableCell className="tabular">{p.contracts?.code ?? "-"}</TableCell>
                    <TableCell>{p.contracts?.customers?.full_name ?? "-"}</TableCell>
                    <TableCell className="tabular text-right">฿{formatMoney(p.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold">
                    รวมรับชำระวันนี้
                  </TableCell>
                  <TableCell className="tabular text-right font-bold">฿{formatMoney(total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">ยอดคงค้างรวมของสัญญาที่ยังไม่ปิด</p>
          <p className="tabular mt-1 text-2xl font-bold">฿{formatMoney(outstanding)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
