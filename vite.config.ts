// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import.meta.env.VITE_CAR4CASH_BUILD_VERSION

// mcpPlugin() is intentionally NOT registered here.
//
// The MCP routes are checked into the repo and must stay checked in:
//   - src/routes/mcp.ts  (hand-authored: gates /mcp on the admin "external_mcp" AI Mode)
//   - src/routes/[.well-known]/oauth-protected-resource.ts  (generated snapshot, kept as-is)
//   - .lovable/mcp/manifest.json  (generated snapshot; refresh with the extract-manifest step)
//
// Running the plugin aborts the build because it refuses to overwrite the hand-authored
// mcp.ts, and pointing it at a missing entry makes it DELETE the generated OAuth route.
// The only env value it injected (VITE_SUPABASE_PROJECT_ID) already comes from .env.
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
