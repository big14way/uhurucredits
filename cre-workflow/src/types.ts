export interface MonoTransaction {
  amount: number;
  type: "debit" | "credit";
  date: string;
  balance: number;
  narration: string;
}

export interface ScoringParams {
  avgMonthlyIncome: number;
  transactionFrequency: number;
  avgBalance: number;
  balanceHealthScore: number;
  negativeBalanceDays: number;
  worldIdVerified: boolean;
  reclaimVerified: boolean;
  hasExistingLoans: boolean;
}

export interface CreditReport {
  wallet: string;
  score: number;
  worldIdVerified: boolean;
  reclaimVerified: boolean;
  computedAt: number;
}
