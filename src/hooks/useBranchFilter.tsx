import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BranchOption {
  id: string;
  code: string;
  name: string;
  is_hq: boolean;
}

interface BranchFilterValue {
  /** null = รวมข้อมูลทุกสาขา */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  branches: BranchOption[];
  /** ผู้ใช้สำนักงานใหญ่เท่านั้นที่เลือกสาขาได้ */
  canSelect: boolean;
  /** ชื่อขอบเขตข้อมูลที่กำลังดู ใช้แสดงบนหัวรายงาน */
  scopeName: string;
}

const STORAGE_KEY = "tharnsaph.branch-filter";

const BranchFilterContext = createContext<BranchFilterValue | null>(null);

export function BranchFilterProvider({ children }: { children: ReactNode }) {
  const { isHQ, branch } = useAuth();
  const [branchId, setBranchIdState] = useState<string | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ["branch-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, code, name, is_hq")
        .eq("active", true)
        .order("code");
      if (error) throw error;
      return (data ?? []) as BranchOption[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== "all") setBranchIdState(saved);
  }, []);

  const setBranchId = (id: string | null) => {
    setBranchIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id ?? "all");
  };

  const value = useMemo<BranchFilterValue>(() => {
    const canSelect = isHQ;
    const effective = canSelect ? branchId : (branch?.id ?? null);
    const found = branches.find((b) => b.id === effective);
    return {
      branchId: effective,
      setBranchId,
      branches,
      canSelect,
      scopeName: effective ? (found?.name ?? branch?.name ?? "-") : "ทุกสาขา (รวมทั้งบริษัท)",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHQ, branchId, branch?.id, branch?.name, branches]);

  return <BranchFilterContext.Provider value={value}>{children}</BranchFilterContext.Provider>;
}

export function useBranchFilter(): BranchFilterValue {
  const ctx = useContext(BranchFilterContext);
  if (!ctx) throw new Error("useBranchFilter must be used within BranchFilterProvider");
  return ctx;
}

/** ใส่เงื่อนไขสาขาให้ query ถ้าเลือกสาขาเดียว (null = ทุกสาขา) */
export function applyBranch<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  branchId: string | null,
): T {
  return branchId ? query.eq("branch_id", branchId) : query;
}
