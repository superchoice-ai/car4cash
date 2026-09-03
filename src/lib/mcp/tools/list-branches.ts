import { defineTool } from "@lovable.dev/mcp-js";
import { NOT_AUTHENTICATED, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_branches",
  title: "List branches",
  description: "List the active branches (สาขา) the signed-in user is allowed to see, with id, code, name and district.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return NOT_AUTHENTICATED;
    const { data, error } = await supabaseForUser(ctx)
      .from("branches")
      .select("id, code, name, district, is_hq")
      .eq("active", true)
      .order("code");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { branches: data },
    };
  },
});
