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

export interface AggregatedTax {
  name: string;
  /** Nominal rate when consistent across every line item; null if it varied. */
  rate: number | null;
  totalUsd: number;
}

/**
 * Aggregate per-line-item tax breakdowns into a per-tax total.
 *
 * Each report line item stores the cascade `tax_breakdown` (the amount
 * `deducted` for every tax). This sums those deductions by tax name so a
 * report can show how much of each individual tax was withheld — not just the
 * combined post-tax figure. Taxes keep their first-seen order, which matches
 * the cascade priority order they were applied in.
 */
export function aggregateTaxBreakdown(
  breakdowns: (TaxStep[] | null | undefined)[]
): AggregatedTax[] {
  const map = new Map<
    string,
    { name: string; rate: number; rateConsistent: boolean; totalUsd: number }
  >();
  const order: string[] = [];

  for (const breakdown of breakdowns) {
    if (!Array.isArray(breakdown)) continue;
    for (const step of breakdown) {
      if (!step?.name) continue;
      if (!map.has(step.name)) {
        map.set(step.name, {
          name: step.name,
          rate: Number(step.rate),
          rateConsistent: true,
          totalUsd: 0,
        });
        order.push(step.name);
      }
      const entry = map.get(step.name)!;
      if (entry.rate !== Number(step.rate)) entry.rateConsistent = false;
      entry.totalUsd += Number(step.deducted ?? 0);
    }
  }

  return order.map((name) => {
    const entry = map.get(name)!;
    return {
      name: entry.name,
      rate: entry.rateConsistent ? entry.rate : null,
      totalUsd: round(entry.totalUsd, 6),
    };
  });
}
