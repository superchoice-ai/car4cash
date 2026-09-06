import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session lives in localStorage, absent during SSR.
  ssr: false,
  head: () => ({
    meta: [
      { title: "อนุญาตการเชื่อมต่อ | SuperChoice AI" },
      { name: "description", content: "อนุมัติให้แอปภายนอกเข้าถึงระบบSuperChoice AIในนามของคุณ" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const d = data as unknown as { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null;
    const immediate = d?.redirect_url ?? d?.redirect_to;
    if (immediate && !d?.client) throw redirect({ href: immediate });
    return d;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ไม่สามารถโหลดคำขออนุญาตได้</CardTitle>
          <CardDescription>{String((error as Error)?.message ?? error)}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "แอปภายนอก";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id)
      : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const d = data as unknown as { redirect_url?: string; redirect_to?: string } | null;
    const target = d?.redirect_url ?? d?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("เซิร์ฟเวอร์ไม่ได้ส่งที่อยู่สำหรับกลับไปยังแอป");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary to-sidebar p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <CardTitle>เชื่อมต่อ {clientName} กับบัญชีของคุณ</CardTitle>
          <CardDescription>
            {clientName} จะสามารถอ่านข้อมูลในระบบSuperChoice AIได้ตามสิทธิ์และสาขาของคุณ (อ่านอย่างเดียว)
            การอนุมัติ ชำระเงิน หรือแก้ไขข้อมูลยังต้องทำในระบบเท่านั้น
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              อนุญาต
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
              ปฏิเสธ
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
