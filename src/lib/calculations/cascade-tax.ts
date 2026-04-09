import { round } from "@/lib/utils";
import type { TaxStep } from "@/types/app";

interface TaxInput {
  name: string;
  rate: number; // percentage, e.g. 10 for 10%
  order: number;
}

interface CascadeTaxResult {
  netAmount: number;
  totalDeducted: number;
  breakdown: TaxStep[];
}

/**
 * Apply cascade taxes sequentially.
 * Each tax is applied to the remaining amount after the previous tax.
 *
 * Example: gross = $100, taxes = [10%, 2.5%]
 *   Step 1: $100 - 10% = $90
 *   Step 2: $90 - 2.5% = $87.75
 *   Net: $87.75
 */
export function applyCascadeTaxes(
  grossAmount: number,
  taxes: TaxInput[]
): CascadeTaxResult {
  const sorted = [...taxes].sort((a, b) => a.order - b.order);
  let remaining = grossAmount;
  const breakdown: TaxStep[] = [];

  for (const tax of sorted) {
    const deducted = round(remaining * (tax.rate / 100), 6);
    remaining = round(remaining - deducted, 6);
    breakdown.push({
      name: tax.name,
      rate: tax.rate,
      deducted,
      remaining,
    });
  }

  return {
    netAmount: remaining,
    totalDeducted: round(grossAmount - remaining, 6),
    breakdown,
  };
}
