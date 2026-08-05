import { createFileRoute } from "@tanstack/react-router";

interface LineTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface LineVerifyResponse {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  error?: string;
  error_description?: string;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** รับ callback จาก LINE Login แล้วสร้าง/ผูกผู้ใช้ในระบบ พร้อมพาเข้าสู่ระบบ */
export const Route = createFileRoute("/api/public/auth/line/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const fail = (msg: string) =>
          Response.redirect(`${origin}/auth?line_error=${encodeURIComponent(msg)}`, 302);

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieState = readCookie(request.headers.get("cookie"), "line_oauth_state");
        if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description") || "ยกเลิกการเข้าสู่ระบบด้วย LINE");
        if (!code) return fail("ไม่พบรหัสยืนยันจาก LINE");
        if (!state || !cookieState || state !== cookieState) return fail("สถานะการเข้าสู่ระบบไม่ถูกต้อง กรุณาลองใหม่");

        const { getIntegrationSecret, LINE_SECRET_KEYS } = await import("@/lib/line.server");
        const [clientId, clientSecret] = await Promise.all([
          getIntegrationSecret(LINE_SECRET_KEYS.loginChannelId),
          getIntegrationSecret(LINE_SECRET_KEYS.loginChannelSecret),
        ]);
        if (!clientId || !clientSecret) return fail("ยังไม่ได้ตั้งค่า LINE Login Channel ID/Secret");

        const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: `${origin}/api/public/auth/line/callback`,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
        const token = (await tokenRes.json()) as LineTokenResponse;
        if (!tokenRes.ok || !token.id_token) return fail(token.error_description || "แลกโทเคนกับ LINE ไม่สำเร็จ");

        const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ id_token: token.id_token, client_id: clientId }),
        });
        const profile = (await verifyRes.json()) as LineVerifyResponse;
        if (!verifyRes.ok || !profile.sub) return fail(profile.error_description || "ยืนยันข้อมูล LINE ไม่สำเร็จ");

        const email = (profile.email ?? `line_${profile.sub}@line.local`).toLowerCase();
        const fullName = profile.name ?? "ผู้ใช้ LINE";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, line_user_id: profile.sub, avatar_url: profile.picture ?? null },
        });
        if (created.error && !/already|registered|exists/i.test(created.error.message)) {
          return fail(created.error.message);
        }

        const link = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${origin}/auth?line=1` },
        });
        if (link.error || !link.data.properties?.action_link) {
          return fail(link.error?.message ?? "สร้างลิงก์เข้าสู่ระบบไม่สำเร็จ");
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: link.data.properties.action_link,
            "set-cookie": "line_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
          },
        });
      },
    },
  },
});
