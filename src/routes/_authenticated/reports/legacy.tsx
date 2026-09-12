import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState } from "@/components/Common";
import { StandardPagination, paginateRows } from "@/components/StandardPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO, formatNumber } from "@/lib/format";
import { receiptTotal } from "@/lib/legacy-import";

export const Route = createFileRoute("/_authenticated/reports/legacy")({
  head: () => ({
    meta: [
      { title: "รายงานรูปแบบเดิม | SuperChoice AI" },
      {
        name: "description",
        content: "รายงานรูปแบบเดียวกับระบบเดิม (Crystal Reports) — ทะเบียนใบเสร็จรายวันและทะเบียนลูกค้า พิมพ์กระดาษ A4",
      },
      { property: "og:title", content: "รายงานรูปแบบเดิม | SuperChoice AI" },
      { property: "og:description", content: "พิมพ์รายงานรูปแบบเดิมจากข้อมูลที่นำเข้าจาก MS Access" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegacyReportPage,
});

type ReportKind = "receipts" | "customers";

function LegacyReportPage() {
  const { branch } = useAuth();
  const { branchId, scopeName } = useBranchFilter();
  const [kind, setKind] = useState<ReportKind>("receipts");
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: receipts, isLoading: loadingR } = useQuery({
    queryKey: ["legacy-receipts", from, to, branchId],
    enabled: kind === "receipts",
    queryFn: async () => {
      let q = supabase
        .from("legacy_receipts")
        .select("*")
        .gte("paid_on", from)
        .lte("paid_on", to)
        .order("paid_on")
        .order("bill_no")
        .limit(1000);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers, isLoading: loadingC } = useQuery({
    queryKey: ["legacy-customers", keyword, branchId],
    enabled: kind === "customers",
    queryFn: async () => {
      let q = supabase.from("legacy_customers").select("*").order("legacy_code").limit(500);
      if (branchId) q = q.eq("branch_id", branchId);
      if (keyword.trim())
        q = q.or(`legacy_code.ilike.%${keyword}%,full_name.ilike.%${keyword}%,plate_no.ilike.%${keyword}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = receipts ?? [];
  const customerRows = customers ?? [];
  const receiptPagination = paginateRows(rows, page, pageSize);
  const customerPagination = paginateRows(customerRows, page, pageSize);
  const pagination =
    kind === "receipts"
      ? { page: receiptPagination.page, start: receiptPagination.start }
      : { page: customerPagination.page, start: customerPagination.start };
  const sum = (fn: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + fn(r), 0);

  useEffect(() => setPage(1), [kind, from, to, keyword, branchId, pageSize]);

  return (
    <div>
      <PageHeader
        title="รายงานรูปแบบเดิม"
        description="รูปแบบคอลัมน์และหัวรายงานเดียวกับระบบ VB6/Crystal Reports เดิม สำหรับข้อมูลที่นำเข้าจาก MS Access"
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> พิมพ์ A4
          </Button>
        }
      />

      <Card className="no-print mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>รายงาน</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receipts">ทะเบียนใบเสร็จรับเงินรายวัน</SelectItem>
                <SelectItem value="customers">ทะเบียนลูกค้า/สัญญา (ระบบเดิม)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "receipts" ? (
            <>
              <div className="space-y-1.5">
                <Label>ตั้งแต่วันที่</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>ถึงวันที่</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ค้นหา (รหัส / ชื่อ / ทะเบียนรถ)</Label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="เช่น 1234 หรือ กข 1234" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card p-6 print:border-0 print:p-0">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">บริษัท SuperChoice AI จำกัด</h2>
          <p className="text-sm">
            {kind === "receipts" ? "ทะเบียนใบเสร็จรับเงินรายวัน" : "ทะเบียนลูกค้าและสัญญา (ข้อมูลระบบเดิม)"}
          </p>
          <p className="text-xs text-muted-foreground">
            {branch?.name ?? "-"}
            {kind === "receipts" ? ` · ${formatThaiDate(from)} ถึง ${formatThaiDate(to)}` : ""}
          </p>
        </div>

        {kind === "receipts" ? (
          loadingR ? (
            <div className="h-40 animate-pulse rounded bg-muted" />
          ) : rows.length === 0 ? (
            <EmptyState title="ไม่พบใบเสร็จในช่วงวันที่นี้" description="ตรวจสอบว่ามีการนำเข้าข้อมูลใบเสร็จแล้ว" />
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่บิล</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อลูกค้า</TableHead>
                    <TableHead className="text-right">เงินต้น</TableHead>
                    <TableHead className="text-right">ดอกเบี้ย</TableHead>
                    <TableHead className="text-right">ค่าปรับ</TableHead>
                    <TableHead className="text-right">ค่าติดตาม</TableHead>
                    <TableHead className="text-right">ค่าประกัน</TableHead>
                    <TableHead className="text-right">ค่าทะเบียน</TableHead>
                    <TableHead className="text-right">รวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, index) => (
                    <TableRow
                      key={r.id}
                      className={index >= pagination.start && index < pagination.start + pageSize ? undefined : "hidden print:table-row"}
                    >
                      <TableCell className="tabular">{r.bill_no}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">{formatThaiDate(r.paid_on)}</TableCell>
                      <TableCell className="tabular">{r.legacy_code}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{r.full_name ?? "-"}</TableCell>
                      <TableCell className="tabular text-right">{formatMoney(r.principal_amount)}</TableCell>
                      <TableCell className="tabular text-right">{formatMoney(r.interest_amount)}</TableCell>
                      <TableCell className="tabular text-right">{formatMoney(r.penalty_amount)}</TableCell>
                      <TableCell className="tabular text-right">{formatMoney(r.follow_up_amount)}</TableCell>
                      <TableCell className="tabular text-right">{formatMoney(r.insurance_amount)}</TableCell>
                      <TableCell className="tabular text-right">{formatMoney(r.registration_amount)}</TableCell>
                      <TableCell className="tabular text-right font-medium">{formatMoney(receiptTotal(r))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>รวม {formatNumber(rows.length)} ใบเสร็จ</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(sum((r) => Number(r.principal_amount)))}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(sum((r) => Number(r.interest_amount)))}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(sum((r) => Number(r.penalty_amount)))}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(sum((r) => Number(r.follow_up_amount)))}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(sum((r) => Number(r.insurance_amount)))}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(sum((r) => Number(r.registration_amount)))}</TableCell>
                    <TableCell className="tabular text-right font-bold">{formatMoney(sum(receiptTotal))}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <div className="no-print">
                <StandardPagination
                  page={pagination.page}
                  pageSize={pageSize}
                  total={rows.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>
          )
        ) : loadingC ? (
          <div className="h-40 animate-pulse rounded bg-muted" />
        ) : (customers ?? []).length === 0 ? (
          <EmptyState title="ไม่พบข้อมูลลูกค้าระบบเดิม" description="นำเข้าตาราง prawat จาก MS Access ก่อน" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส</TableHead>
                  <TableHead>ชื่อ-สกุล</TableHead>
                  <TableHead>รถ/ประเภท</TableHead>
                  <TableHead>ทะเบียน</TableHead>
                  <TableHead className="text-right">วงเงิน</TableHead>
                  <TableHead className="text-right">ค่างวด</TableHead>
                  <TableHead className="text-right">งวด</TableHead>
                  <TableHead className="text-right">คงเหลือ</TableHead>
                  <TableHead>วันทำสัญญา</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerRows.map((c, index) => (
                  <TableRow
                    key={c.id}
                    className={index >= pagination.start && index < pagination.start + pageSize ? undefined : "hidden print:table-row"}
                  >
                    <TableCell className="tabular">{c.legacy_code}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{c.full_name ?? "-"}</TableCell>
                    <TableCell>{[c.car_brand, c.car_type].filter(Boolean).join(" ") || "-"}</TableCell>
                    <TableCell>{c.plate_no ?? "-"}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(c.loan_amount)}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(c.installment_amount)}</TableCell>
                    <TableCell className="tabular text-right">{c.term_months ?? "-"}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(c.outstanding)}</TableCell>
                    <TableCell className="tabular">{c.contract_date ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="no-print">
              <StandardPagination
                page={pagination.page}
                pageSize={pageSize}
                total={customerRows.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
