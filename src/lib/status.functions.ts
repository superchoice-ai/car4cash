import { createServerFn } from "@tanstack/react-start";
import { parseStatusFeed, buildAlertText, type IncidentSeverity } from "./status-feed";

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  info: 0,
  minor: 1,
  maintenance: 2,
  major: 3,
  critical: 4,
};

/**
 * ดึงฟีดสถานะระบบ วิเคราะห์ผลกระทบ/ระดับความรุนแรง บันทึกลงฐานข้อมูล
 * และส่งแจ้งเตือนเข้า LINE (ถ้าตั้งค่าไว้) เฉพาะรายการที่ยังไม่เคยแจ้ง
 */
export const syncStatusFeed = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: setting } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "status_feed")
    .maybeSingle();
  const cfg = (setting?.value ?? {}) as { url?: string; enabled?: boolean; line_notify_min_severity?: IncidentSeverity };
  if (cfg.enabled === false) return { synced: 0, notified: 0, skipped: "disabled" as const };

  const url = cfg.url || "https://status.lovable.dev/feed.rss";
  const res = await fetch(url, { headers: { accept: "application/rss+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`ดึงฟีดสถานะไม่สำเร็จ (${res.status})`);
  const incidents = parseStatusFeed(await res.text());

  const guids = incidents.map((i) => i.guid);
  const { data: existing } = await supabaseAdmin
    .from("status_incidents")
    .select("guid, incident_state, started_at, notified_line, notified_browser")
    .in("guid", guids.length ? guids : ["__none__"]);
  const byGuid = new Map((existing ?? []).map((e) => [e.guid, e]));

  const minRank = SEVERITY_RANK[cfg.line_notify_min_severity ?? "major"] ?? 3;
  const lineToken = process.env["LINE_CHANNEL_ACCESS_TOKEN"];
  const { data: lineSetting } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "line_notify")
    .maybeSingle();
  const lineCfg = (lineSetting?.value ?? {}) as { to?: string[]; enabled?: boolean };

  let notified = 0;

  for (const inc of incidents) {
    const prev = byGuid.get(inc.guid);
    const startedAt = prev?.started_at ?? inc.publishedAt;
    const resolvedAt = inc.state === "resolved" ? inc.publishedAt : null;
    const stateChanged = !prev || prev.incident_state !== inc.state;

    const shouldNotify =
      stateChanged &&
      (SEVERITY_RANK[inc.severity] >= minRank || inc.state === "resolved") &&
      !!lineCfg.enabled &&
      !!lineToken &&
      (lineCfg.to?.length ?? 0) > 0;

    const record = {
      guid: inc.guid,
      source: "lovable",
      title: inc.title,
      link: inc.link,
      severity: inc.severity,
      incident_state: inc.state,
      impact_summary: inc.impactSummary,
      situation: inc.situation,
      raw_content: inc.raw,
      started_at: startedAt,
      resolved_at: resolvedAt,
      published_at: inc.publishedAt,
      notified_browser: prev?.notified_browser ?? false,
      notified_line: prev?.notified_line ?? false,
    };

    if (shouldNotify) {
      const text = buildAlertText({
        title: inc.title,
        severity: inc.severity,
        incident_state: inc.state,
        impact_summary: inc.impactSummary,
        situation: inc.situation,
        started_at: startedAt,
        resolved_at: resolvedAt,
        link: inc.link,
      });
      for (const to of lineCfg.to ?? []) {
        try {
          const push = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${lineToken}` },
            body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
          });
          if (push.ok) {
            record.notified_line = true;
            notified++;
          } else {
            console.error("LINE push failed", push.status, await push.text());
          }
        } catch (e) {
          console.error("LINE push error", e);
        }
      }
    }

    await supabaseAdmin.from("status_incidents").upsert(record, { onConflict: "guid" });
  }

  return { synced: incidents.length, notified, skipped: null };
});
