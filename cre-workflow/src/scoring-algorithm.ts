import type { ScoringParams, MonoTransaction } from "./types";

export function computeCreditScore(params: ScoringParams): number {
  let score = 300; // base score

  // Balance health: avgBalance / avgMonthlyIncome ratio (max 200 points)
  const balanceRatio =
    params.avgMonthlyIncome > 0
      ? params.avgBalance / params.avgMonthlyIncome
      : 0;
  score += Math.min(200, Math.floor(balanceRatio * 200));

  // Transaction frequency: consistent activity (max 150 points)
  // 30+ tx/month = full points, scale linearly
  score += Math.min(
    150,
    Math.floor((params.transactionFrequency / 30) * 150)
  );

  // Income regularity (max 200 points)
  if (params.avgMonthlyIncome > 50000) score += 200; // NGN 50K+/month
  else if (params.avgMonthlyIncome > 20000) score += 150;
  else if (params.avgMonthlyIncome > 5000) score += 100;
  else if (params.avgMonthlyIncome > 1000) score += 50;

  // Deduct for negative balance days (up to -100)
  score -= Math.min(100, params.negativeBalanceDays * 3);

  // Identity bonuses
  if (params.worldIdVerified) score += 100;
  if (params.reclaimVerified) score += 100;

  // Existing loans penalty
  if (params.hasExistingLoans) score -= 50;

  return Math.max(0, Math.min(1000, score));
}

export function extractScoringParams(
  transactions: MonoTransaction[],
  worldIdVerified: boolean,
  reclaimVerified: boolean
): ScoringParams {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const recent = transactions.filter(
    (tx) => new Date(tx.date) >= ninetyDaysAgo
  );

  const credits = recent.filter((tx) => tx.type === "credit");
  const totalIncome = credits.reduce((sum, tx) => sum + tx.amount, 0);
  const avgMonthlyIncome = totalIncome / 3; // 90 days = 3 months

  const avgBalance =
    recent.length > 0
      ? recent.reduce((sum, tx) => sum + (tx.balance || 0), 0) / recent.length
      : 0;

  const negativeBalanceDays = recent.filter(
    (tx) => (tx.balance || 0) < 0
  ).length;

  return {
    avgMonthlyIncome,
    transactionFrequency: recent.length / 3,
    avgBalance,
    balanceHealthScore:
      avgMonthlyIncome > 0 ? avgBalance / avgMonthlyIncome : 0,
    negativeBalanceDays,
    worldIdVerified,
    reclaimVerified,
    hasExistingLoans: false,
  };
}
