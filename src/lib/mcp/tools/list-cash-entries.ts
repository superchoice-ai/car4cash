import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, baht, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_cash_entries",
  title: "List cash book entries",
  description:
    "List cash book (สมุดเงินสด รายรับ-รายจ่าย) entries visible to the signed-in user for a date range, with per-category line breakdown and totals. Voided entries are excluded. Amounts in baht.",
  inputSchema: {
    branch_id: z.string().uuid().optional().describe("Limit to one branch; omit for everything visible."),
    direction: z.enum(["income", "expense"]).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive start date YYYY-MM-DD. Default: first day of current month."),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive end date YYYY-MM-DD. Default: today."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_id, direction, date_from, date_to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const today = new Date().toISOString().slice(0, 10);
    const from = date_from ?? `${today.slice(0, 7)}-01`;
    const to = date_to ?? today;
    let req = supabaseForUser(ctx)
      .from("cash_entries")
      .select(
        "id, doc_no, entry_date, direction, party_name, method, total_amount, change_amount, note, branch_id, lines:cash_entry_lines(category, amount)",
      )
      .eq("voided", false)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false })
      .limit(limit);
    if (branch_id) req = req.eq("branch_id", branch_id);
    if (direction) req = req.eq("direction", direction);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const byCategory: Record<string, number> = {};
    let income = 0;
    let expense = 0;
    const rows = (data ?? []).map((e) => {
      const lines = (e.lines ?? []).map((l) => {
        byCategory[`${e.direction}:${l.category}`] = (byCategory[`${e.direction}:${l.category}`] ?? 0) + (l.amount ?? 0);
        return { category: l.category, amount: baht(l.amount) };
      });
      if (e.direction === "income") income += e.total_amount ?? 0;
      else expense += e.total_amount ?? 0;
      return { ...e, total_amount: baht(e.total_amount), change_amount: baht(e.change_amount), lines };
    });
    const summary = {
      date_from: from,
      date_to: to,
      entries: rows.length,
      income_baht: baht(income),
      expense_baht: baht(expense),
      net_baht: baht(income - expense),
      by_category_baht: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, baht(v)])),
    };
    return {
      content: [{ type: "text", text: JSON.stringify({ summary, entries: rows }, null, 2) }],
      structuredContent: { summary, entries: rows },
    };
  },
});
