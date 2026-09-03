import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_customers",
  title: "Search customers",
  description:
    "Search customers (ลูกค้า) by name, customer code or phone. Returns basic profile fields only; national ID is never returned.",
  inputSchema: {
    query: z.string().trim().min(1).max(100).describe("Name, customer code or phone fragment."),
    branch_id: z.string().uuid().optional().describe("Restrict to one branch (uuid from list_branches)."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, branch_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const q = query.replace(/[%,()]/g, " ").trim();
    let req = supabaseForUser(ctx)
      .from("customers")
      .select("id, code, full_name, phone, district, province, status, branch_id, created_at")
      .or(`full_name.ilike.%${q}%,code.ilike.%${q}%,phone.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (branch_id) req = req.eq("branch_id", branch_id);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { customers: data },
    };
  },
});
