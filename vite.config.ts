// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // src/routes/mcp.ts and src/routes/[.well-known]/oauth-protected-resource.ts are
    // authored by hand so the /mcp endpoint can honour the admin "external_mcp" AI Mode
    // toggle. Point the plugin at a non-existent entry so it keeps the env define but
    // does not try to overwrite those user-authored routes (which aborts the build).
    plugins: [mcpPlugin({ mcpEntry: "src/lib/mcp/route-generation-disabled.ts" })],
  },
});
