import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        {icon && <div className={cn("mt-0.5 shrink-0", toneClass)}>{icon}</div>}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="tabular mt-1 text-xl font-bold">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-success/15 text-success",
  paid: "bg-success/15 text-success",
  approved: "bg-success/15 text-success",
  contracted: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  waived: "bg-muted text-muted-foreground",
  returned: "bg-muted text-muted-foreground",
  pending: "bg-warning/20 text-warning-foreground",
  pending_approval: "bg-warning/20 text-warning-foreground",
  submitted: "bg-warning/20 text-warning-foreground",
  partial: "bg-warning/20 text-warning-foreground",
  unpaid: "bg-secondary text-secondary-foreground",
  received: "bg-primary/10 text-primary",
  overdue: "bg-destructive/15 text-destructive",
  defaulted: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
  blacklist: "bg-destructive/15 text-destructive",
  seized: "bg-destructive/15 text-destructive",
};

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_TONE[status] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </span>
  );
}
