import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, baht, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contracts",
  title: "List contracts",
  description:
    "List loan contracts (สัญญา) visible to the signed-in user, optionally filtered by status, branch or customer. Amounts are returned in baht.",
  inputSchema: {
    status: z.enum(["active", "overdue", "closed", "cancelled"]).optional(),
    branch_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, branch_id, customer_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    let req = supabaseForUser(ctx)
      .from("contracts")
      .select(
        "id, code, status, principal, interest_rate, term_months, installment_amount, total_payable, outstanding, start_date, end_date, branch_id, customer_id, customers:customer_id(code, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) req = req.eq("status", status);
    if (branch_id) req = req.eq("branch_id", branch_id);
    if (customer_id) req = req.eq("customer_id", customer_id);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((c) => ({
      ...c,
      principal: baht(c.principal),
      installment_amount: baht(c.installment_amount),
      total_payable: baht(c.total_payable),
      outstanding: baht(c.outstanding),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { contracts: rows },
    };
  },
});
