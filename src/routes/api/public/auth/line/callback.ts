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

        const { getIntegrationSecret, getLineRedirectUri, LINE_SECRET_KEYS } = await import("@/lib/line.server");
        const [clientId, clientSecret, redirectUri] = await Promise.all([
          getIntegrationSecret(LINE_SECRET_KEYS.loginChannelId),
          getIntegrationSecret(LINE_SECRET_KEYS.loginChannelSecret),
          getLineRedirectUri(origin),
        ]);
        if (!clientId || !clientSecret) return fail("ยังไม่ได้ตั้งค่า LINE Login Channel ID/Secret");

        const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
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

        const lineUserId = profile.sub;
        const verifiedEmail = profile.email?.trim().toLowerCase() || null;
        const fullName = profile.name ?? "ผู้ใช้ LINE";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        /** คืน auth user ถ้า UUID ยังมีอยู่จริงใน auth.users, ไม่เช่นนั้นคืน null (orphan) */
        const getAuthUser = async (id: string) => {
          const res = await supabaseAdmin.auth.admin.getUserById(id);
          return res.error || !res.data.user ? null : res.data.user;
        };

        let targetUserId: string | null = null;
        let targetEmail: string | null = null;

        // ---- 1) ค้นจาก LINE ID ก่อน ----
        const { data: linkedProfile, error: linkedErr } = await supabaseAdmin
          .from("profiles")
          .select("id, email, active, line_user_id")
          .eq("line_user_id", lineUserId)
          .maybeSingle();
        if (linkedErr) return fail(linkedErr.message);

        let orphanProfileId: string | null = null;
        if (linkedProfile) {
          const linkedAuth = await getAuthUser(linkedProfile.id);
          if (linkedAuth) {
            // Profile และ Auth ยังอยู่ → ใช้ UUID เดิม
            targetUserId = linkedAuth.id;
            targetEmail = linkedAuth.email ?? linkedProfile.email ?? null;
          } else {
            // Profile อยู่แต่ Auth ถูกลบ → orphan; ห้ามคืน role/branch เดิม
            orphanProfileId = linkedProfile.id;
          }
        }

        // ---- 2) ยังไม่เคยผูก LINE → ค้นผู้ใช้เดิมจากอีเมลที่ LINE ยืนยันแล้วเท่านั้น ----
        if (!targetUserId && verifiedEmail) {
          const { data: candidates, error: candErr } = await supabaseAdmin
            .from("profiles")
            .select("id, email, active, line_user_id")
            .ilike("email", verifiedEmail);
          if (candErr) return fail(candErr.message);

          const alive: { id: string; email: string | null; line_user_id: string | null }[] = [];
          for (const c of candidates ?? []) {
            const u = await getAuthUser(c.id);
            if (u) alive.push({ id: u.id, email: u.email ?? c.email, line_user_id: c.line_user_id });
          }

          // ---- 3) เลือก Target UUID อย่างปลอดภัย ----
          if (alive.length > 1) {
            return fail("พบบัญชีที่ใช้อีเมลนี้มากกว่าหนึ่งบัญชี กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบ");
          }
          if (alive.length === 1) {
            const found = alive[0]!;
            if (found.line_user_id && found.line_user_id !== lineUserId) {
              // บัญชีนี้ผูกกับ LINE อื่นอยู่แล้วและ Auth ยังใช้งาน → ไม่ย้ายอัตโนมัติ
              return fail("บัญชีอีเมลนี้ผูกกับ LINE บัญชีอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ");
            }
            targetUserId = found.id;
            targetEmail = found.email;
          }
        }

        // ---- 4) ไม่พบผู้ใช้ปัจจุบัน → สร้างผู้ใช้ใหม่ (ไม่ใช้ UUID เก่า) ----
        if (!targetUserId) {
          const email = verifiedEmail ?? `line_${lineUserId}@line.local`;
          const created = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: fullName, avatar_url: profile.picture ?? null },
          });
          if (created.error) {
            if (!/already|registered|exists/i.test(created.error.message)) return fail(created.error.message);
            // มี Auth user อีเมลนี้อยู่แล้วแต่ไม่พบผ่าน profiles → ค้นจาก auth โดยตรง
            let page = 1;
            while (!targetUserId && page <= 20) {
              const list = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
              if (list.error) return fail(list.error.message);
              const hit = list.data.users.find((u) => u.email?.toLowerCase() === email);
              if (hit) targetUserId = hit.id;
              if (list.data.users.length < 1000) break;
              page += 1;
            }
            if (!targetUserId) return fail("ไม่สามารถระบุบัญชีผู้ใช้สำหรับอีเมลนี้ได้ กรุณาติดต่อผู้ดูแลระบบ");
          } else {
            targetUserId = created.data.user?.id ?? null;
          }
          if (!targetUserId) return fail("สร้างบัญชีผู้ใช้ไม่สำเร็จ");
          targetEmail = email;
        }

        // ---- 5) เคลียร์ line_user_id ของ Profile เก่าที่พิสูจน์แล้วว่า Auth ถูกลบ ----
        if (orphanProfileId && orphanProfileId !== targetUserId) {
          const { error: clearErr } = await supabaseAdmin
            .from("profiles")
            .update({ line_user_id: null })
            .eq("id", orphanProfileId)
            .eq("line_user_id", lineUserId);
          if (clearErr) return fail(clearErr.message);
        }

        // ---- ผูก LINE ID กับ Profile เป้าหมาย (trigger สร้าง profile ให้แล้วตอน createUser) ----
        const { data: linkedRows, error: linkErr } = await supabaseAdmin
          .from("profiles")
          .update({ line_user_id: lineUserId })
          .eq("id", targetUserId)
          .select("id");
        if (linkErr) {
          return fail(/duplicate|unique/i.test(linkErr.message) ? "LINE บัญชีนี้ถูกผูกกับผู้ใช้อื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ" : linkErr.message);
        }
        if (!linkedRows || linkedRows.length === 0) {
          return fail("ไม่พบโปรไฟล์ผู้ใช้สำหรับผูก LINE กรุณาติดต่อผู้ดูแลระบบ");
        }

        // ---- 6) Sync auth metadata ให้ตรงกับ Profile (สำเนาอ้างอิง) ----
        const currentAuth = await getAuthUser(targetUserId);
        if (!currentAuth) return fail("ไม่พบบัญชีผู้ใช้ปลายทาง");
        const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {
            ...(currentAuth.user_metadata ?? {}),
            line_user_id: lineUserId,
            full_name: fullName,
            avatar_url: profile.picture ?? null,
          },
        });
        if (metaErr) return fail(metaErr.message);

        // ---- 7) สร้าง Magic Link หลังผูกบัญชีสำเร็จ ----
        const magicEmail = currentAuth.email ?? targetEmail;
        if (!magicEmail) return fail("บัญชีผู้ใช้ไม่มีอีเมลสำหรับเข้าสู่ระบบ");
        const link = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: magicEmail,
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
