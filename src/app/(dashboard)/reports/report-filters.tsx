"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportFiltersProps {
  years: number[];
  partners: Array<{
    id: string;
    name: string;
  }>;
  currentYear?: string;
  currentPartner?: string;
}

export function ReportFilters({
  years,
  partners,
  currentYear,
  currentPartner,
}: ReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleYearChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("year");
    } else {
      params.set("year", value);
    }
    router.push(`?${params.toString()}`);
  };

  const handlePartnerChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("partner");
    } else {
      params.set("partner", value);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="year-filter" className="text-sm font-medium text-muted-foreground">
          Año:
        </label>
        <Select value={currentYear || "all"} onValueChange={handleYearChange}>
          <SelectTrigger id="year-filter" className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los años</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="partner-filter" className="text-sm font-medium text-muted-foreground">
          Partner:
        </label>
        <Select value={currentPartner || "all"} onValueChange={handlePartnerChange}>
          <SelectTrigger id="partner-filter" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los partners</SelectItem>
            {partners.map((partner) => (
              <SelectItem key={partner.id} value={partner.id}>
                {partner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
