import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const STANDARD_PAGE_SIZES = [25, 50, 100] as const;

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: safePage, pageCount, start };
}

export function StandardPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const first = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, total);
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((n) =>
    pageCount <= 7 || n === 1 || n === pageCount || Math.abs(n - safePage) <= 1,
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
      <div className="text-muted-foreground">แสดง {first.toLocaleString("th-TH")}–{last.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} รายการ</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">ต่อหน้า</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
          <SelectContent>{STANDARD_PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>ก่อนหน้า</Button>
        <div className="flex items-center gap-1">
          {pages.map((n, index) => {
            const prev = pages[index - 1];
            return <span key={n} className="flex items-center gap-1">{prev && n - prev > 1 && <span className="px-1 text-muted-foreground">…</span>}<Button size="sm" variant={n === safePage ? "default" : "outline"} className="min-w-8 px-2" onClick={() => onPageChange(n)}>{n}</Button></span>;
          })}
        </div>
        <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}>ถัดไป</Button>
      </div>
    </div>
  );
}
