import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pending_approvals",
  title: "List pending approvals",
  description:
    "List approval requests (คำขออนุมัติ) that are still pending, visible to the signed-in user. Approving or rejecting must be done in the app.",
  inputSchema: {
    branch_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(30),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    let req = supabaseForUser(ctx)
      .from("approval_requests")
      .select("id, type, entity_table, entity_label, reason, status, branch_id, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(limit);
    if (branch_id) req = req.eq("branch_id", branch_id);
    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { approvals: data },
    };
  },
});
