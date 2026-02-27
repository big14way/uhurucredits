"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MiniKit } from "@worldcoin/minikit-js";
import CreditScoreCard from "../components/CreditScoreCard";
import { API_URL } from "@/lib/contracts";

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
  const [profile, setProfile] = useState<CreditProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const fetchProfile = useCallback(async (address: string) => {
    try {
      const res = await fetch(`${API_URL}/api/credit/status/${address}`);
      const data = await res.json();
      setProfile(data);
    } catch {
      setProfile({
        score: 0, lastUpdated: 0, worldIdVerified: false, reclaimVerified: false,
        isEligible: false, maxLoanAmount: 0, totalLoans: 0, repaymentRate: 0,
        outstandingDebt: 0, defaultCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const address = MiniKit.isInstalled()
      ? MiniKit.user?.walletAddress || "0x0000000000000000000000000000000000000000"
      : "0x0000000000000000000000000000000000000000";
    setWalletAddress(address);
    fetchProfile(address);
  }, [fetchProfile]);

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
        body: JSON.stringify({
          walletAddress,
          monoAccountId: "",
          worldIdVerified: profile?.worldIdVerified || false,
        }),
      });

      // Poll for score update
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchProfile(walletAddress);
        if (attempts >= 20) clearInterval(poll);
      }, 3000);

      setTimeout(() => {
        clearInterval(poll);
        setEvaluating(false);
      }, 60000);
    } catch {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-teal-400 text-lg">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-xs text-gray-500 font-mono">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </p>
          </div>
          <div className="text-3xl">&#127757;</div>
        </div>

        {/* Credit Score Card */}
        <CreditScoreCard
          score={profile?.score || 0}
          maxLoanAmount={profile?.maxLoanAmount || 0}
          lastUpdated={profile?.lastUpdated || 0}
        />

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
            <p className="text-lg font-bold text-white">{profile?.totalLoans || 0}</p>
            <p className="text-xs text-gray-400">Total Loans</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
            <p className="text-lg font-bold text-white">{profile?.repaymentRate || 0}%</p>
            <p className="text-xs text-gray-400">Repayment</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
            <div className="flex justify-center gap-1 text-sm">
              <span>{profile?.worldIdVerified ? "&#9989;" : "&#10060;"}</span>
              <span>{profile?.reclaimVerified ? "&#9989;" : "&#10060;"}</span>
            </div>
            <p className="text-xs text-gray-400">Verified</p>
          </div>
        </div>

        {/* Evaluating State */}
        {evaluating && (
          <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl text-center">
            <div className="animate-pulse">
              <p className="text-teal-400 font-medium">Evaluating your credit on Chainlink DON...</p>
              <p className="text-teal-400/60 text-xs mt-1">This may take up to 60 seconds</p>
            </div>
          </div>
        )}

        {/* Outstanding Debt Warning */}
        {(profile?.outstandingDebt || 0) > 0 && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm font-medium">
              Outstanding debt: ${profile?.outstandingDebt?.toLocaleString()} USDC
            </p>
            <button
              onClick={() => router.push("/repay")}
              className="mt-2 w-full py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              Go to Repayment
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleConnectBank}
            className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <span>&#127974;</span> Connect Bank Account
          </button>

          <button
            onClick={handleTriggerEvaluation}
            disabled={evaluating}
            className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span>&#128200;</span> Request Credit Evaluation
          </button>

          <button
            onClick={() => router.push("/apply")}
            disabled={!profile?.isEligible || (profile?.outstandingDebt || 0) > 0}
            className="w-full py-4 bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold rounded-xl text-lg transition-all hover:from-teal-600 hover:to-green-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Apply for Loan
          </button>

          {!profile?.isEligible && (profile?.score || 0) > 0 && (
            <p className="text-center text-gray-500 text-xs">
              {(profile?.score || 0) < 400
                ? "Score must be 400+ to apply for a loan"
                : "Clear outstanding debt to apply"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
