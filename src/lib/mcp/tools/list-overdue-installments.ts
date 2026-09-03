import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, baht, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_overdue_installments",
  title: "List overdue installments",
  description:
    "List installments (งวด) that are past due and not fully paid, oldest first, for collections follow-up. Amounts in baht.",
  inputSchema: {
    branch_id: z.string().uuid().optional(),
    min_days_overdue: z.number().int().min(0).max(3650).default(0),
    limit: z.number().int().min(1).max(100).default(30),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_id, min_days_overdue, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const cutoff = new Date(Date.now() - min_days_overdue * 86_400_000).toISOString().slice(0, 10);
    let req = supabaseForUser(ctx)
      .from("installments")
      .select("id, seq, due_date, total_amount, paid_amount, status, branch_id, contracts:contract_id(code, status, customers:customer_id(code, full_name, phone))")
      .lt("due_date", cutoff)
      .neq("status", "paid")
      .order("due_date")
      .limit(limit);
    if (branch_id) req = req.eq("branch_id", branch_id);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const today = Date.now();
    const rows = (data ?? []).map((i) => ({
      ...i,
      total_amount: baht(i.total_amount),
      paid_amount: baht(i.paid_amount),
      remaining: baht(Math.max((i.total_amount ?? 0) - (i.paid_amount ?? 0), 0)),
      days_overdue: Math.floor((today - new Date(i.due_date).getTime()) / 86_400_000),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { installments: rows },
    };
  },
});
