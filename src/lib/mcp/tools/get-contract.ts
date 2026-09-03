import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, baht, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_contract",
  title: "Get contract details",
  description:
    "Get one loan contract by id or contract code, including its installment schedule and non-voided payments. Amounts in baht.",
  inputSchema: {
    contract_id: z.string().uuid().optional().describe("Contract uuid."),
    code: z.string().trim().min(1).max(50).optional().describe("Contract code, e.g. CT-HQ-0001."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ contract_id, code }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    if (!contract_id && !code) throw new ToolError("Provide contract_id or code.");
    const sb = supabaseForUser(ctx);
    let req = sb
      .from("contracts")
      .select("*, customers:customer_id(code, full_name, phone), branches:branch_id(code, name)")
      .limit(1);
    req = contract_id ? req.eq("id", contract_id) : req.eq("code", code!);
    const { data: contract, error } = await req.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!contract) throw new ToolError("Contract not found or not visible to you.");

    const [{ data: installments }, { data: payments }] = await Promise.all([
      sb
        .from("installments")
        .select("seq, due_date, principal_amount, interest_amount, penalty_amount, total_amount, paid_amount, paid_date, status")
        .eq("contract_id", contract.id)
        .order("seq"),
      sb
        .from("payments")
        .select("receipt_no, paid_at, amount, principal_part, interest_part, penalty_part, method")
        .eq("contract_id", contract.id)
        .eq("voided", false)
        .order("paid_at"),
    ]);

    const result = {
      ...contract,
      principal: baht(contract.principal),
      fee_amount: baht(contract.fee_amount),
      installment_amount: baht(contract.installment_amount),
      total_payable: baht(contract.total_payable),
      outstanding: baht(contract.outstanding),
      installments: (installments ?? []).map((i) => ({
        ...i,
        principal_amount: baht(i.principal_amount),
        interest_amount: baht(i.interest_amount),
        penalty_amount: baht(i.penalty_amount),
        total_amount: baht(i.total_amount),
        paid_amount: baht(i.paid_amount),
      })),
      payments: (payments ?? []).map((p) => ({
        ...p,
        amount: baht(p.amount),
        principal_part: baht(p.principal_part),
        interest_part: baht(p.interest_part),
        penalty_part: baht(p.penalty_part),
      })),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { contract: result },
    };
  },
});
