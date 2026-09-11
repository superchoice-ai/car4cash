// Owned by this repo (the @lovable.dev/mcp-js generated banner was removed on purpose so
// the Vite plugin can never regenerate or delete this route). Content matches the generated
// OAuth protected-resource metadata route for /mcp.
// route: /.well-known/oauth-protected-resource
// emitted to: src/routes/[.well-known]/oauth-protected-resource.ts

import { createFileRoute } from "@tanstack/react-router";

import { createTanStackOAuthProtectedResourceMetadataHandler } from "@lovable.dev/mcp-js/stacks/tanstack";

import mcp from "../../lib/mcp/index";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      ANY: createTanStackOAuthProtectedResourceMetadataHandler(mcp, {
        resourcePath: "/mcp",
        metadataPath: "/.well-known/oauth-protected-resource",
        // Trusting X-Forwarded-Host is safe on Lovable hosting only (its proxy
        // overwrites the header); remove both options behind other proxies.
        trustForwardedHost: true,
        forwardedHostTrustedByPlatform: true,
      }),
    },
  },
});
