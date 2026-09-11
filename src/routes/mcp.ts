import { createFileRoute } from "@tanstack/react-router";
import { createTanStackMcpHandler } from "@lovable.dev/mcp-js/stacks/tanstack";
import mcp from "../lib/mcp/index";
import { isAiModeEnabled } from "@/lib/ai-modes.server";

const handleMcp = createTanStackMcpHandler(mcp, {
  resourcePath: "/mcp",
  metadataPath: "/.well-known/oauth-protected-resource",
  trustForwardedHost: true,
});

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      ANY: async (context) => {
        if (!(await isAiModeEnabled("external_mcp"))) {
          return Response.json(
            {
              error: "service_unavailable",
              message: "MCP สำหรับ AI ภายนอกถูกปิดใช้งานโดยผู้ดูแลระบบ",
            },
            { status: 503 },
          );
        }
        return handleMcp(context);
      },
    },
  },
});
