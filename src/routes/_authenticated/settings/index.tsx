import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Common";
import { LineSettings } from "@/components/LineSettings";
import { CONFIG_REFRESH_MS } from "@/hooks/useSystemSetting";
import { useAuth } from "@/hooks/useAuth";
import { AI_MODES_SETTING_KEY, DEFAULT_AI_MODES, normalizeAiModes, type AiModeKey } from "@/lib/ai-modes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ | SuperChoice AI" },
      { name: "description", content: "จัดการสาขา ผู้ใช้งาน สิทธิ์การเข้าถึง และค่าตั้งต้นของระบบสินเชื่อ" },
      { property: "og:title", content: "ตั้งค่าระบบ | SuperChoice AI" },
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

const AI_MODE_OPTIONS: { key: AiModeKey; title: string; description: string }[] = [
  {
    key: "chat_tools",
    title: "แชท MCP ผ่านแชท tools",
    description: "เช่น LINE และช่องทางแชทที่เรียก Internal Assistant endpoint",
  },
  {
    key: "external_mcp",
    title: "แชท MCP ผ่าน AI ค่ายต่าง ๆ",
    description: "เช่น ChatGPT ที่เชื่อมต่อผ่าน MCP endpoint ของ Car4Cash",
  },
  {
    key: "assistant",
    title: "ผู้ช่วย AI ในระบบ",
    description: "หน้า /assistant สำหรับถามวิธีใช้งานและวิเคราะห์ข้อมูลแบบอ่านอย่างเดียว",
  },
];

function AiModeControls() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["system-setting", AI_MODES_SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value,updated_at")
        .eq("key", AI_MODES_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return {
        modes: normalizeAiModes(data?.value ?? DEFAULT_AI_MODES),
        updatedAt: data?.updated_at ?? null,
      };
    },
    staleTime: CONFIG_REFRESH_MS,
    refetchInterval: CONFIG_REFRESH_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  const updateMode = useMutation({
    mutationFn: async ({ key, enabled }: { key: AiModeKey; enabled: boolean }) => {
      const current = normalizeAiModes(query.data?.modes ?? DEFAULT_AI_MODES);
      const next = { ...current, [key]: enabled };
      const { error } = await supabase.from("system_settings").upsert(
        {
          key: AI_MODES_SETTING_KEY,
          value: next,
          description: "ควบคุมการเปิด/ปิดช่องทาง AI: แชท tools/LINE, MCP ภายนอก และผู้ช่วย AI",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      qc.setQueryData(["system-setting", AI_MODES_SETTING_KEY], {
        modes: next,
        updatedAt: new Date().toISOString(),
      });
      await qc.invalidateQueries({ queryKey: ["settings-data"] });
      toast.success("บันทึกการตั้งค่า AI Mode แล้ว");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "ไม่สามารถบันทึก AI Mode ได้");
    },
  });

  const modes = normalizeAiModes(query.data?.modes ?? DEFAULT_AI_MODES);

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" /> AI Mode
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          เปิดเฉพาะช่องทางที่ต้องใช้งานเพื่อควบคุมความปลอดภัยและค่าใช้จ่าย ระบบตรวจค่าล่าสุดฝั่ง server ทุกคำขอ
        </p>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {AI_MODE_OPTIONS.map((option) => (
          <div key={option.key} className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-sm font-medium">{option.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
            </div>
            <Switch
              checked={modes[option.key]}
              disabled={query.isLoading || updateMode.isPending}
              onCheckedChange={(enabled) => updateMode.mutate({ key: option.key, enabled })}
              aria-label={`${option.title}: ${modes[option.key] ? "เปิด" : "ปิด"}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const { isAdmin, loading: authLoading } = useAuth();
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

  if (authLoading) return null;
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <LockKeyhole className="size-5" />
          เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เข้าถึงการตั้งค่าระบบได้
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="ตั้งค่าระบบ"
        description="ข้อมูลสาขา ค่าตั้งต้น และการเชื่อมต่อ LINE"
        actions={<Button variant="outline" onClick={() => void refreshAllConfig()} disabled={settingsQuery.isFetching}><RefreshCw className={settingsQuery.isFetching ? "size-4 animate-spin" : "size-4"} /> โหลดค่าล่าสุดทั้งหมด</Button>}
      />

      <AiModeControls />

      <LineSettings />

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">สาขาทั้งหมด ({data?.branches.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>รหัส</TableHead><TableHead>ชื่อสาขา</TableHead><TableHead>อำเภอ</TableHead><TableHead>ที่อยู่สาขา</TableHead></TableRow></TableHeader><TableBody>{(data?.branches ?? []).map((b) => <TableRow key={b.id}><TableCell className="tabular font-medium">{b.code}</TableCell><TableCell>{b.name}</TableCell><TableCell>{b.district ?? "-"}</TableCell><TableCell className="max-w-xl whitespace-normal">{b.address?.trim() || "-"}</TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">ค่าตั้งต้นระบบ</CardTitle></CardHeader>
        <CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>คีย์</TableHead><TableHead>คำอธิบาย</TableHead><TableHead>ค่า (ข้อมูลสำคัญถูกปกปิด)</TableHead></TableRow></TableHeader><TableBody>{(data?.settings ?? []).map((s) => <TableRow key={s.key}><TableCell className="tabular font-medium">{s.key}</TableCell><TableCell>{s.description ?? "-"}</TableCell><TableCell className="tabular text-xs">{JSON.stringify(safeSettingValue(s.value))}</TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>
    </div>
  );
}
