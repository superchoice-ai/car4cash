import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ContractPromisPrint, FALLBACK_COMPANY } from "@/components/ContractPromisPrint";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contract-print/$contractId")({ component: ContractPrintPage });

function ContractPrintPage() {
  const { contractId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["contract-print", contractId],
    queryFn: async () => {
      const [contractResult, companyResult] = await Promise.all([
        supabase
          .from("contracts")
          .select("*, customers:customer_id(id,code,full_name,national_id,phone,address,district,province,postcode,birth_date), vehicles:vehicle_id(plate_no,plate_province,brand,model,vehicle_type,chassis_no), branches:branch_id(name,address)")
          .eq("id", contractId)
          .single(),
        supabase.from("system_settings").select("value,updated_at").eq("key", "company").maybeSingle(),
      ]);
      if (contractResult.error) throw contractResult.error;
      if (companyResult.error) throw companyResult.error;
      return {
        contract: contractResult.data,
        company: (companyResult.data?.value ?? FALLBACK_COMPANY) as any,
      };
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    if (!data?.contract) return;
    document.documentElement.classList.add("contract-print-document");
    document.body.classList.add("contract-print-document");
    const timer = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(timer);
      document.documentElement.classList.remove("contract-print-document");
      document.body.classList.remove("contract-print-document");
    };
  }, [data?.contract]);

  if (isLoading) return <div className="p-6 text-sm">กำลังเตรียมสัญญาสำหรับพิมพ์...</div>;
  if (error || !data?.contract) return <div className="p-6 text-sm text-destructive">ไม่สามารถโหลดสัญญาสำหรับพิมพ์ได้</div>;

  return <main className="contract-print-route"><ContractPromisPrint contract={data.contract as any} company={data.company} /></main>;
}
