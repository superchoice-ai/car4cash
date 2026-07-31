import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill, EmptyState } from "@/components/Common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO } from "@/lib/format";
import { CONTRACT_STATUS_LABEL, INSTALLMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/contracts/$contractId")({
  head: () => ({
    meta: [
      { title: "รายละเอียดสัญญา | ธารทรัพย์" },
      { name: "description", content: "ตารางผ่อนชำระ ประวัติการรับชำระ และยอดคงค้างของสัญญาสินเชื่อ" },
      { property: "og:title", content: "รายละเอียดสัญญา | ธารทรัพย์" },
      { property: "og:description", content: "ตารางผ่อนชำระและประวัติการชำระเงิน" },
    ],
  }),
  component: ContractDetail,
});

function ContractDetail() {
  const { contractId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: async () => {
      const [c, ins, pay] = await Promise.all([
        supabase
          .from("contracts")
          .select("*, customers:customer_id(id, code, full_name, phone), vehicles:vehicle_id(plate_no, brand, model), branches:branch_id(name)")
          .eq("id", contractId)
          .maybeSingle(),
        supabase.from("installments").select("*").eq("contract_id", contractId).order("seq"),
        supabase.from("payments").select("*").eq("contract_id", contractId).order("paid_at", { ascending: false }),
      ]);
      return { contract: c.data, installments: ins.data ?? [], payments: pay.data ?? [] };
    },
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  if (!data?.contract) return <EmptyState title="ไม่พบสัญญา" />;

  const c = data.contract;
  const today = todayISO();

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="no-print mb-2">
        <Link to="/contracts">
          <ArrowLeft className="size-4" /> กลับรายการสัญญา
        </Link>
      </Button>

      <PageHeader
        title={`สัญญาเลขที่ ${c.code}`}
        description={`${c.customers?.full_name ?? "-"} · ทะเบียน ${c.vehicles?.plate_no ?? "-"} · ${c.branches?.name ?? ""}`}
        actions={
          <>
            <StatusPill status={c.status} label={CONTRACT_STATUS_LABEL[c.status] ?? c.status} />
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> พิมพ์
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["เงินต้น", `฿${formatMoney(c.principal)}`],
          ["ค่างวด/เดือน", `฿${formatMoney(c.installment_amount)}`],
          ["ยอดชำระรวม", `฿${formatMoney(c.total_payable)}`],
          ["ยอดคงค้าง", `฿${formatMoney(c.outstanding)}`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="tabular mt-1 text-lg font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ตารางผ่อนชำระ ({c.term_months} งวด · ดอกเบี้ย {Number(c.interest_rate)}%/เดือน)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[520px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งวด</TableHead>
                    <TableHead>ครบกำหนด</TableHead>
                    <TableHead className="text-right">เงินต้น</TableHead>
                    <TableHead className="text-right">ดอกเบี้ย</TableHead>
                    <TableHead className="text-right">รวม</TableHead>
                    <TableHead className="text-right">ชำระแล้ว</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.installments.map((i) => {
                    const overdue = i.status !== "paid" && i.due_date < today;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="tabular">{i.seq}</TableCell>
                        <TableCell className="tabular">{formatThaiDate(i.due_date)}</TableCell>
                        <TableCell className="tabular text-right">{formatMoney(i.principal_amount)}</TableCell>
                        <TableCell className="tabular text-right">{formatMoney(i.interest_amount)}</TableCell>
                        <TableCell className="tabular text-right font-medium">{formatMoney(i.total_amount)}</TableCell>
                        <TableCell className="tabular text-right">{formatMoney(i.paid_amount)}</TableCell>
                        <TableCell>
                          <StatusPill
                            status={overdue ? "overdue" : i.status}
                            label={overdue ? "เกินกำหนด" : (INSTALLMENT_STATUS_LABEL[i.status] ?? i.status)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ประวัติการรับชำระ</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.payments.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีการชำระเงิน</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่ใบเสร็จ</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id} className={p.voided ? "opacity-50 line-through" : ""}>
                      <TableCell className="tabular text-xs">
                        {p.receipt_no}
                        <span className="block text-muted-foreground">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</span>
                      </TableCell>
                      <TableCell className="tabular">{formatThaiDate(p.paid_at)}</TableCell>
                      <TableCell className="tabular text-right">฿{formatMoney(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
