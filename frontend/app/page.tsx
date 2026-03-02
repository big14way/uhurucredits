"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { API_URL } from "@/lib/contracts";
import { useWallet } from "@/lib/useWallet";

export default function Home() {
  const router = useRouter();
  const { address, isInWorldApp, hasWallet, connectWallet } = useWallet();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleWorldIDVerify = async () => {
    const installed = (() => { try { return MiniKit.isInstalled(); } catch { return false; } })();
    if (!installed) {
      setError("Please open this app in World App");
      return;
    }
    setIsVerifying(true);
    setError("");
    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: "verify-credit",
        verification_level: VerificationLevel.Device,
      });
      if (finalPayload.status === "success") {
        await fetch(`${API_URL}/api/verify/worldid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...finalPayload, walletAddress: address }),
        });
        router.push("/dashboard");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConnectWallet = () => {
    connectWallet();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "#06060f" }}>
      {/* Ambient background blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #0d9488 0%, transparent 70%)" }} />
      <div className="absolute bottom-24 right-0 w-64 h-64 rounded-full blur-3xl opacity-8 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, #7c3aed 0%, transparent 70%)" }} />

      <div className="relative max-w-md mx-auto px-5 pt-16 pb-24">
        {/* Brand */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-5"
            style={{ background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", boxShadow: "0 0 40px rgba(13,148,136,0.35)" }}>
            <span className="text-4xl">🌍</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Uhuru Credit</h1>
          <p className="mt-2 text-gray-400 text-base">Credit for 1 Billion Africans</p>
          <p className="mt-1 text-gray-600 text-sm">Uncollateralized · Privacy-First · On-Chain</p>
        </div>

        {/* World App banner for browser users */}
        {!isInWorldApp && !hasWallet && (
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-blue-500/20 mb-6"
            style={{ background: "rgba(59,130,246,0.05)" }}>
            <span className="text-xl mt-0.5">📱</span>
            <div>
              <p className="text-blue-300 font-semibold text-sm">World ID requires World App</p>
              <p className="text-blue-400/60 text-xs mt-1 leading-relaxed">
                Download the <span className="text-blue-300 font-medium">World App</span> on your phone to verify your identity and get gas-free transactions. You can still connect a browser wallet below to explore.
              </p>
            </div>
          </div>
        )}

        {/* Feature list */}
        <div className="space-y-3 mb-10">
          {[
            { icon: "🔒", title: "Privacy-First Scoring", sub: "Chainlink CRE TEE — data never leaves the enclave" },
            { icon: "🏦", title: "African Banking Data", sub: "50+ banks in Nigeria, Ghana, Kenya via Mono.co" },
            { icon: "🌍", title: "World ID Verified", sub: "One person, one account — device-level proof of humanity" },
          ].map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 card-hover"
              style={{ background: "#0d0d18" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: "#14171f" }}>
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        {isInWorldApp ? (
          <button
            onClick={handleWorldIDVerify}
            disabled={isVerifying}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg disabled:opacity-50 transition-all"
            style={{ background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", boxShadow: "0 4px 24px rgba(13,148,136,0.35)" }}
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Verifying...
              </span>
            ) : "Verify with World ID"}
          </button>
        ) : hasWallet ? (
          <>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all"
              style={{ background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }}
            >
              Go to Dashboard →
            </button>
            <p className="text-center text-gray-600 text-xs mt-3">
              For World ID verification, open in World App
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleConnectWallet}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all"
              style={{ background: "linear-gradient(135deg, #0d9488 0%, #059669 100%)", boxShadow: "0 4px 24px rgba(13,148,136,0.3)" }}
            >
              Connect Wallet
            </button>
            <p className="text-center text-gray-600 text-xs mt-3">
              For World ID verification, open in World App
            </p>
          </>
        )}

        {error && (
          <p className="mt-4 text-red-400 text-sm text-center">{error}</p>
        )}

        {/* Steps strip */}
        <div className="mt-12 flex items-center">
          {["Verify", "Connect Bank", "Get Score", "Borrow"].map((step, i, arr) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-700">
                  {i + 1}
                </div>
                <span className="text-[9px] text-gray-600 whitespace-nowrap">{step}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px mx-1 bg-gray-800" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
