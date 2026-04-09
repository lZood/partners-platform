import { round } from "@/lib/utils";

interface DistributionInput {
  userId: string;
  userName: string;
  percentageShare: number; // e.g. 60 for 60%
}

interface DistributionResult {
  userId: string;
  userName: string;
  percentageShare: number;
  allocatedAmount: number;
}

/**
 * Distribute a gross amount among users based on their percentage shares.
 * Validates that percentages sum to exactly 100%.
 */
export function distributeAmount(
  grossAmount: number,
  distributions: DistributionInput[]
): { results: DistributionResult[]; isValid: boolean; totalPercentage: number } {
  const totalPercentage = round(
    distributions.reduce((sum, d) => sum + d.percentageShare, 0),
    2
  );

  const isValid = totalPercentage === 100;

  const results: DistributionResult[] = distributions.map((d) => ({
    userId: d.userId,
    userName: d.userName,
    percentageShare: d.percentageShare,
    allocatedAmount: round(grossAmount * (d.percentageShare / 100), 6),
  }));

  return { results, isValid, totalPercentage };
}

/**
 * Validate that distribution percentages for a product sum to 100%.
 */
export function validateDistributionSum(
  distributions: { percentageShare: number }[]
): { isValid: boolean; total: number; diff: number } {
  const total = round(
    distributions.reduce((sum, d) => sum + d.percentageShare, 0),
    2
  );
  return {
    isValid: total === 100,
    total,
    diff: round(100 - total, 2),
  };
}
