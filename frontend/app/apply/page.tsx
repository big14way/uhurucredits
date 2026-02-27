"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import { API_URL, CONTRACTS, LoanManagerContractABI } from "@/lib/contracts";

function getAPR(score: number): number {
  if (score >= 700) return 5;
  if (score >= 550) return 8;
  return 12;
}

function getTierName(score: number): string {
  if (score >= 850) return "PREMIUM";
  if (score >= 700) return "PRIME";
  if (score >= 550) return "STANDARD";
  if (score >= 400) return "MICRO";
  return "INELIGIBLE";
}

export default function Apply() {
  const router = useRouter();
  const [score, setScore] = useState(0);
  const [maxAmount, setMaxAmount] = useState(0);
  const [amount, setAmount] = useState(50);
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const address = MiniKit.isInstalled()
        ? MiniKit.user?.walletAddress || "0x0000000000000000000000000000000000000000"
        : "0x0000000000000000000000000000000000000000";
      const res = await fetch(`${API_URL}/api/credit/status/${address}`);
      const data = await res.json();
      setScore(data.score);
      setMaxAmount(data.maxLoanAmount);
      if (data.maxLoanAmount > 0) {
        setAmount(Math.min(50, data.maxLoanAmount));
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const apr = getAPR(score);
  const interest = (amount * apr) / 100;
  const totalRepayment = amount + interest;
  const installmentAmount = totalRepayment / 4;
  const paymentEveryDays = (durationWeeks * 7) / 4;

  const handleApplyLoan = async () => {
    if (!MiniKit.isInstalled()) {
      setError("Please open in World App to submit transactions");
      return;
    }

    setApplying(true);
    setError("");

    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.LOAN_MANAGER as `0x${string}`,
            abi: LoanManagerContractABI,
            functionName: "applyForLoan",
            args: [BigInt(amount * 1e6), durationWeeks],
          },
        ],
      });

      if (finalPayload.status === "success") {
        router.push("/repay");
      } else {
        setError("Transaction failed. Please try again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setError(message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-teal-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
            &#8592;
          </button>
          <h1 className="text-xl font-bold">Apply for Loan</h1>
        </div>

        {/* Tier Info */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">Your Credit Tier</p>
              <p className="text-lg font-bold text-teal-400">{getTierName(score)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Max Amount</p>
              <p className="text-lg font-bold">${maxAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Amount Slider */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Loan Amount (USDC)</label>
          <div className="text-3xl font-bold text-center mb-3">${amount}</div>
          <input
            type="range"
            min={50}
            max={maxAmount}
            step={50}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$50</span>
            <span>${maxAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Duration Selector */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Repayment Duration</label>
          <div className="grid grid-cols-3 gap-3">
            {[2, 4, 8].map((weeks) => (
              <button
                key={weeks}
                onClick={() => setDurationWeeks(weeks)}
                className={`py-3 rounded-xl text-center transition-all ${
                  durationWeeks === weeks
                    ? "bg-teal-500/20 border-teal-500 border text-teal-400"
                    : "bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600"
                }`}
              >
                <p className="font-bold">{weeks}</p>
                <p className="text-xs">weeks</p>
              </button>
            ))}
          </div>
        </div>

        {/* Loan Calculator */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">APR</span>
            <span className="font-medium">{apr}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Interest</span>
            <span className="font-medium">${interest.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Repayment</span>
            <span className="font-bold text-white">${totalRepayment.toFixed(2)}</span>
          </div>
          <hr className="border-gray-800" />
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Installment (x4)</span>
            <span className="font-bold text-teal-400">${installmentAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Payment every</span>
            <span className="font-medium">{paymentEveryDays.toFixed(1)} days</span>
          </div>
        </div>

        {/* Warning */}
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-400/80 text-xs">
            Defaulting will reduce your credit score and affect future borrowing.
            Payments are due every {paymentEveryDays.toFixed(1)} days.
          </p>
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleApplyLoan}
          disabled={applying || amount < 50 || amount > maxAmount}
          className="w-full py-4 bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold rounded-xl text-lg transition-all hover:from-teal-600 hover:to-green-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {applying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">&#9696;</span> Confirming...
            </span>
          ) : (
            `Confirm Loan - $${amount} USDC`
          )}
        </button>

        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
