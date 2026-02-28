"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CreditScoreCard from "../components/CreditScoreCard";
import { API_URL } from "@/lib/contracts";
import { useWallet } from "@/lib/useWallet";

interface CreditProfile {
  score: number;
  lastUpdated: number;
  worldIdVerified: boolean;
  reclaimVerified: boolean;
  isEligible: boolean;
  maxLoanAmount: number;
  totalLoans: number;
  repaymentRate: number;
  outstandingDebt: number;
  defaultCount: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { address, hasWallet, isInWorldApp, connectWallet } = useWallet();
  const [profile, setProfile] = useState<CreditProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const fetchProfile = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`${API_URL}/api/credit/status/${addr}`);
      const data = await res.json();
      setProfile(data);
    } catch {
      setProfile({ score: 0, lastUpdated: 0, worldIdVerified: false, reclaimVerified: false,
        isEligible: false, maxLoanAmount: 0, totalLoans: 0, repaymentRate: 0, outstandingDebt: 0, defaultCount: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address !== "0x0000000000000000000000000000000000000000") {
      fetchProfile(address);
    } else if (!hasWallet) {
      setLoading(false);
    }
  }, [address, hasWallet, fetchProfile]);

  const handleConnectBank = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mono/auth-url`);
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch {
      alert("Failed to open bank connection");
    }
  };

  const handleTriggerEvaluation = async () => {
    setEvaluating(true);
    try {
      await fetch(`${API_URL}/api/credit/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, monoAccountId: "", worldIdVerified: profile?.worldIdVerified || false }),
      });
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchProfile(address);
        if (attempts >= 20) clearInterval(poll);
      }, 3000);
      setTimeout(() => { clearInterval(poll); setEvaluating(false); }, 60000);
    } catch {
      setEvaluating(false);
    }
  };

  if (!hasWallet && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "#06060f" }}>
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
            style={{ background: "linear-gradient(135deg, #0d9488, #059669)", boxShadow: "0 0 40px rgba(13,148,136,0.3)" }}>
            <span className="text-4xl">🌍</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-500 text-sm mb-8">Connect to view your on-chain credit profile</p>
          <button
            onClick={connectWallet}
            className="w-full py-4 rounded-2xl text-white font-bold text-base"
            style={{ background: "linear-gradient(135deg, #0d9488, #059669)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#06060f" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-teal-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  const hasDebt = (profile?.outstandingDebt || 0) > 0;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
      <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Your Profile</p>
            <h1 className="text-2xl font-black text-white">Dashboard</h1>
            <p className="text-xs text-gray-600 font-mono mt-1">
              {address.slice(0, 8)}…{address.slice(-6)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[10px] text-teal-400 font-medium">Base Sepolia</span>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* World App hint */}
        {!isInWorldApp && (
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-blue-500/20"
            style={{ background: "rgba(59,130,246,0.05)" }}>
            <span className="text-lg">📱</span>
            <p className="text-xs text-blue-400 leading-relaxed">
              Open in World App for gas-free transactions &amp; World ID verification
            </p>
          </div>
        )}

        {/* Score card */}
        <CreditScoreCard
          score={profile?.score || 0}
          maxLoanAmount={profile?.maxLoanAmount || 0}
          lastUpdated={profile?.lastUpdated || 0}
        />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: String(profile?.totalLoans || 0), label: "Loans", icon: "📋" },
            { value: `${profile?.repaymentRate || 0}%`, label: "Repayment", icon: "✅" },
            {
              value: profile?.worldIdVerified ? "World ID" : profile?.reclaimVerified ? "M-Pesa" : "None",
              label: "Verified",
              icon: profile?.worldIdVerified ? "🌐" : profile?.reclaimVerified ? "📱" : "❌",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-3 text-center border border-white/5" style={{ background: "#0d0d18" }}>
              <p className="text-lg mb-1">{s.icon}</p>
              <p className="text-sm font-bold text-white leading-tight">{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Evaluating */}
        {evaluating && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-teal-500/20"
            style={{ background: "rgba(13,148,136,0.07)" }}>
            <svg className="animate-spin w-5 h-5 text-teal-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <div>
              <p className="text-teal-400 text-sm font-semibold">Evaluating on Chainlink DON…</p>
              <p className="text-teal-400/50 text-xs mt-0.5">Up to 60 seconds</p>
            </div>
          </div>
        )}

        {/* Debt warning */}
        {hasDebt && (
          <button
            onClick={() => router.push("/repay")}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-red-500/20 text-left"
            style={{ background: "rgba(239,68,68,0.06)" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-red-400 text-sm font-semibold">Outstanding Debt</p>
                <p className="text-red-400/60 text-xs">${profile?.outstandingDebt?.toLocaleString()} USDC due</p>
              </div>
            </div>
            <span className="text-red-400 text-lg">›</span>
          </button>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-1">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest px-1">Actions</p>

          <button
            onClick={handleConnectBank}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/5 card-hover text-left"
            style={{ background: "#0d0d18" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: "#14171f" }}>🏦</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Connect Bank Account</p>
              <p className="text-xs text-gray-500 mt-0.5">50+ African banks via Mono.co</p>
            </div>
            <span className="text-gray-700 ml-auto text-xl shrink-0">›</span>
          </button>

          <button
            onClick={handleTriggerEvaluation}
            disabled={evaluating}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/5 card-hover text-left disabled:opacity-40"
            style={{ background: "#0d0d18" }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: "#14171f" }}>📊</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Request Credit Evaluation</p>
              <p className="text-xs text-gray-500 mt-0.5">Privately computed in Chainlink TEE</p>
            </div>
            <span className="text-gray-700 ml-auto text-xl shrink-0">›</span>
          </button>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => router.push("/apply")}
          disabled={!profile?.isEligible || hasDebt}
          className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          style={
            profile?.isEligible && !hasDebt
              ? { background: "linear-gradient(135deg, #0d9488, #059669)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }
              : { background: "#1a1f2e" }
          }
        >
          {hasDebt
            ? "Clear Debt to Apply"
            : !profile?.isEligible && (profile?.score || 0) > 0
            ? "Score 400+ Required to Borrow"
            : "Apply for a Loan →"}
        </button>
      </div>
      </div>
    </div>
  );
}
