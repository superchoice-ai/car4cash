import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendLineTest } from "@/lib/line.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Send } from "lucide-react";

const KEYS = [
  { key: "LINE_LOGIN_CHANNEL_ID", label: "LINE Login – Channel ID", category: "line_login" },
  { key: "LINE_LOGIN_CHANNEL_SECRET", label: "LINE Login – Channel Secret", category: "line_login" },
  { key: "LINE_CHANNEL_ACCESS_TOKEN", label: "LINE OA – Channel Access Token", category: "line_oa" },
  { key: "LINE_CHANNEL_SECRET", label: "LINE OA – Channel Secret", category: "line_oa" },
] as const;

interface SecretRow {
  key: string;
  label: string;
  category: string;
  masked: string;
  updated_at: string;
}

export function LineSettings() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [recipients, setRecipients] = useState("");
  const [testTo, setTestTo] = useState("");
  const testFn = useServerFn(sendLineTest);

  const { data: secrets } = useQuery({
    queryKey: ["integration-secrets"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_integration_secrets");
      if (error) throw error;
      return (data ?? []) as SecretRow[];
    },
  });

  const { data: notifyCfg } = useQuery({
    queryKey: ["line-notify-setting"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("value").eq("key", "line_notify").maybeSingle();
      const cfg = (data?.value ?? {}) as { to?: string[]; enabled?: boolean };
      setRecipients((cfg.to ?? []).join(", "));
      return cfg;
    },
  });

  const saveSecret = useMutation({
    mutationFn: async (item: (typeof KEYS)[number]) => {
      const value = drafts[item.key] ?? "";
      const { error } = await supabase.rpc("set_integration_secret", {
        _key: item.key,
        _label: item.label,
        _category: item.category,
        _value: value,
      });
      if (error) throw error;
    },
    onSuccess: (_d, item) => {
      setDrafts((p) => ({ ...p, [item.key]: "" }));
      void qc.invalidateQueries({ queryKey: ["integration-secrets"] });
      toast.success("บันทึกคีย์แล้ว (แสดงผลแบบปกปิด)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRecipients = useMutation({
    mutationFn: async () => {
      const to = recipients
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: "line_notify", value: { ...(notifyCfg ?? {}), enabled: true, to } }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("บันทึกผู้รับการแจ้งเตือนแล้ว"),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: async () => testFn({ data: { to: testTo } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`ส่งสำเร็จ ${r.sent} ข้อความ`);
      else toast.error(r.errors[0] ?? "ส่งไม่สำเร็จ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maskedOf = (key: string) => secrets?.find((s) => s.key === key)?.masked ?? "";

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">การเชื่อมต่อ LINE (Phase 1.1)</CardTitle>
        <CardDescription>
          คีย์ทั้งหมดจะถูกเก็บอย่างปลอดภัยและแสดงผลแบบปกปิดหลังบันทึก · Callback URL สำหรับ LINE Login:{" "}
          <code className="tabular text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/auth/line/callback</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {KEYS.map((item) => (
            <div key={item.key} className="space-y-1.5">
              <Label htmlFor={item.key}>{item.label}</Label>
              <div className="flex gap-2">
                <Input
                  id={item.key}
                  type="password"
                  autoComplete="off"
                  value={drafts[item.key] ?? ""}
                  placeholder={maskedOf(item.key) || "ยังไม่ได้ตั้งค่า"}
                  onChange={(e) => setDrafts((p) => ({ ...p, [item.key]: e.target.value }))}
                />
                <Button
                  variant="secondary"
                  disabled={!drafts[item.key]?.trim() || saveSecret.isPending}
                  onClick={() => saveSecret.mutate(item)}
                >
                  บันทึก
                </Button>
              </div>
              {maskedOf(item.key) && <p className="tabular text-xs text-muted-foreground">ค่าปัจจุบัน: {maskedOf(item.key)}</p>}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="line-to">ผู้รับการแจ้งเตือน (LINE user ID / group ID คั่นด้วยเครื่องหมายจุลภาค)</Label>
          <div className="flex gap-2">
            <Input id="line-to" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="Uxxxxxxxx, Cxxxxxxxx" />
            <Button variant="secondary" disabled={saveRecipients.isPending} onClick={() => saveRecipients.mutate()}>
              บันทึก
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="line-test">ทดสอบส่งข้อความจริง</Label>
          <div className="flex gap-2">
            <Input
              id="line-test"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="เว้นว่างเพื่อส่งให้ผู้รับที่ตั้งค่าไว้"
            />
            <Button disabled={sendTest.isPending} onClick={() => sendTest.mutate()}>
              {sendTest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} ส่งทดสอบ
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
