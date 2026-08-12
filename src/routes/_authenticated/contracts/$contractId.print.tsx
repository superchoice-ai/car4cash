import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ContractPromisPrint } from "@/components/ContractPromisPrint";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/contracts/$contractId/print")({
  component: ContractPrintPage,
});

function ContractPrintPage() {
  const { contractId } = Route.useParams();
  const { data: contract, isLoading, error } = useQuery({
    queryKey: ["contract-print", contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*, customers:customer_id(id,code,full_name,national_id,phone,address,district,province,postcode,birth_date), vehicles:vehicle_id(plate_no,plate_province,brand,model,vehicle_type,chassis_no), branches:branch_id(name,address)")
        .eq("id", contractId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!contract) return;
    document.body.classList.add("contract-print-page");
    const timer = window.setTimeout(() => window.print(), 250);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("contract-print-page");
    };
  }, [contract]);

  if (isLoading) return <div className="p-6 text-sm">กำลังเตรียมสัญญาสำหรับพิมพ์...</div>;
  if (error || !contract) return <div className="p-6 text-sm text-destructive">ไม่สามารถโหลดสัญญาสำหรับพิมพ์ได้</div>;

  return (
    <main className="contract-print-route">
      <ContractPromisPrint contract={contract as any} />
    </main>
  );
}
