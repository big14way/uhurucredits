import { describe, test, expect } from "bun:test";
import { computeCreditScore, extractScoringParams } from "./scoring-algorithm";
import type { ScoringParams, MonoTransaction } from "./types";

describe("computeCreditScore", () => {
  test("returns base score of 300 with no data", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 0,
      worldIdVerified: false,
      reclaimVerified: false,
      hasExistingLoans: false,
    };
    expect(computeCreditScore(params)).toBe(300);
  });

  test("adds 100 for worldIdVerified", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 0,
      worldIdVerified: true,
      reclaimVerified: false,
      hasExistingLoans: false,
    };
    expect(computeCreditScore(params)).toBe(400);
  });

  test("adds 100 for reclaimVerified", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 0,
      worldIdVerified: false,
      reclaimVerified: true,
      hasExistingLoans: false,
    };
    expect(computeCreditScore(params)).toBe(400);
  });

  test("both identity verifications give 200 bonus", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 0,
      worldIdVerified: true,
      reclaimVerified: true,
      hasExistingLoans: false,
    };
    expect(computeCreditScore(params)).toBe(500);
  });

  test("high income Nigerian user gets high score", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 100000, // NGN 100K/month
      transactionFrequency: 40, // 40 tx/month
      avgBalance: 200000,
      balanceHealthScore: 2.0,
      negativeBalanceDays: 0,
      worldIdVerified: true,
      reclaimVerified: true,
      hasExistingLoans: false,
    };
    const score = computeCreditScore(params);
    expect(score).toBeGreaterThanOrEqual(850);
    expect(score).toBeLessThanOrEqual(1000);
  });

  test("deducts for negative balance days", () => {
    const baseParams: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 0,
      worldIdVerified: true,
      reclaimVerified: false,
      hasExistingLoans: false,
    };
    const baseScore = computeCreditScore(baseParams);

    const negativeParams = { ...baseParams, negativeBalanceDays: 10 };
    const negativeScore = computeCreditScore(negativeParams);

    expect(negativeScore).toBe(baseScore - 30); // 10 * 3 = 30
  });

  test("deducts 50 for existing loans", () => {
    const baseParams: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 0,
      worldIdVerified: false,
      reclaimVerified: false,
      hasExistingLoans: false,
    };
    const baseScore = computeCreditScore(baseParams);

    const loanParams = { ...baseParams, hasExistingLoans: true };
    const loanScore = computeCreditScore(loanParams);

    expect(loanScore).toBe(baseScore - 50);
  });

  test("score is capped at 1000", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 1000000,
      transactionFrequency: 100,
      avgBalance: 5000000,
      balanceHealthScore: 5.0,
      negativeBalanceDays: 0,
      worldIdVerified: true,
      reclaimVerified: true,
      hasExistingLoans: false,
    };
    expect(computeCreditScore(params)).toBe(1000);
  });

  test("score never goes below 0", () => {
    const params: ScoringParams = {
      avgMonthlyIncome: 0,
      transactionFrequency: 0,
      avgBalance: 0,
      balanceHealthScore: 0,
      negativeBalanceDays: 200, // 200 * 3 = 600 deduction, capped at 100
      worldIdVerified: false,
      reclaimVerified: false,
      hasExistingLoans: true,
    };
    const score = computeCreditScore(params);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("extractScoringParams", () => {
  test("extracts params from empty transactions", () => {
    const params = extractScoringParams([], true, false);
    expect(params.avgMonthlyIncome).toBe(0);
    expect(params.transactionFrequency).toBe(0);
    expect(params.avgBalance).toBe(0);
    expect(params.worldIdVerified).toBe(true);
    expect(params.reclaimVerified).toBe(false);
  });

  test("extracts params from recent transactions", () => {
    const now = new Date();
    const transactions: MonoTransaction[] = [
      {
        amount: 30000,
        type: "credit",
        date: now.toISOString(),
        balance: 50000,
        narration: "Salary",
      },
      {
        amount: 5000,
        type: "debit",
        date: now.toISOString(),
        balance: 45000,
        narration: "Purchase",
      },
      {
        amount: 20000,
        type: "credit",
        date: now.toISOString(),
        balance: 65000,
        narration: "Transfer",
      },
    ];

    const params = extractScoringParams(transactions, true, true);
    expect(params.avgMonthlyIncome).toBeGreaterThan(0);
    expect(params.transactionFrequency).toBe(1); // 3 tx / 3 months
    expect(params.avgBalance).toBeGreaterThan(0);
    expect(params.worldIdVerified).toBe(true);
    expect(params.reclaimVerified).toBe(true);
  });
});
