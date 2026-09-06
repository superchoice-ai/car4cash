import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, EmptyState } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatThaiDateTime } from "@/lib/format";
import {
  LEGACY_DATASETS,
  mapLegacyRows,
  parseCsv,
  type LegacyDatasetKey,
} from "@/lib/legacy-import";

export const Route = createFileRoute("/_authenticated/settings/import")({
  head: () => ({
    meta: [
      { title: "นำเข้าข้อมูลระบบเดิม | SuperChoice AI" },
      {
        name: "description",
        content: "นำเข้าข้อมูลจากฐานข้อมูล MS Access ของระบบ VB6 เดิม (prawat, bill, begi, dok ฯลฯ) เข้าสู่ระบบใหม่",
      },
      { property: "og:title", content: "นำเข้าข้อมูลระบบเดิม | SuperChoice AI" },
      { property: "og:description", content: "ย้ายข้อมูลลูกค้าและใบเสร็จจาก MS Access เข้าสู่ระบบเว็บ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

const CHUNK = 300;

function ImportPage() {
  const { profile, isHQ, isAdmin } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dataset, setDataset] = useState<LegacyDatasetKey>("prawat");
  const [branchId, setBranchId] = useState<string>(profile?.branch_id ?? "");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["branches-all"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, code, name").order("code");
      return data ?? [];
    },
    enabled: isHQ,
  });

  const { data: runs } = useQuery({
    queryKey: ["legacy-import-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("legacy_import_runs")
        .select("*, branches:branch_id(name)")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const meta = LEGACY_DATASETS.find((d) => d.key === dataset)!;
  const targetBranch = branchId || profile?.branch_id || "";

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    setFileName(file.name);
    if (parsed.length === 0) toast.error("ไม่พบข้อมูลในไฟล์");
    else toast.success(`อ่านไฟล์สำเร็จ ${formatNumber(parsed.length)} แถว`);
  };

  const importRows = useMutation({
    mutationFn: async () => {
      if (!targetBranch) throw new Error("กรุณาเลือกสาขาปลายทาง");
      if (rows.length === 0) throw new Error("กรุณาเลือกไฟล์ CSV ก่อน");
      const header = Object.keys(rows[0] ?? {});
      const missing = meta.required.filter((c) => !header.includes(c));
      if (missing.length) throw new Error(`ไฟล์ขาดคอลัมน์: ${missing.join(", ")}`);

      const mapped = mapLegacyRows(dataset, rows, targetBranch);
      const payload = mapped.target === "legacy_customers" ? mapped.customers : mapped.receipts;
      let ok = 0;
      let errors = 0;

      for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        setProgress(`กำลังนำเข้า ${formatNumber(Math.min(i + CHUNK, payload.length))}/${formatNumber(payload.length)}`);
        const { error } =
          mapped.target === "legacy_customers"
            ? await supabase
                .from("legacy_customers")
                .upsert(slice as never, { onConflict: "branch_id,legacy_code" })
            : await supabase
                .from("legacy_receipts")
                .upsert(slice as never, { onConflict: "branch_id,bill_no,legacy_code" });
        if (error) {
          errors += slice.length;
          console.error(error);
        } else ok += slice.length;
      }
      setProgress(null);

      await supabase.from("legacy_import_runs").insert({
        branch_id: targetBranch,
        dataset,
        source_file: fileName,
        row_count: ok,
        error_count: errors + mapped.skipped,
        status: errors > 0 ? "partial" : "completed",
        created_by: profile?.id ?? null,
        note: `${meta.label} — ข้ามแถวไม่สมบูรณ์ ${mapped.skipped} แถว`,
      });

      return { ok, errors: errors + mapped.skipped };
    },
    onSuccess: ({ ok, errors }) => {
      toast.success(`นำเข้าสำเร็จ ${formatNumber(ok)} แถว${errors ? ` (ผิดพลาด/ข้าม ${errors} แถว)` : ""}`);
      setRows([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      void qc.invalidateQueries({ queryKey: ["legacy-import-runs"] });
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error(e.message);
    },
  });

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="นำเข้าข้อมูลระบบเดิม" />
        <EmptyState title="ไม่มีสิทธิ์เข้าถึง" description="เฉพาะผู้ดูแลระบบเท่านั้นที่นำเข้าข้อมูลได้" />
      </div>
    );
  }

  const preview = rows.slice(0, 5);
  const previewCols = Object.keys(rows[0] ?? {}).slice(0, 8);

  return (
    <div>
      <PageHeader
        title="นำเข้าข้อมูลระบบเดิม (MS Access)"
        description="ส่งออกตารางจาก bd.mdb เป็นไฟล์ CSV (UTF-8) แล้วอัปโหลดทีละตาราง — นำเข้าซ้ำได้ ระบบจะอัปเดตทับด้วยรหัสเดิม"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4" /> เลือกตารางและไฟล์
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>ตารางระบบเดิม</Label>
                <Select value={dataset} onValueChange={(v) => setDataset(v as LegacyDatasetKey)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGACY_DATASETS.map((d) => (
                      <SelectItem key={d.key} value={d.key}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>

              <div className="space-y-1.5">
                <Label>สาขาปลายทาง</Label>
                {isHQ ? (
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขา" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.code} — {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value="สาขาของคุณ" disabled />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ไฟล์ CSV จากตาราง {meta.table}</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <p className="text-xs text-muted-foreground">
                คอลัมน์ที่จำเป็น: {meta.required.join(", ")} — ชื่อคอลัมน์ใช้ตามระบบเดิม (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
              </p>
            </div>

            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewCols.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        {previewCols.map((c) => (
                          <TableCell key={c} className="max-w-[160px] truncate text-xs">
                            {r[c]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={() => importRows.mutate()} disabled={importRows.isPending || rows.length === 0}>
                <Upload className="size-4" /> นำเข้า {rows.length ? `${formatNumber(rows.length)} แถว` : ""}
              </Button>
              {progress && <span className="text-sm text-muted-foreground">{progress}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="size-4" /> วิธีส่งออกจาก Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. เปิด bd.mdb เลือกตาราง เช่น prawat</p>
            <p>2. External Data → Export → Text File → เลือก .csv</p>
            <p>3. ติ๊ก Include Field Names on First Row และเลือก Code Page เป็น UTF-8</p>
            <p>4. อัปโหลดไฟล์ที่ได้ในหน้านี้ ทีละตาราง</p>
            <p className="pt-2">
              ระบบจะแปลงวันที่ พ.ศ. (dd/mm/yy) เป็น ค.ศ. และแปลงจำนวนเงินบาทเป็นสตางค์ให้อัตโนมัติ
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">ประวัติการนำเข้า</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(runs ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีการนำเข้า" description="เมื่อนำเข้าข้อมูลแล้วจะแสดงประวัติที่นี่" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>ตาราง</TableHead>
                    <TableHead>ไฟล์</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead className="text-right">สำเร็จ</TableHead>
                    <TableHead className="text-right">ข้าม/ผิดพลาด</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular whitespace-nowrap">{formatThaiDateTime(r.created_at)}</TableCell>
                      <TableCell>{r.dataset}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.source_file ?? "-"}</TableCell>
                      <TableCell>{r.branches?.name ?? "-"}</TableCell>
                      <TableCell className="tabular text-right">{formatNumber(r.row_count)}</TableCell>
                      <TableCell className="tabular text-right">{formatNumber(r.error_count)}</TableCell>
                      <TableCell>{r.status}</TableCell>
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
