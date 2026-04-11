import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as USD currency
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as MXN currency
 */
export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Round a number to N decimal places (for financial calculations)
 */
export function round(value: number, decimals: number = 6): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Convert USD to MXN using a given exchange rate
 */
export function convertUsdToMxn(usd: number, rate: number): number {
  return round(usd * rate, 6);
}

/**
 * Get display name: first 2 names from a full name.
 * "Jose Carlos Garcia Lopez" → "Jose Carlos"
 * "Carlos" → "Carlos"
 */
export function displayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ");
}

/**
 * Get initials from a name (max 2 chars).
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/**
 * Format a month date (YYYY-MM-DD) to display string
 */
export function formatMonth(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(date);
}
