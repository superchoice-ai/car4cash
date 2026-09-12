import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  FileSignature,
  Wallet,
  PhoneCall,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  Bell,
  Sparkles,
  Activity,
  DatabaseBackup,
  Scale,
  ArrowUpCircle,

} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/labels";
import { BranchFilterProvider, useBranchFilter } from "@/hooks/useBranchFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnvironmentVersionInfo } from "@/components/EnvironmentVersionInfo";


interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  admin?: boolean;
  hq?: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { to: "/customers", label: "ลูกค้า", icon: Users },
  { to: "/applications", label: "คำขอสินเชื่อ", icon: FileText },
  { to: "/contracts", label: "สัญญา", icon: FileSignature },
  { to: "/payments", label: "รับชำระ", icon: Wallet },
  { to: "/finance", label: "สมุดรายรับ-รายจ่าย", icon: Scale },
  { to: "/finance/expenses", label: "บันทึกรายจ่าย", icon: ArrowUpCircle },
  { to: "/collections", label: "ติดตามหนี้", icon: PhoneCall },

  { to: "/approvals", label: "อนุมัติ", icon: CheckSquare },
  { to: "/reports", label: "รายงาน", icon: BarChart3 },
  { to: "/assistant", label: "ผู้ช่วย AI", icon: Sparkles },
  { to: "/status", label: "สถานะระบบ", icon: Activity },
  { to: "/settings/import", label: "นำเข้าข้อมูลเดิม", icon: DatabaseBackup, admin: true },
  { to: "/settings", label: "ตั้งค่าระบบ", icon: Settings, admin: true },
];

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <BranchFilterProvider>
      <AppShell>{children}</AppShell>
    </BranchFilterProvider>
  );
}

function BranchSwitcher() {
  const { branchId, setBranchId, branches, canSelect, scopeName } = useBranchFilter();
  if (!canSelect) {
    return <span className="text-sm font-medium text-foreground">{scopeName}</span>;
  }
  return (
    <Select value={branchId ?? "all"} onValueChange={(v) => setBranchId(v === "all" ? null : v)}>
      <SelectTrigger className="h-8 w-[210px] text-sm" aria-label="เลือกสาขา">
        <SelectValue placeholder="ทุกสาขา" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">ทุกสาขา (รวมทั้งบริษัท)</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.code} · {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, branch, roles, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { branchId } = useBranchFilter();


  const { data: pendingCount } = useQuery({
    queryKey: ["approvals-pending-count", branchId],
    queryFn: async () => {
      let q = supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (branchId) q = q.eq("branch_id", branchId);
      const { count } = await q;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread", branchId],
    queryFn: async () => {
      let q = supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (branchId) q = q.eq("branch_id", branchId);
      const { count } = await q;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });


  const items = NAV.filter((i) => (i.admin ? isAdmin : true));

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            SC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">SuperChoice AI</p>
            <p className="flex items-center gap-1 text-[11px] text-sidebar-foreground/70">
              <span className="truncate">สินเชื่อจำนำเล่มทะเบียน</span>
              <EnvironmentVersionInfo className="text-sidebar-foreground/80" />
            </p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="ปิดเมนู">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.to === "/approvals" && !!pendingCount && (
                  <span className="rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 rounded-md bg-sidebar-accent/60 px-3 py-2">
            <p className="truncate text-sm font-medium">{profile?.full_name || "ผู้ใช้งาน"}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/70">
              {roles.map((r) => ROLE_LABEL[r]).join(", ") || "ยังไม่กำหนดสิทธิ์"}
            </p>
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-sidebar-foreground/70">
              <Building2 className="size-3" />
              {branch?.name ?? "ไม่ระบุสาขา"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" /> ออกจากระบบ
          </Button>
        </div>
      </aside>

      {open && (
        <div className="no-print fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="เปิดเมนู">
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4" />
            <BranchSwitcher />
            {branch?.is_hq && <Badge variant="secondary">สำนักงานใหญ่</Badge>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label="การแจ้งเตือน">
              <Bell className="size-4" />
              {!!unread && (
                <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />
              )}
            </Link>
          </div>
        </header>
        <main className="print-area flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
