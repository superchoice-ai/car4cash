import { createFileRoute } from "@tanstack/react-router";

/** เริ่มขั้นตอน LINE Login: พาไปหน้ายินยอมของ LINE */
export const Route = createFileRoute("/api/public/auth/line/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getIntegrationSecret, LINE_SECRET_KEYS } = await import("@/lib/line.server");
        const clientId = await getIntegrationSecret(LINE_SECRET_KEYS.loginChannelId);
        const origin = new URL(request.url).origin;
        if (!clientId) {
          return Response.redirect(`${origin}/auth?line_error=${encodeURIComponent("ยังไม่ได้ตั้งค่า LINE Login Channel ID")}`, 302);
        }

        const state = crypto.randomUUID();
        const nonce = crypto.randomUUID();
        const redirectUri = `${origin}/api/public/auth/line/callback`;

        const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("state", state);
        authorizeUrl.searchParams.set("scope", "openid profile email");
        authorizeUrl.searchParams.set("nonce", nonce);
        authorizeUrl.searchParams.set("bot_prompt", "aggressive");

        const cookie = `line_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`;
        return new Response(null, {
          status: 302,
          headers: { location: authorizeUrl.toString(), "set-cookie": cookie },
        });
      },
    },
  },
});
