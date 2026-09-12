import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck } from "lucide-react";
import { EnvironmentVersionInfo } from "@/components/EnvironmentVersionInfo";
import { waitForAuthenticatedSession } from "@/lib/auth-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ | SuperChoice AI สินเชื่อจำนำเล่มทะเบียน" },
      { name: "description", content: "เข้าสู่ระบบเพื่อจัดการสินเชื่อจำนำเล่มทะเบียนของสาขาคุณ" },
      { property: "og:title", content: "เข้าสู่ระบบ | SuperChoice AI" },
      { property: "og:description", content: "ระบบสินเชื่อจำนำเล่มทะเบียนแลกเงินสด สำหรับพนักงานและผู้บริหาร" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { next?: string; inactive?: string } => {
    const result: { next?: string; inactive?: string } = {};
    if (typeof search["next"] === "string") result.next = search["next"];
    if (search["inactive"] === "1") result.inactive = "1";
    return result;
  },
  component: AuthPage,
});

const emailSchema = z.string().trim().email({ message: "รูปแบบอีเมลไม่ถูกต้อง" }).max(255);
const passwordSchema = z.string().min(8, { message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" }).max(72);

const NEXT_KEY = "tharnsaph.auth-next";

/** Accept only same-origin relative paths (e.g. the OAuth consent URL). */
function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next: nextParam, inactive } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("line_error");
    if (err) toast.error(err);
    if (inactive === "1") toast.error("บัญชีผู้ใช้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ");

    // Preserve the post-login target across Google/LINE/email round-trips.
    const fromParam = safeNext(nextParam);
    if (fromParam) sessionStorage.setItem(NEXT_KEY, fromParam);

    const goAfterLogin = () => {
      const target = safeNext(sessionStorage.getItem(NEXT_KEY));
      if (target) {
        sessionStorage.removeItem(NEXT_KEY);
        window.location.replace(target);
        return;
      }
      void navigate({ to: "/dashboard", replace: true });
    };

    void waitForAuthenticatedSession().then(({ session }) => {
      if (session) goAfterLogin();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) goAfterLogin();
    });
    return () => sub.subscription.unsubscribe();
  }, [inactive, navigate, nextParam]);


  const validate = () => {
    const e = emailSchema.safeParse(email);
    if (!e.success) {
      toast.error(e.error.issues[0]!.message);
      return false;
    }
    const p = passwordSchema.safeParse(password);
    if (!p.success) {
      toast.error(p.error.issues[0]!.message);
      return false;
    }
    return true;
  };

  const signIn = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : error.message);
      return;
    }
    toast.success("เข้าสู่ระบบสำเร็จ");
  };

  const signUp = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!fullName.trim()) {
      toast.error("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    if (!validate()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName.trim() },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already registered") ? "อีเมลนี้ถูกใช้งานแล้ว" : error.message);
      return;
    }
    if (!data.session) {
      toast.success("สมัครสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน");
    }
  };

  const googleSignIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setLoading(false);
      toast.error("เข้าสู่ระบบด้วย Google ไม่สำเร็จ");
      return;
    }
    if (result.redirected) return;
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary to-sidebar p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-primary-foreground">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-foreground">
            SC
          </div>
          <h1 className="text-2xl font-bold">SuperChoice AI</h1>
          <p className="inline-flex items-center justify-center gap-1 text-sm opacity-80">
            ระบบสินเชื่อจำนำเล่มทะเบียนแลกเงินสด
            <EnvironmentVersionInfo className="text-primary-foreground/90" />
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>เข้าสู่ระบบ</CardTitle>
            <CardDescription>สำหรับพนักงานและผู้บริหาร 11 สาขา</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="signin">เข้าสู่ระบบ</TabsTrigger>
                <TabsTrigger value="signup">สมัครใช้งาน</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">อีเมล</Label>
                    <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.co.th" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">รหัสผ่าน</Label>
                    <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin" />} เข้าสู่ระบบ
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname">ชื่อ-นามสกุล</Label>
                    <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="สมชาย ใจดี" maxLength={100} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">อีเมล</Label>
                    <Input id="email2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password2">รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
                    <Input id="password2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin" />} สมัครใช้งาน
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    ผู้ใช้ใหม่จะถูกกำหนดสิทธิ์เป็น &quot;พนักงาน&quot; สังกัดสำนักงานใหญ่ ผู้ดูแลระบบสามารถย้ายสาขาและปรับสิทธิ์ได้ภายหลัง
                  </p>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">หรือ</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={googleSignIn} disabled={loading}>
              เข้าสู่ระบบด้วย Google
            </Button>

            <Button
              variant="outline"
              className="mt-2 w-full border-[#06C755]/40 text-[#06C755] hover:bg-[#06C755]/10 hover:text-[#06C755]"
              onClick={() => {
                window.location.href = "/api/public/auth/line/start";
              }}
              disabled={loading}
            >
              เข้าสู่ระบบ / สมัครใช้งานด้วย LINE
            </Button>


            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> ข้อมูลถูกแยกตามสาขาและควบคุมสิทธิ์ทุกระดับ
            </p>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-primary-foreground/70">
          <Link to="/">กลับหน้าแรก</Link>
        </p>
      </div>
    </div>
  );
}
