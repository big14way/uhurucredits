"use client";

import { useTxHistory, TxRecord } from "@/lib/useTxHistory";

const EXPLORER = "https://sepolia.basescan.org/tx";

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function TxCard({ tx }: { tx: TxRecord }) {
  const isLoan = tx.type === "loan_applied";

  const config = isLoan
    ? { label: "Loan Disbursed", icon: "💳", color: "#2dd4bf", bg: "rgba(13,148,136,0.12)", border: "rgba(13,148,136,0.2)" }
    : { label: "Installment Paid", icon: "💰", color: "#34d399", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" };

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: "#0d0d18", border: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: config.bg, border: `1px solid ${config.border}` }}
      >
        {config.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-semibold text-white">{config.label}</span>
          <span className="text-sm font-bold" style={{ color: config.color }}>
            ${tx.amount.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <a
            href={`${EXPLORER}/${tx.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: "#4b5563" }}
          >
            <span className="font-mono">{shortHash(tx.txHash)}</span>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 1.5h7m0 0v7m0-7L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
          <span className="text-[10px] text-gray-600">{timeAgo(tx.timestamp)}</span>
        </div>
        {tx.installmentNum !== undefined && (
          <p className="text-[10px] text-gray-600 mt-0.5">Installment {tx.installmentNum}</p>
        )}
      </div>
    </div>
  );
}

export default function History() {
  const { history } = useTxHistory();

  return (
    <div className="min-h-screen pb-24" style={{ background: "#06060f" }}>
      <div className="max-w-md mx-auto">
        <div className="px-5 pt-12 pb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">On-Chain Activity</p>
          <h1 className="text-2xl font-black text-white">Transaction History</h1>
        </div>

        <div className="px-5">
          {history.length === 0 ? (
            <div
              className="rounded-3xl border border-white/5 p-12 text-center"
              style={{ background: "#0d0d18" }}
            >
              <div className="text-5xl mb-4">📋</div>
              <p className="text-white font-bold text-lg mb-1">No Transactions Yet</p>
              <p className="text-gray-500 text-sm">Your loan and repayment transactions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => (
                <TxCard key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <p className="text-center text-gray-700 text-xs mt-6">
            All transactions on{" "}
            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-400 underline"
            >
              Base Sepolia
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
