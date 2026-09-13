// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execFileSync } from "node:child_process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function getBangkokBuildVersion() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  let dailyCommitCount = 1;

  try {
    dailyCommitCount = Math.max(
      1,
      Number(
        execFileSync(
          "git",
          [
            "rev-list",
            "--count",
            "HEAD",
            `--since=${year}-${month}-${day}T00:00:00+07:00`,
            `--until=${year}-${month}-${day}T23:59:59+07:00`,
          ],
          { encoding: "utf8" },
        ).trim(),
      ),
    );
  } catch {
    // Build environments without Git metadata still expose a stable first version.
  }

  return `${year.slice(-2)}${month}${day}v.${String(dailyCommitCount).padStart(2, "0")}`;
}

const car4CashBuildVersion = getBangkokBuildVersion();

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
  vite: {
    define: {
      "import.meta.env.VITE_CAR4CASH_BUILD_VERSION": JSON.stringify(car4CashBuildVersion),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
