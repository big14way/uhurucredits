"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import { ethers } from "ethers";
import { getActiveLoan, CONTRACTS, ERC20ContractABI, LoanManagerContractABI, switchToBaseSepolia } from "@/lib/contracts";
import { useWallet } from "@/lib/useWallet";

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
  const { address, isInWorldApp } = useWallet();
  const [loan, setLoan] = useState<LoanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState("");

  const fetchLoan = useCallback(async () => {
    try {
      const data = await getActiveLoan(address);
      setLoan(data);
    } catch {
      setLoan(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchLoan(); }, [fetchLoan]);

  useEffect(() => {
    if (!loan || loan.status !== 0) return;
    const update = () => {
      const diff = loan.nextPaymentDue - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setCountdown("OVERDUE"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setCountdown(`${d}d ${h}h ${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [loan]);

  const isOverdue = loan ? Math.floor(Date.now() / 1000) > loan.nextPaymentDue : false;
  const isRepaid = loan?.status === 1;
  const progress = loan ? (loan.installmentsPaid / loan.installmentsTotal) * 100 : 0;

  const handleRepay = async () => {
    if (!loan) return;
    setRepaying(true);
    setError("");
    try {
      if (isInWorldApp) {
        // World App: gas-free via MiniKit (approve + repay in sequence)
        await MiniKit.commandsAsync.sendTransaction({
          transaction: [{
            address: CONTRACTS.USDC as `0x${string}`,
            abi: ERC20ContractABI,
            functionName: "approve",
            args: [CONTRACTS.LOAN_MANAGER as `0x${string}`, BigInt(Math.ceil(loan.installmentAmount * 1e6))],
          }],
        });
        const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [{
            address: CONTRACTS.LOAN_MANAGER as `0x${string}`,
            abi: LoanManagerContractABI,
            functionName: "repayInstallment",
            args: [BigInt(loan.loanId)],
          }],
        });
        if (finalPayload.status === "success") {
          await fetchLoan();
        } else {
          setError("Transaction failed. Please try again.");
        }
      } else {
        // Browser: ethers.js direct tx via MetaMask
        await switchToBaseSepolia();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        const usdc = new ethers.Contract(CONTRACTS.USDC, ERC20ContractABI, signer);
        const approveTx = await usdc.approve(CONTRACTS.LOAN_MANAGER, BigInt(Math.ceil(loan.installmentAmount * 1e6)));
        await approveTx.wait();
        const loanManager = new ethers.Contract(CONTRACTS.LOAN_MANAGER, LoanManagerContractABI, signer);
        const repayTx = await loanManager.repayInstallment(BigInt(loan.loanId));
        await repayTx.wait();
        await fetchLoan();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setRepaying(false);
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

  if (!loan) {
    return (
      <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
        <div className="px-5 pt-12 pb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Repayment</p>
          <h1 className="text-2xl font-black text-white">My Loan</h1>
        </div>
        <div className="px-5">
          <div className="rounded-3xl border border-white/5 p-10 text-center" style={{ background: "#0d0d18" }}>
            <div className="text-5xl mb-4">💳</div>
            <p className="text-white font-bold text-lg mb-1">No Active Loan</p>
            <p className="text-gray-500 text-sm mb-8">You have no outstanding loans right now.</p>
            <button
              onClick={() => router.push("/apply")}
              className="px-8 py-3 rounded-2xl text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #0d9488, #059669)", boxShadow: "0 4px 20px rgba(13,148,136,0.3)" }}
            >
              Apply for a Loan
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isRepaid) {
    return (
      <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
        <div className="px-5 pt-12 pb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Repayment</p>
          <h1 className="text-2xl font-black text-white">My Loan</h1>
        </div>
        <div className="px-5">
          <div className="rounded-3xl border border-green-500/20 p-10 text-center" style={{ background: "rgba(16,185,129,0.05)" }}>
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-green-400 font-black text-2xl mb-1">Loan Complete!</p>
            <p className="text-green-400/60 text-sm mb-8">Your credit score has been updated.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-8 py-3 rounded-2xl font-bold text-sm"
              style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const remaining = +(loan.totalDue - loan.amountRepaid).toFixed(2);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
      <div className="max-w-md mx-auto">
      <div className="px-5 pt-12 pb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Repayment</p>
        <h1 className="text-2xl font-black text-white">My Loan</h1>
      </div>

      <div className="px-5 space-y-4">
        {!isInWorldApp && (
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-blue-500/20" style={{ background: "rgba(59,130,246,0.05)" }}>
            <span className="text-lg">🦊</span>
            <p className="text-xs text-blue-400">MetaMask detected — repayment will use Base Sepolia. Approve USDC + repay in 2 steps.</p>
          </div>
        )}

        {isOverdue && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30" style={{ background: "rgba(239,68,68,0.08)" }}>
            <span className="text-xl">🚨</span>
            <div>
              <p className="text-red-400 font-bold text-sm">Payment Overdue</p>
              <p className="text-red-400/60 text-xs mt-0.5">Pay now to avoid default</p>
            </div>
          </div>
        )}

        {/* Loan card with progress bar */}
        <div className="rounded-3xl border border-white/5 overflow-hidden" style={{ background: "#0d0d18" }}>
          <div className="h-1.5 w-full" style={{ background: "#1a1f2e" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${progress}%`,
                background: isOverdue ? "linear-gradient(90deg,#ef4444,#f87171)" : "linear-gradient(90deg,#0d9488,#10b981)",
              }}
            />
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Borrowed",  value: `$${loan.principal.toLocaleString()}`,      color: "text-white" },
                { label: "Total Due", value: `$${loan.totalDue.toLocaleString()}`,        color: "text-white" },
                { label: "Repaid",    value: `$${loan.amountRepaid.toLocaleString()}`,    color: "text-green-400" },
                { label: "Remaining", value: `$${remaining.toLocaleString()}`,            color: isOverdue ? "text-red-400" : "text-yellow-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl p-3" style={{ background: "#14171f" }}>
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className={`text-lg font-black ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Progress</span>
              <span className="text-gray-400 font-medium">{loan.installmentsPaid}/{loan.installmentsTotal} installments</span>
            </div>
          </div>
        </div>

        {/* Countdown */}
        <div className="rounded-2xl border border-white/5 p-5 text-center" style={{ background: "#0d0d18" }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Next Payment Due</p>
          <p className={`text-3xl font-black tracking-tight ${isOverdue ? "text-red-400" : "text-white"}`}>
            {countdown || "—"}
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Amount: <span className="text-white font-semibold">${loan.installmentAmount.toFixed(2)} USDC</span>
          </p>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-white/5 p-5" style={{ background: "#0d0d18" }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Payment Timeline</p>
          <div className="space-y-3">
            {Array.from({ length: loan.installmentsTotal }).map((_, i) => {
              const paid = i < loan.installmentsPaid;
              const current = i === loan.installmentsPaid && loan.status === 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: paid ? "rgba(16,185,129,0.15)" : current ? "rgba(13,148,136,0.15)" : "#14171f",
                      border: `1px solid ${paid ? "#10b981" : current ? "#0d9488" : "#1f2937"}`,
                    }}
                  >
                    {paid
                      ? <span className="text-xs text-green-400">✓</span>
                      : <span className="text-[10px]" style={{ color: current ? "#2dd4bf" : "#374151" }}>{i + 1}</span>
                    }
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className={`text-sm ${paid ? "text-gray-500" : current ? "text-white font-semibold" : "text-gray-600"}`}>
                      Installment {i + 1}
                    </span>
                    <span className={`text-sm font-semibold ${paid ? "text-green-400" : current ? "text-teal-400" : "text-gray-700"}`}>
                      {paid ? `$${loan.installmentAmount.toFixed(2)}` : current ? `$${loan.installmentAmount.toFixed(2)}` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pay CTA */}
        {loan.status === 0 && loan.installmentsPaid < loan.installmentsTotal && (
          <button
            onClick={handleRepay}
            disabled={repaying}
            className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-40"
            style={
              isOverdue
                ? { background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 24px rgba(239,68,68,0.35)" }
                : { background: "linear-gradient(135deg,#0d9488,#059669)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }
            }
          >
            {repaying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processing…
              </span>
            ) : `Pay $${loan.installmentAmount.toFixed(2)} USDC`}
          </button>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
      </div>
    </div>
  );
}
