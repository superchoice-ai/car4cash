import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState } from "@/components/Common";
import { Card, CardContent } from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/format";
import { EVENT_LABEL } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/notifications/")({
  head: () => ({
    meta: [
      { title: "การแจ้งเตือน | ธารทรัพย์" },
      { name: "description", content: "การแจ้งเตือนเหตุการณ์สำคัญ เช่น ผลอนุมัติ ครบกำหนดชำระ และผลการสำรองข้อมูล" },
      { property: "og:title", content: "การแจ้งเตือน | ธารทรัพย์" },
      { property: "og:description", content: "ศูนย์รวมการแจ้งเตือนของระบบ" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { branchId } = useBranchFilter();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", branchId],
    queryFn: async () => {
      let q = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader title="การแจ้งเตือน" description="เหตุการณ์สำคัญในระบบ (พร้อมต่อยอด LINE OA ใน Phase 1.1)" />
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="ยังไม่มีการแจ้งเตือน" />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((n) => (
            <Card key={n.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{n.title}</p>
                  <span className="text-xs text-muted-foreground">{formatThaiDateTime(n.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message ?? EVENT_LABEL[n.event_type] ?? n.event_type}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
