import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Common";
import { LineSettings } from "@/components/LineSettings";
import { CONFIG_REFRESH_MS } from "@/hooks/useSystemSetting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ | ธารทรัพย์" },
      { name: "description", content: "จัดการสาขา ผู้ใช้งาน สิทธิ์การเข้าถึง และค่าตั้งต้นของระบบสินเชื่อ" },
      { property: "og:title", content: "ตั้งค่าระบบ | ธารทรัพย์" },
      { property: "og:description", content: "จัดการสาขา ผู้ใช้งาน และค่าตั้งต้นสินเชื่อ" },
    ],
  }),
  component: SettingsPage,
});

const CONFIDENTIAL_KEY = /(secret|token|password|recipient|user[_-]?id|group[_-]?id|\bto\b)/i;

function safeSettingValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeSettingValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      CONFIDENTIAL_KEY.test(key) ? "••••••••" : safeSettingValue(nested),
    ]),
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["settings-data"],
    queryFn: async () => {
      const [b, s] = await Promise.all([
        supabase.from("branches").select("*").order("code"),
        supabase.from("system_settings").select("*").order("key"),
      ]);
      if (b.error) throw b.error;
      if (s.error) throw s.error;
      return { branches: b.data ?? [], settings: s.data ?? [] };
    },
    staleTime: CONFIG_REFRESH_MS,
    refetchInterval: CONFIG_REFRESH_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const data = settingsQuery.data;

  const refreshAllConfig = async () => {
    await Promise.all([
      settingsQuery.refetch(),
      qc.refetchQueries({ queryKey: ["system-setting"] }),
      qc.refetchQueries({ queryKey: ["integration-secrets"] }),
      qc.refetchQueries({ queryKey: ["line-notify-setting"] }),
    ]);
    toast.success("โหลด config ล่าสุดจาก DB ครบแล้ว");
  };

  return (
    <div>
      <PageHeader
        title="ตั้งค่าระบบ"
        description="ข้อมูลสาขา ค่าตั้งต้น และการเชื่อมต่อ LINE"
        actions={<Button variant="outline" onClick={() => void refreshAllConfig()} disabled={settingsQuery.isFetching}><RefreshCw className={settingsQuery.isFetching ? "size-4 animate-spin" : "size-4"} /> โหลดค่าล่าสุดทั้งหมด</Button>}
      />

      <LineSettings />

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">สาขาทั้งหมด ({data?.branches.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>รหัส</TableHead><TableHead>ชื่อสาขา</TableHead><TableHead>อำเภอ</TableHead><TableHead>ประเภท</TableHead></TableRow></TableHeader><TableBody>{(data?.branches ?? []).map((b) => <TableRow key={b.id}><TableCell className="tabular font-medium">{b.code}</TableCell><TableCell>{b.name}</TableCell><TableCell>{b.district ?? "-"}</TableCell><TableCell>{b.is_hq ? "สำนักงานใหญ่" : "สาขา"}</TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">ค่าตั้งต้นระบบ</CardTitle></CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>คีย์</TableHead><TableHead>คำอธิบาย</TableHead><TableHead>ค่า (ข้อมูลสำคัญถูกปกปิด)</TableHead></TableRow></TableHeader><TableBody>{(data?.settings ?? []).map((s) => <TableRow key={s.key}><TableCell className="tabular font-medium">{s.key}</TableCell><TableCell>{s.description ?? "-"}</TableCell><TableCell className="tabular text-xs">{JSON.stringify(safeSettingValue(s.value))}</TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}
