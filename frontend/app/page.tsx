"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { API_URL } from "@/lib/contracts";

const steps = [
  { label: "Verify Identity", icon: "1" },
  { label: "Connect Bank", icon: "2" },
  { label: "Get Score", icon: "3" },
  { label: "Borrow", icon: "4" },
];

export default function Home() {
  const router = useRouter();
  const [isInWorldApp, setIsInWorldApp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsInWorldApp(MiniKit.isInstalled());
  }, []);

  const handleWorldIDVerify = async () => {
    if (!MiniKit.isInstalled()) {
      setError("Please open this app in World App");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: "verify-credit",
        verification_level: VerificationLevel.Orb,
      });

      if (finalPayload.status === "success") {
        await fetch(`${API_URL}/api/verify/worldid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        });
        router.push("/dashboard");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">&#127757;</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
            Uhuru Credit
          </h1>
          <p className="mt-3 text-gray-400 text-lg">
            Credit for 1 Billion Africans
          </p>
          <p className="mt-1 text-gray-500 text-sm">
            No Bank Account Required
          </p>
        </div>

        {/* Not in World App banner */}
        {!isInWorldApp && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
            <p className="text-yellow-400 text-sm font-medium">
              Please open in World App for the best experience
            </p>
            <p className="text-yellow-400/60 text-xs mt-1">
              MiniKit features require World App
            </p>
          </div>
        )}

        {/* Features */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
            <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center text-teal-400">&#128274;</div>
            <div>
              <p className="text-sm font-medium">Privacy-First Scoring</p>
              <p className="text-xs text-gray-400">Chainlink CRE TEE protects your data</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-400">&#127974;</div>
            <div>
              <p className="text-sm font-medium">African Banking Data</p>
              <p className="text-xs text-gray-400">50+ Nigerian banks, Ghana, Kenya via Mono</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400">&#128241;</div>
            <div>
              <p className="text-sm font-medium">M-Pesa Integration</p>
              <p className="text-xs text-gray-400">Reclaim zkTLS for mobile money data</p>
            </div>
          </div>
        </div>

        {/* Verify Button */}
        <button
          onClick={handleWorldIDVerify}
          disabled={isVerifying}
          className="w-full py-4 bg-gradient-to-r from-teal-500 to-green-500 text-white font-bold rounded-xl text-lg transition-all hover:from-teal-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isVerifying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">&#9696;</span> Verifying...
            </span>
          ) : (
            "Verify with World ID"
          )}
        </button>

        {/* Skip to dashboard for development */}
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full mt-3 py-3 bg-gray-800 text-gray-300 font-medium rounded-xl text-sm hover:bg-gray-700 transition-colors"
        >
          Continue to Dashboard
        </button>

        {error && (
          <p className="mt-3 text-red-400 text-sm text-center">{error}</p>
        )}

        {/* Steps */}
        <div className="mt-10 flex justify-between">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs text-gray-400">
                {step.icon}
              </div>
              <span className="text-[10px] text-gray-500">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
