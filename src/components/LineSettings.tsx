import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { saveLineRecipients, sendLineTest } from "@/lib/line.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Send } from "lucide-react";

const CONFIG_REFRESH_MS = 30 * 60 * 1000;
const RECIPIENT_SECRET_KEY = "LINE_NOTIFY_RECIPIENTS";

const KEYS = [
  { key: "LINE_LOGIN_CHANNEL_ID", label: "LINE Login – Channel ID", category: "line_login" },
  { key: "LINE_LOGIN_CHANNEL_SECRET", label: "LINE Login – Channel Secret", category: "line_login" },
  { key: "LINE_LOGIN_REDIRECT_URI", label: "LINE Login – Callback URL (คงที่)", category: "line_login" },
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
  const [recipientDraft, setRecipientDraft] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("ทดสอบการแจ้งเตือนจากระบบธารทรัพย์ ✅");
  const testFn = useServerFn(sendLineTest);
  const saveRecipientsFn = useServerFn(saveLineRecipients);

  const secretsQuery = useQuery({
    queryKey: ["integration-secrets"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_integration_secrets");
      if (error) throw error;
      return (data ?? []) as SecretRow[];
    },
    staleTime: CONFIG_REFRESH_MS,
    refetchInterval: CONFIG_REFRESH_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const secrets = secretsQuery.data;

  const notifyQuery = useQuery({
    queryKey: ["line-notify-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value,updated_at")
        .eq("key", "line_notify")
        .maybeSingle();
      if (error) throw error;
      const cfg = (data?.value ?? {}) as { enabled?: boolean; recipients_source?: string };
      return { ...cfg, updated_at: data?.updated_at ?? null };
    },
    staleTime: CONFIG_REFRESH_MS,
    refetchInterval: CONFIG_REFRESH_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
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
    onSuccess: async (_d, item) => {
      setDrafts((p) => ({ ...p, [item.key]: "" }));
      await qc.invalidateQueries({ queryKey: ["integration-secrets"] });
      toast.success("บันทึกคีย์แล้ว และโหลดค่าล่าสุดจาก DB แล้ว");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRecipientsMutation = useMutation({
    mutationFn: async () => saveRecipientsFn({ data: { to: recipientDraft, enabled: true } }),
    onSuccess: async (result) => {
      setRecipientDraft("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["integration-secrets"] }),
        qc.invalidateQueries({ queryKey: ["line-notify-setting"] }),
        qc.invalidateQueries({ queryKey: ["settings-data"] }),
      ]);
      toast.success(`บันทึกผู้รับ ${result.count} รายแบบปกปิดแล้ว`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendTest = useMutation({
    mutationFn: async () => testFn({ data: { to: testTo, text: testMessage } }),
    onSuccess: (r) => {
      if (r.ok) toast.success(`ส่งสำเร็จ ${r.sent} ข้อความ · ผู้รับ ${r.targetCount} ราย`);
      else toast.error(r.errors[0] ?? "ส่งไม่สำเร็จ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshConfig = async () => {
    await Promise.all([secretsQuery.refetch(), notifyQuery.refetch()]);
    toast.success("โหลด config ล่าสุดจาก DB แล้ว");
  };

  const maskedOf = (key: string) => secrets?.find((s) => s.key === key)?.masked ?? "";
  const recipientMasked = maskedOf(RECIPIENT_SECRET_KEY);
  const isRefreshing = secretsQuery.isFetching || notifyQuery.isFetching;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">การเชื่อมต่อ LINE (Phase 1.1)</CardTitle>
            <CardDescription>
              ใช้ค่าล่าสุดจาก DB เมื่อส่งจริง · หน้าจอ refresh เมื่อเปิด/กลับมาใช้งาน และทุก 30 นาที · Callback URL:{" "}
              <code className="tabular text-xs">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/auth/line/callback</code>
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshConfig()} disabled={isRefreshing}>
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} /> โหลดค่าล่าสุด
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
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
                <Button variant="secondary" disabled={!drafts[item.key]?.trim() || saveSecret.isPending} onClick={() => saveSecret.mutate(item)}>
                  บันทึก
                </Button>
              </div>
              {maskedOf(item.key) && <p className="tabular text-xs text-muted-foreground">ค่าปัจจุบัน: {maskedOf(item.key)}</p>}
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="line-to">ผู้รับการแจ้งเตือน (ข้อมูลลับ)</Label>
          <div className="flex gap-2">
            <Input
              id="line-to"
              type="password"
              autoComplete="off"
              value={recipientDraft}
              onChange={(e) => setRecipientDraft(e.target.value)}
              placeholder={recipientMasked || "Uxxxxxxxx, Cxxxxxxxx"}
            />
            <Button variant="secondary" disabled={!recipientDraft.trim() || saveRecipientsMutation.isPending} onClick={() => saveRecipientsMutation.mutate()}>
              บันทึก
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            คั่นหลายรายด้วย comma, space หรือขึ้นบรรทัดใหม่ · หลังบันทึกจะแสดงเฉพาะ masked value และไม่โหลด LINE ID จริงกลับเข้า browser
          </p>
          {recipientMasked && <p className="tabular text-xs text-muted-foreground">ค่าปัจจุบัน: {recipientMasked}</p>}
        </div>

        <div className="rounded-lg border p-3 space-y-3">
          <div className="font-medium">ทดสอบส่งข้อความจริง</div>
          <div className="space-y-1.5">
            <Label htmlFor="line-test-to">ผู้รับทดสอบ (ไม่บังคับ)</Label>
            <Input
              id="line-test-to"
              type="password"
              autoComplete="off"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="เว้นว่าง = ใช้ผู้รับล่าสุดที่บันทึกไว้ · กรอกหลาย ID ได้"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line-test-message">ข้อความทดสอบ</Label>
            <Textarea
              id="line-test-message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={5}
              placeholder="พิมพ์ข้อความที่ต้องการส่งทดสอบ"
            />
          </div>
          <div className="flex justify-end">
            <Button disabled={sendTest.isPending || !testMessage.trim()} onClick={() => sendTest.mutate()}>
              {sendTest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} ส่งทดสอบ
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            การส่งจริงอ่าน LINE_CHANNEL_ACCESS_TOKEN และผู้รับล่าสุดจาก confidential DB ณ เวลาที่กดส่ง ไม่ใช้ค่าที่ cache บนหน้าจอ
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
