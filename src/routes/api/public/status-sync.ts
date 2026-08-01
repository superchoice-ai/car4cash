import { createFileRoute } from "@tanstack/react-router";
import { runStatusSync } from "@/lib/status-sync.server";

/**
 * Endpoint สำหรับ n8n / cron ให้เรียกเป็นระยะ (ทุก 5 นาที)
 * ตั้งค่า STATUS_SYNC_SECRET แล้วส่ง header x-sync-secret เพื่อจำกัดผู้เรียก
 */
export const Route = createFileRoute("/api/public/status-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STATUS_SYNC_SECRET"];
        if (secret && request.headers.get("x-sync-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runStatusSync();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
