import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, baht, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_payments",
  title: "List payment receipts",
  description:
    "List payment receipts (ใบเสร็จรับชำระ) visible to the signed-in user for a date range, optionally for one branch or contract, with totals split into principal/interest/penalty. Voided receipts are excluded. Amounts in baht.",
  inputSchema: {
    branch_id: z.string().uuid().optional().describe("Limit to one branch; omit for everything visible."),
    contract_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive start date YYYY-MM-DD. Default: first day of current month."),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Inclusive end date YYYY-MM-DD. Default: today."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_id, contract_id, date_from, date_to, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const today = new Date().toISOString().slice(0, 10);
    const from = date_from ?? `${today.slice(0, 7)}-01`;
    const to = date_to ?? today;
    let req = supabaseForUser(ctx)
      .from("payments")
      .select(
        "id, receipt_no, paid_at, amount, principal_part, interest_part, penalty_part, method, branch_id, contract_id, contracts:contract_id(code, customers:customer_id(code, full_name))",
      )
      .eq("voided", false)
      .gte("paid_at", from)
      .lte("paid_at", to)
      .order("paid_at", { ascending: false })
      .limit(limit);
    if (branch_id) req = req.eq("branch_id", branch_id);
    if (contract_id) req = req.eq("contract_id", contract_id);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const sum = (k: "amount" | "principal_part" | "interest_part" | "penalty_part") =>
      (data ?? []).reduce((a, p) => a + (p[k] ?? 0), 0);
    const rows = (data ?? []).map((p) => ({
      ...p,
      amount: baht(p.amount),
      principal_part: baht(p.principal_part),
      interest_part: baht(p.interest_part),
      penalty_part: baht(p.penalty_part),
    }));
    const summary = {
      date_from: from,
      date_to: to,
      receipts: rows.length,
      total_baht: baht(sum("amount")),
      principal_baht: baht(sum("principal_part")),
      interest_baht: baht(sum("interest_part")),
      penalty_baht: baht(sum("penalty_part")),
    };
    return {
      content: [{ type: "text", text: JSON.stringify({ summary, payments: rows }, null, 2) }],
      structuredContent: { summary, payments: rows },
    };
  },
});
