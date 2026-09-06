import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, BellRing, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { syncStatusFeed } from "@/lib/status.functions";
import { PageHeader, EmptyState, StatCard } from "@/components/Common";
import { StandardPagination, paginateRows } from "@/components/StandardPagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SEVERITY_LABEL, STATE_LABEL, formatThaiTime, type IncidentSeverity, type IncidentState } from "@/lib/status-feed";

export const Route = createFileRoute("/_authenticated/status/")({
  head: () => ({ meta: [{ title: "สถานะระบบ & แจ้งเตือน | SuperChoice AI" }, { name: "description", content: "ติดตามสถานะแพลตฟอร์มแบบเรียลไทม์ สรุปผลกระทบ ระดับความรุนแรง เวลาที่พบปัญหาและเวลาที่แก้ไขเสร็จ" }, { property: "og:title", content: "สถานะระบบ & แจ้งเตือน | SuperChoice AI" }, { property: "og:description", content: "แจ้งเตือนเหตุขัดข้องของแพลตฟอร์มผ่านเบราว์เซอร์และ LINE" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: StatusPage,
});

const SEVERITY_CLASS: Record<IncidentSeverity, string> = { critical: "bg-destructive/15 text-destructive", major: "bg-warning/20 text-warning-foreground", minor: "bg-secondary text-secondary-foreground", maintenance: "bg-primary/10 text-primary", info: "bg-success/15 text-success" };

function StatusPage() {
  const qc = useQueryClient();
  const sync = useServerFn(syncStatusFeed);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) { setPermission("unsupported"); return; }
    setPermission(Notification.permission);
  }, []);

  const { data: incidents, isLoading } = useQuery({
    queryKey: ["status-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("status_incidents").select("*").order("published_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 120000,
  });

  useEffect(() => {
    const channel = supabase.channel("status-incidents-live").on("postgres_changes", { event: "*", schema: "public", table: "status_incidents" }, (payload) => {
      const row = payload.new as { title?: string; severity?: IncidentSeverity; incident_state?: IncidentState; impact_summary?: string | null } | null;
      if (!row?.title) return;
      const head = `[${SEVERITY_LABEL[row.severity ?? "minor"]}] ${row.title}`;
      const body = `${STATE_LABEL[row.incident_state ?? "investigating"]} — ${row.impact_summary ?? ""}`;
      toast(head, { description: body });
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") new Notification(head, { body });
      void qc.invalidateQueries({ queryKey: ["status-incidents"] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  const refresh = useMutation({ mutationFn: async () => sync({ data: undefined }), onSuccess: (r) => { toast.success(`อัปเดตแล้ว ${r.synced} รายการ${r.notified ? ` · ส่ง LINE ${r.notified} ข้อความ` : ""}`); void qc.invalidateQueries({ queryKey: ["status-incidents"] }); }, onError: (e: Error) => toast.error(e.message) });

  const list = incidents ?? [];
  const openList = list.filter((i) => i.incident_state !== "resolved");
  const critical = openList.filter((i) => i.severity === "critical").length;
  useEffect(() => setPage(1), [list.length, pageSize]);
  const pagination = paginateRows(list, page, pageSize);

  return <div>
    <PageHeader title="สถานะระบบ & แจ้งเตือน" description="ดึงข้อมูลจากฟีดสถานะแพลตฟอร์ม สรุปผลกระทบเป็นภาษาไทย พร้อมแจ้งเตือนเบราว์เซอร์และ LINE" actions={<>{permission === "default" && <Button variant="outline" onClick={() => void Notification.requestPermission().then(setPermission)}><BellRing className="size-4" /> เปิดแจ้งเตือนเบราว์เซอร์</Button>}<Button onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCw className={cn("size-4", refresh.isPending && "animate-spin")} /> ดึงข้อมูลล่าสุด</Button></>} />

    <div className="mb-4 grid gap-3 sm:grid-cols-3"><StatCard label="เหตุการณ์ที่ยังไม่ปิด" value={String(openList.length)} tone={openList.length ? "warning" : "success"} icon={<Activity className="size-5" />} /><StatCard label="ระดับวิกฤต" value={String(critical)} tone={critical ? "danger" : "default"} /><StatCard label="เหตุการณ์ทั้งหมดที่บันทึก" value={String(list.length)} /></div>

    {isLoading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div> : list.length === 0 ? <EmptyState title="ยังไม่มีข้อมูลสถานะ" description="กดปุ่ม ดึงข้อมูลล่าสุด เพื่อโหลดเหตุการณ์จากฟีดสถานะแพลตฟอร์ม" /> : <Card><CardContent className="p-0"><div className="space-y-3 p-3">{pagination.rows.map((i) => <Card key={i.id}><CardContent className="p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_CLASS[i.severity as IncidentSeverity] ?? "bg-secondary")}>{SEVERITY_LABEL[i.severity as IncidentSeverity] ?? i.severity}</span><Badge variant="outline">{STATE_LABEL[i.incident_state as IncidentState] ?? i.incident_state}</Badge>{i.notified_line && <Badge variant="secondary">แจ้ง LINE แล้ว</Badge>}</div><h2 className="mt-2 font-semibold">{i.title}</h2><p className="mt-1 text-sm text-muted-foreground">{i.situation}</p><p className="mt-1 text-sm">{i.impact_summary}</p></div><div className="shrink-0 space-y-1 text-right text-xs text-muted-foreground"><p>พบปัญหา: {formatThaiTime(i.started_at)}</p><p>แก้ไขเสร็จ: {i.resolved_at ? formatThaiTime(i.resolved_at) : <span className="text-warning-foreground">ยังไม่แล้วเสร็จ</span>}</p>{i.link && <a href={i.link} target="_blank" rel="noreferrer" className="text-primary hover:underline">ดูรายละเอียด</a>}</div></div></CardContent></Card>)}</div><StandardPagination page={pagination.page} pageSize={pageSize} total={list.length} onPageChange={setPage} onPageSizeChange={setPageSize}/></CardContent></Card>}
  </div>;
}