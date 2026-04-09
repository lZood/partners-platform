import type { UserRole } from "./database";

// Current authenticated user with role info
export interface AppUser {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  role: UserRole;
  partnerId: string;
  partnerName: string;
}

// Partner with summary stats
export interface PartnerWithStats {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  collaboratorCount: number;
}

// Product with its distribution
export interface ProductWithDistribution {
  id: string;
  name: string;
  productType: string;
  isActive: boolean;
  distributions: {
    userId: string;
    userName: string;
    percentageShare: number;
  }[];
  totalPercentage: number;
  isValid: boolean; // totalPercentage === 100
}

// Tax breakdown step
export interface TaxStep {
  name: string;
  rate: number;
  deducted: number;
  remaining: number;
}

// Report line item for display
export interface ReportLineItemDisplay {
  userId: string;
  userName: string;
  productName: string;
  percentageApplied: number;
  grossUsd: number;
  taxBreakdown: TaxStep[];
  afterTaxesUsd: number;
  adjustmentsUsd: number;
  finalUsd: number;
  finalMxn: number;
}

// User summary within a report
export interface UserReportSummary {
  userId: string;
  userName: string;
  totalGrossUsd: number;
  totalAfterTaxesUsd: number;
  totalAdjustmentsUsd: number;
  totalFinalUsd: number;
  totalFinalMxn: number;
  lineItems: ReportLineItemDisplay[];
}

// CSV row from Microsoft/Minecraft
export interface CsvRow {
  productName: string;
  amountUsd: number;
  [key: string]: string | number; // flexible for extra columns
}

// Navigation item
export interface NavItem {
  title: string;
  href: string;
  icon: string;
  roles: UserRole[];
}
