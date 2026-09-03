import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listBranches from "./tools/list-branches";
import searchCustomers from "./tools/search-customers";
import listContracts from "./tools/list-contracts";
import getContract from "./tools/get-contract";
import listOverdueInstallments from "./tools/list-overdue-installments";
import listPendingApprovals from "./tools/list-pending-approvals";
import portfolioSummary from "./tools/portfolio-summary";

// OAuth issuer must be the direct Supabase host; the project ref is inlined at build time.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "car4cash-demo",
  title: "Car4Cash Demo",
  version: "0.1.0",
  instructions:
    "Read-only tools for the ธารทรัพย์ (Car4Cash) vehicle-title loan system. Callers act as the signed-in staff user; row-level security limits results to their branch and role. Start with `list_branches` or `portfolio_summary`, then drill down with `list_contracts`, `get_contract`, `search_customers`, `list_overdue_installments` and `list_pending_approvals`. All amounts are in Thai baht. Data changes (approvals, payments, edits) must be made in the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listBranches,
    portfolioSummary,
    searchCustomers,
    listContracts,
    getContract,
    listOverdueInstallments,
    listPendingApprovals,
  ],
});
