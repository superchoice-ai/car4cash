import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState } from "@/components/Common";
import { StandardPagination, paginateRows } from "@/components/StandardPagination";
import { PrintReport } from "@/components/PrintReport";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO } from "@/lib/format";
import { cellText, getReport, runReport } from "@/lib/reports";

export const Route = createFileRoute("/_authenticated/reports/$reportId")({
  head: () => ({
    meta: [
      { title: "พิมพ์รายงาน | SuperChoice AI" },
      { name: "description", content: "แสดงและพิมพ์รายงานผลรูปแบบกระดาษ A4 ภาษาไทย ตามรูปแบบเดียวกับระบบเดิม" },
      { property: "og:title", content: "พิมพ์รายงาน | SuperChoice AI" },
      { property: "og:description", content: "รายงานผล A4 ภาษาไทยของระบบสินเชื่อSuperChoice AI" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportViewPage,
});

function ReportViewPage() {
  const { reportId } = Route.useParams();
  const { branch } = useAuth();
  const { branchId, scopeName } = useBranchFilter();
  const def = getReport(reportId);

  const monthStart = todayISO().slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayISO());
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["report", reportId, from, to, keyword, branchId],
    enabled: !!def,
    queryFn: () => runReport(reportId, { from, to, keyword, branchId }),
  });

  useEffect(() => setPage(1), [reportId, from, to, keyword, branchId, pageSize]);

  if (!def) return <EmptyState title="ไม่พบรายงานนี้" description="กลับไปเลือกรายงานจากเมนูรายงานผล" />;

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const totalKeys = data?.totalKeys ?? [];
  const pagination = paginateRows(rows, page, pageSize);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="no-print mb-2">
        <Link to="/reports">
          <ArrowLeft className="size-4" /> กลับเมนูรายงานผล
        </Link>
      </Button>

      <PageHeader
        title={def.title}
        description={def.description ?? `รายงานกลุ่ม${def.group} · พิมพ์ได้ทันทีบนกระดาษ A4`}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> พิมพ์ A4
          </Button>
        }
      />

      {def.param !== "none" && (
        <Card className="no-print mb-4">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
            {def.param === "range" && (
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
            )}
            {def.param === "keyword" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>ค้นหา (รหัส / ชื่อ / ทะเบียนรถ)</Label>
                <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="เช่น A0121 หรือ ขวง 745" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PrintReport
        title={def.title}
        branchName={scopeName || branch?.name || null}
        periodText={def.param === "range" ? `${formatThaiDate(from)} ถึง ${formatThaiDate(to)}` : `ณ ${formatThaiDate(todayISO())}`}
        columns={columns.length}
      >
        {isLoading ? (
          <div className="h-40 animate-pulse rounded bg-muted" />
        ) : data?.note && rows.length === 0 ? (
          <EmptyState title={data.note} />
        ) : rows.length === 0 ? (
          <EmptyState title="ไม่พบข้อมูลตามเงื่อนไขที่เลือก" />
        ) : (
          <>
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className={c.align === "right" ? "text-right" : ""}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, idx) => (
                <TableRow
                  key={idx}
                  className={idx >= pagination.start && idx < pagination.start + pageSize ? undefined : "hidden print:table-row"}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.align === "right" || c.money ? "tabular text-right" : ""}>
                      {cellText(c, r[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            {totalKeys.length > 0 && (
              <TableFooter>
                <TableRow>
                  {columns.map((c, i) => {
                    if (i === 0) return <TableCell key={c.key}>รวม {rows.length} รายการ</TableCell>;
                    if (!totalKeys.includes(c.key)) return <TableCell key={c.key} />;
                    const sum = rows.reduce((s, r) => s + Number(r[c.key] ?? 0), 0);
                    return (
                      <TableCell key={c.key} className="tabular text-right font-bold">
                        {formatMoney(sum)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableFooter>
            )}
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
          </>
        )}
      </PrintReport>
    </div>
  );
}

