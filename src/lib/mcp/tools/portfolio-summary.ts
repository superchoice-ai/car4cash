import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, baht, supabaseForUser } from "../supabase";

export default defineTool({
  name: "portfolio_summary",
  title: "Portfolio summary",
  description:
    "Summarise the loan portfolio the signed-in user can see: customers, contracts by status, outstanding balance, overdue installments, this month's receipts and cash book. Amounts in baht.",
  inputSchema: {
    branch_id: z.string().uuid().optional().describe("Limit to one branch; omit for everything visible."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_id }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const sb = supabaseForUser(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const scoped = <T extends { eq: (col: string, val: string) => T }>(q: T): T => (branch_id ? q.eq("branch_id", branch_id) : q);

    const [customers, contracts, overdue, payments, cash, pending] = await Promise.all([
      scoped(sb.from("customers").select("id", { count: "exact", head: true })),
      scoped(sb.from("contracts").select("status, outstanding")),
      scoped(sb.from("installments").select("total_amount, paid_amount").lt("due_date", today).neq("status", "paid")),
      scoped(sb.from("payments").select("amount").gte("paid_at", monthStart).eq("voided", false)),
      scoped(sb.from("cash_entries").select("direction, total_amount").gte("entry_date", monthStart).eq("voided", false)),
      scoped(sb.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
    ]);
    const firstError = [customers, contracts, overdue, payments, cash, pending].find((r) => r.error)?.error;
    if (firstError) return { content: [{ type: "text", text: firstError.message }], isError: true };

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const byStatus: Record<string, number> = {};
    for (const c of contracts.data ?? []) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    const summary = {
      scope: branch_id ?? "all visible branches",
      as_of: today,
      customers: customers.count ?? 0,
      contracts_by_status: byStatus,
      outstanding_baht: baht(sum((contracts.data ?? []).filter((c) => c.status !== "closed").map((c) => c.outstanding ?? 0))),
      overdue_installments: overdue.data?.length ?? 0,
      overdue_amount_baht: baht(sum((overdue.data ?? []).map((i) => Math.max((i.total_amount ?? 0) - (i.paid_amount ?? 0), 0)))),
      received_this_month_baht: baht(sum((payments.data ?? []).map((p) => p.amount ?? 0))),
      cash_income_this_month_baht: baht(sum((cash.data ?? []).filter((c) => c.direction === "income").map((c) => c.total_amount ?? 0))),
      cash_expense_this_month_baht: baht(sum((cash.data ?? []).filter((c) => c.direction === "expense").map((c) => c.total_amount ?? 0))),
      pending_approvals: pending.count ?? 0,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
