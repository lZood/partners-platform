import { round } from "@/lib/utils";

/**
 * Convert USD to MXN with high precision.
 * Uses the manual exchange rate from the bank deposit.
 */
export function usdToMxn(amountUsd: number, exchangeRate: number): number {
  return round(amountUsd * exchangeRate, 6);
}

/**
 * Convert MXN to USD with high precision.
 */
export function mxnToUsd(amountMxn: number, exchangeRate: number): number {
  if (exchangeRate === 0) return 0;
  return round(amountMxn / exchangeRate, 6);
}
