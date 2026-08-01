/** วิเคราะห์ฟีด RSS สถานะระบบ (status.lovable.dev) และจัดระดับการแจ้งเตือน */

export type IncidentSeverity = "critical" | "major" | "minor" | "maintenance" | "info";
export type IncidentState = "investigating" | "identified" | "monitoring" | "resolved" | "maintenance";

export interface ParsedIncident {
  guid: string;
  title: string;
  link: string | null;
  publishedAt: string;
  state: IncidentState;
  severity: IncidentSeverity;
  situation: string;
  impactSummary: string;
  components: string[];
  raw: string;
}

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  critical: "วิกฤต",
  major: "รุนแรง",
  minor: "เล็กน้อย",
  maintenance: "ปิดปรับปรุง",
  info: "แจ้งให้ทราบ",
};

export const STATE_LABEL: Record<IncidentState, string> = {
  investigating: "กำลังตรวจสอบ",
  identified: "ทราบสาเหตุแล้ว",
  monitoring: "เฝ้าติดตามผล",
  resolved: "แก้ไขเสร็จแล้ว",
  maintenance: "ปิดปรับปรุงตามแผน",
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const stripTags = (s: string) =>
  decode(s)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]!).trim() : null;
};

function classify(title: string, body: string): { state: IncidentState; severity: IncidentSeverity } {
  const t = `${title} ${body}`.toLowerCase();
  const statusMatch = body.match(/Status:\s*([A-Za-z ]+)/i);
  const status = (statusMatch?.[1] ?? "").trim().toLowerCase();

  let state: IncidentState = "investigating";
  if (status.startsWith("resolved") || status.startsWith("completed")) state = "resolved";
  else if (status.startsWith("monitoring")) state = "monitoring";
  else if (status.startsWith("identified")) state = "identified";
  else if (status.includes("maintenance") || status.startsWith("scheduled") || status.startsWith("in progress"))
    state = "maintenance";

  let severity: IncidentSeverity;
  if (t.includes("maintenance")) severity = "maintenance";
  else if (/outage|unavailable|down|major|cannot|failing|failure|not working|incident/.test(t)) severity = "critical";
  else if (/degraded|slow|elevated|partial|intermittent|delays?/.test(t)) severity = "major";
  else severity = "minor";

  if (state === "resolved" && severity !== "maintenance") severity = "info";
  return { state, severity };
}

function summarizeImpact(title: string, components: string[], state: IncidentState): string {
  const t = title.toLowerCase();
  const areas: string[] = [];
  if (/build|deploy|publish/.test(t)) areas.push("การบิลด์/เผยแพร่แอป");
  if (/cloud|database|supabase/.test(t)) areas.push("ฐานข้อมูลและระบบหลังบ้าน");
  if (/editor|preview/.test(t)) areas.push("การแก้ไข/พรีวิวระบบ");
  if (/ai|model|gateway/.test(t)) areas.push("ผู้ช่วย AI");
  if (/auth|login|sign in/.test(t)) areas.push("การเข้าสู่ระบบ");
  if (/api/.test(t)) areas.push("การเชื่อมต่อ API");
  if (areas.length === 0 && components.length > 0) areas.push(components.join(", "));
  if (areas.length === 0) areas.push("บริการทั่วไปของแพลตฟอร์ม");

  const scope = /published apps are not affected|not affected/.test(t)
    ? "แอปที่เผยแพร่แล้วยังใช้งานได้ตามปกติ"
    : "อาจกระทบผู้ใช้งานที่กำลังใช้ระบบอยู่";

  return state === "resolved"
    ? `เคยกระทบ: ${areas.join(" · ")} — ขณะนี้กลับมาใช้งานได้ปกติแล้ว`
    : `กระทบ: ${areas.join(" · ")} — ${scope}`;
}

export function parseStatusFeed(xml: string): ParsedIncident[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => {
    const title = stripTags(tag(item, "title") ?? "(ไม่มีหัวข้อ)");
    const link = tag(item, "link");
    const guid = tag(item, "guid") ?? link ?? title;
    const pub = tag(item, "pubDate");
    const bodyRaw = tag(item, "content:encoded") ?? tag(item, "description") ?? "";
    const body = stripTags(bodyRaw);
    const { state, severity } = classify(title, body);

    const components = (bodyRaw.match(/<li>([\s\S]*?)<\/li>/gi) ?? []).map((li) => stripTags(li)).filter(Boolean);
    const situation =
      body
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^status:/i.test(l) && !/^affected components/i.test(l))
        .slice(0, 3)
        .join(" ") || title;

    const publishedAt = pub ? new Date(pub).toISOString() : new Date().toISOString();

    return {
      guid,
      title,
      link,
      publishedAt,
      state,
      severity,
      situation,
      impactSummary: summarizeImpact(title, components, state),
      components,
      raw: body,
    };
  });
}

const thaiTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " น."
    : "-";

/** ข้อความแจ้งเตือนภาษาไทย ใช้ได้ทั้ง LINE และ Browser notification */
export function buildAlertText(i: {
  title: string;
  severity: IncidentSeverity;
  incident_state: IncidentState | string;
  impact_summary?: string | null;
  situation?: string | null;
  started_at?: string | null;
  resolved_at?: string | null;
  link?: string | null;
}): string {
  const icon = { critical: "🔴", major: "🟠", minor: "🟡", maintenance: "🔧", info: "🟢" }[i.severity] ?? "🔔";
  const lines = [
    `${icon} แจ้งเตือนสถานะระบบ (${SEVERITY_LABEL[i.severity]})`,
    `เรื่อง: ${i.title}`,
    `สถานะ: ${STATE_LABEL[i.incident_state as IncidentState] ?? i.incident_state}`,
    `สถานการณ์: ${i.situation ?? "-"}`,
    `ผลกระทบ: ${i.impact_summary ?? "-"}`,
    `พบปัญหาเมื่อ: ${thaiTime(i.started_at)}`,
    `แก้ไขเสร็จเมื่อ: ${i.resolved_at ? thaiTime(i.resolved_at) : "ยังไม่แก้ไขเสร็จ"}`,
  ];
  if (i.link) lines.push(`รายละเอียด: ${i.link}`);
  return lines.join("\n");
}

export const formatThaiTime = thaiTime;
