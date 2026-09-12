import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function EnvironmentVersionInfo({ className }: { className?: string }) {
  const [environment, setEnvironment] = useState<"Prod" | "Dev">("Dev");

  useEffect(() => {
    setEnvironment(window.location.hostname === "car4cash.lovable.app" ? "Prod" : "Dev");
  }, []);

  const version = `${environment}${import.meta.env["VITE_CAR4CASH_BUILD_VERSION"] ?? "000000v.01"}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle outline-none hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label="ดูเวอร์ชันระบบ"
        >
          <Info className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto px-3 py-2 text-xs font-medium">
        {version}
      </PopoverContent>
    </Popover>
  );
}
