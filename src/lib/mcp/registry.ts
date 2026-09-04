/**
 * Single source of truth for the read-only tool set. Shared by the MCP server
 * (`./index.ts`) and the in-app AI assistant so both expose identical
 * capabilities and both run through the caller's own RLS context.
 * Import-safe: no env reads or I/O at module level.
 */
import type { ToolDefinition, ZodRawShape } from "@lovable.dev/mcp-js";
import listBranches from "./tools/list-branches";
import searchCustomers from "./tools/search-customers";
import listContracts from "./tools/list-contracts";
import getContract from "./tools/get-contract";
import listOverdueInstallments from "./tools/list-overdue-installments";
import listPendingApprovals from "./tools/list-pending-approvals";
import portfolioSummary from "./tools/portfolio-summary";
import listCashEntries from "./tools/list-cash-entries";
import listPayments from "./tools/list-payments";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = ToolDefinition<any, any> & { readonly inputSchema?: ZodRawShape };

export const READ_ONLY_TOOLS: readonly AnyTool[] = [
  listBranches,
  portfolioSummary,
  searchCustomers,
  listContracts,
  getContract,
  listOverdueInstallments,
  listPendingApprovals,
  listCashEntries,
  listPayments,
];
