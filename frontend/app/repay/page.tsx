"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import { getActiveLoan, CONTRACTS, ERC20ContractABI, LoanManagerContractABI } from "@/lib/contracts";

interface LoanData {
  loanId: number;
  borrower: string;
  principal: number;
  totalDue: number;
  amountRepaid: number;
  installmentsTotal: number;
  installmentsPaid: number;
  installmentAmount: number;
  nextPaymentDue: number;
  paymentInterval: number;
  status: number;
  missedPayments: number;
}

export default function Repay() {
  const router = useRouter();
  const [loan, setLoan] = useState<LoanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");

  const fetchLoan = useCallback(async () => {
    try {
      const address = MiniKit.isInstalled()
        ? MiniKit.user?.walletAddress || "0x0000000000000000000000000000000000000000"
        : "0x0000000000000000000000000000000000000000";
      const loanData = await getActiveLoan(address);
      setLoan(loanData);
    } catch {
      setLoan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  // Countdown timer
  useEffect(() => {
    if (!loan || loan.status !== 0) return;

    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = loan.nextPaymentDue - now;

      if (diff <= 0) {
        setCountdown("OVERDUE");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      setCountdown(`${days}d ${hours}h ${minutes}m`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [loan]);

  const isOverdue = loan ? Math.floor(Date.now() / 1000) > loan.nextPaymentDue : false;
  const isFullyRepaid = loan?.status === 1;
  const progressPercent = loan ? (loan.installmentsPaid / loan.installmentsTotal) * 100 : 0;

  const handleRepay = async () => {
    if (!MiniKit.isInstalled() || !loan) {
      setError("Please open in World App");
      return;
    }

    setRepaying(true);
    setError("");

    try {
      // First approve USDC spend
      await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.USDC as `0x${string}`,
            abi: ERC20ContractABI,
            functionName: "approve",
            args: [CONTRACTS.LOAN_MANAGER as `0x${string}`, BigInt(Math.ceil(loan.installmentAmount * 1e6))],
          },
        ],
      });

      // Then repay installment
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACTS.LOAN_MANAGER as `0x${string}`,
            abi: LoanManagerContractABI,
            functionName: "repayInstallment",
            args: [BigInt(loan.loanId)],
          },
        ],
      });

      if (finalPayload.status === "success") {
        await fetchLoan();
      } else {
        setError("Transaction failed. Please try again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      setError(message);
    } finally {
      setRepaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-teal-400">Loading loan...</div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white">&#8592;</button>
            <h1 className="text-xl font-bold">Repayment</h1>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-4">No active loan found</p>
            <button
              onClick={() => router.push("/apply")}
              className="px-6 py-3 bg-teal-500 text-white rounded-xl font-medium hover:bg-teal-600 transition-colors"
            >
              Apply for a Loan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">&#8592;</button>
          <h1 className="text-xl font-bold">Repayment</h1>
        </div>

        {/* Fully Repaid */}
        {isFullyRepaid && (
          <div className="mb-6 p-6 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <div className="text-5xl mb-3">&#127881;</div>
            <p className="text-green-400 text-xl font-bold">Loan Complete!</p>
            <p className="text-green-400/70 text-sm mt-1">Your credit score has improved.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 px-6 py-2 bg-green-500/20 text-green-400 rounded-lg font-medium hover:bg-green-500/30 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* Overdue Banner */}
        {isOverdue && loan.status === 0 && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 font-bold">Overdue! Pay now to avoid default and credit score damage</p>
          </div>
        )}

        {/* Loan Summary */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Borrowed</p>
              <p className="text-lg font-bold">${loan.principal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Due</p>
              <p className="text-lg font-bold">${loan.totalDue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Repaid</p>
              <p className="text-lg font-bold text-green-400">${loan.amountRepaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Remaining</p>
              <p className="text-lg font-bold text-yellow-400">
                ${(loan.totalDue - loan.amountRepaid).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="font-medium">
              {loan.installmentsPaid}/{loan.installmentsTotal} installments
            </span>
          </div>
          <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverdue ? "bg-red-500" : "bg-gradient-to-r from-teal-500 to-green-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Countdown */}
        {loan.status === 0 && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Next payment due in</p>
            <p className={`text-2xl font-bold ${isOverdue ? "text-red-400" : "text-white"}`}>
              {countdown}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Installment: ${loan.installmentAmount.toFixed(2)} USDC
            </p>
          </div>
        )}

        {/* Payment History */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
          <p className="text-sm text-gray-400 mb-3">Payment History</p>
          <div className="space-y-2">
            {Array.from({ length: loan.installmentsTotal }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={i < loan.installmentsPaid ? "text-green-400" : "text-gray-600"}>
                    {i < loan.installmentsPaid ? "&#9989;" : "&#9898;"}
                  </span>
                  <span className="text-sm">Installment {i + 1}</span>
                </div>
                <span className="text-sm font-medium">
                  {i < loan.installmentsPaid ? (
                    <span className="text-green-400">${loan.installmentAmount.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-500">Pending</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pay Button */}
        {loan.status === 0 && loan.installmentsPaid < loan.installmentsTotal && (
          <button
            onClick={handleRepay}
            disabled={repaying}
            className={`w-full py-4 font-bold rounded-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isOverdue
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gradient-to-r from-teal-500 to-green-500 text-white hover:from-teal-600 hover:to-green-600"
            }`}
          >
            {repaying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">&#9696;</span> Processing...
              </span>
            ) : (
              `Pay Installment - $${loan.installmentAmount.toFixed(2)} USDC`
            )}
          </button>
        )}

        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
