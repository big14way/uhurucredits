"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import { API_URL, CONTRACTS, LoanManagerContractABI } from "@/lib/contracts";
import { useWallet } from "@/lib/useWallet";

function getAPR(score: number) {
  if (score >= 700) return 5;
  if (score >= 550) return 8;
  return 12;
}

function getTier(score: number): { label: string; color: string; bg: string } {
  if (score >= 850) return { label: "PREMIUM",   color: "#2dd4bf", bg: "rgba(13,148,136,0.15)" };
  if (score >= 700) return { label: "PRIME",     color: "#34d399", bg: "rgba(16,185,129,0.15)" };
  if (score >= 550) return { label: "STANDARD",  color: "#fbbf24", bg: "rgba(245,158,11,0.15)" };
  if (score >= 400) return { label: "MICRO",     color: "#fb923c", bg: "rgba(249,115,22,0.15)" };
  return               { label: "INELIGIBLE", color: "#f87171", bg: "rgba(239,68,68,0.1)"  };
}

export default function Apply() {
  const router = useRouter();
  const { address, isInWorldApp } = useWallet();
  const [score, setScore] = useState(0);
  const [maxAmount, setMaxAmount] = useState(0);
  const [worldIdVerified, setWorldIdVerified] = useState(false);
  const [amount, setAmount] = useState(1);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/credit/status/${address}`);
      const data = await res.json();
      setScore(data.score);
      setMaxAmount(data.maxLoanAmount);
      setWorldIdVerified(data.worldIdVerified || false);
      if (data.maxLoanAmount > 0) setAmount(Math.min(1, data.maxLoanAmount));
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const apr = getAPR(score);
  const interest = +(amount * apr / 100).toFixed(2);
  const total = +(amount + interest).toFixed(2);
  const installment = +(total / 4).toFixed(2);
  const paymentDays = +((durationWeeks * 7) / 4).toFixed(1);
  const tier = getTier(score);

  const handleApply = async () => {
    if (!isInWorldApp) { setError("Please open in World App to submit transactions"); return; }
    setApplying(true);
    setError("");
    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [{
          address: CONTRACTS.LOAN_MANAGER as `0x${string}`,
          abi: LoanManagerContractABI,
          functionName: "applyForLoan",
          args: [BigInt(amount * 1e6), durationWeeks],
        }],
      });
      if (finalPayload.status === "success") {
        router.push("/repay");
      } else {
        setError("Transaction failed. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#06060f" }}>
        <svg className="animate-spin w-8 h-8 text-teal-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (maxAmount === 0) {
    return (
      <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
        <div className="max-w-md mx-auto">
          <div className="px-5 pt-12 pb-6">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Loan Application</p>
            <h1 className="text-2xl font-black text-white">Apply for Loan</h1>
          </div>
          <div className="px-5 space-y-4">
            <div className="rounded-3xl border border-white/5 p-8 text-center" style={{ background: "#0d0d18" }}>
              <div className="text-5xl mb-4">📊</div>
              <p className="text-white font-bold text-lg mb-1">No Credit Score Yet</p>
              <p className="text-gray-500 text-sm mb-6">Complete these steps to unlock borrowing</p>
              <div className="space-y-3 text-left">
                {[
                  { done: worldIdVerified,  icon: "🌍", label: "Verify identity with World ID" },
                  { done: false,            icon: "🏦", label: "Connect a bank account via Mono" },
                  { done: false,            icon: "📱", label: "Link M-Pesa history via Reclaim" },
                  { done: score > 0,        icon: "📊", label: "Request a credit evaluation" },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "#14171f" }}>
                    <span className="text-base">{step.done ? "✅" : step.icon}</span>
                    <span className={`text-sm ${step.done ? "text-green-400" : "text-gray-400"}`}>{step.label}</span>
                    {step.done && <span className="ml-auto text-green-400 text-xs font-semibold">Done</span>}
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-4 rounded-2xl text-white font-bold text-base"
              style={{ background: "linear-gradient(135deg, #0d9488, #059669)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }}
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
      <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Loan Application</p>
        <h1 className="text-2xl font-black text-white">Apply for Loan</h1>
      </div>

      <div className="px-5 space-y-4">
        {/* World App notice */}
        {!isInWorldApp && (
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-yellow-500/20"
            style={{ background: "rgba(234,179,8,0.05)" }}>
            <span className="text-lg">⚡</span>
            <p className="text-xs text-yellow-400">Submitting transactions requires World App</p>
          </div>
        )}

        {/* Tier + score card */}
        <div className="rounded-2xl border border-white/5 overflow-hidden" style={{ background: "#0d0d18" }}>
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Credit Tier</p>
              <span
                className="inline-block px-3 py-0.5 rounded-full text-xs font-bold tracking-widest"
                style={{ background: tier.bg, color: tier.color }}
              >
                {tier.label}
              </span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Score</p>
              <p className="text-2xl font-black text-white">{score}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Max Limit</p>
              <p className="text-2xl font-black text-white">${maxAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Amount selector */}
        <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#0d0d18" }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Loan Amount</p>
          <div className="text-center mb-5">
            <span className="text-5xl font-black text-white tracking-tight">${amount}</span>
            <span className="text-lg text-gray-400 ml-1">USDC</span>
          </div>
          <input
            type="range"
            min={1}
            max={Math.max(maxAmount, 1)}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>$1</span>
            <span>${Math.max(maxAmount, 1).toLocaleString()}</span>
          </div>
        </div>

        {/* Duration */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 px-1">Repayment Term</p>
          <div className="grid grid-cols-3 gap-2">
            {[2, 4, 8].map((w) => (
              <button
                key={w}
                onClick={() => setDurationWeeks(w)}
                className="py-3.5 rounded-2xl text-center font-semibold text-sm transition-all"
                style={
                  durationWeeks === w
                    ? { background: "rgba(13,148,136,0.2)", border: "1px solid #0d9488", color: "#2dd4bf" }
                    : { background: "#0d0d18", border: "1px solid rgba(255,255,255,0.05)", color: "#6b7280" }
                }
              >
                {w} wks
              </button>
            ))}
          </div>
        </div>

        {/* Loan breakdown */}
        <div className="rounded-2xl border border-white/5 p-5 space-y-3" style={{ background: "#0d0d18" }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Loan Summary</p>

          {[
            { label: "Interest Rate (APR)", value: `${apr}%` },
            { label: "Total Interest", value: `$${interest}` },
            { label: "Total Repayment", value: `$${total}`, bold: true },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{row.label}</span>
              <span className={`text-sm ${row.bold ? "text-white font-bold" : "text-gray-300"}`}>{row.value}</span>
            </div>
          ))}

          <div className="h-px bg-white/5 my-1" />

          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">4 installments of</span>
            <span className="text-base font-black" style={{ color: "#2dd4bf" }}>${installment}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Payment every</span>
            <span className="text-sm text-gray-300">{paymentDays} days</span>
          </div>
        </div>

        {/* Risk notice */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-yellow-500/10"
          style={{ background: "rgba(234,179,8,0.04)" }}>
          <span className="text-sm mt-0.5">⚠️</span>
          <p className="text-xs text-yellow-400/70 leading-relaxed">
            Defaulting reduces your credit score and affects future borrowing limits.
            Payments are due every {paymentDays} days.
          </p>
        </div>

        {/* Submit */}
        <button
          onClick={handleApply}
          disabled={applying || amount < 1 || amount > maxAmount}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={
            !applying && amount >= 1 && amount <= maxAmount
              ? { background: "linear-gradient(135deg, #0d9488, #059669)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }
              : { background: "#1a1f2e" }
          }
        >
          {applying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Confirming on-chain…
            </span>
          ) : `Confirm — $${amount} USDC`}
        </button>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
      </div>
    </div>
  );
}
