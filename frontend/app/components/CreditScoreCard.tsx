"use client";

import { useEffect, useRef } from "react";

interface Props {
  score: number;
  maxLoanAmount: number;
  lastUpdated: number;
}

const R = 88;
const CX = 110;
const CY = 108;
const CIRC = Math.PI * R;

function getTier(score: number) {
  if (score === 0)  return { label: "NO SCORE", color: "#6b7280", from: "#374151", to: "#4b5563" };
  if (score >= 850) return { label: "PREMIUM",  color: "#2dd4bf", from: "#0d9488", to: "#10b981" };
  if (score >= 700) return { label: "PRIME",    color: "#34d399", from: "#10b981", to: "#6ee7b7" };
  if (score >= 550) return { label: "STANDARD", color: "#fbbf24", from: "#f59e0b", to: "#fcd34d" };
  if (score >= 400) return { label: "MICRO",    color: "#fb923c", from: "#f97316", to: "#fdba74" };
  return               { label: "BUILDING", color: "#f87171", from: "#ef4444", to: "#fca5a5" };
}

function timeAgo(ts: number) {
  if (!ts) return "Not scored yet";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)    return "Just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function CreditScoreCard({ score, maxLoanAmount, lastUpdated }: Props) {
  const arcRef = useRef<SVGPathElement>(null);
  const tier = getTier(score);
  const targetOffset = CIRC * (1 - Math.min(score, 1000) / 1000);
  const bgArcPath = `M ${CX - R} ${CY} A ${R} ${R} 0 1 1 ${CX + R} ${CY}`;
  const gradId = `sg${score}`;

  useEffect(() => {
    const el = arcRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.strokeDashoffset = String(CIRC);
    el.getBoundingClientRect();
    el.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.strokeDashoffset = String(targetOffset);
  }, [score, targetOffset]);

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-white/5"
      style={{ background: "linear-gradient(160deg, #0f1117 0%, #080810 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-6 w-52 h-20 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: `radial-gradient(ellipse, ${tier.from} 0%, transparent 70%)` }}
      />

      <div className="relative flex flex-col items-center pt-6 pb-5 px-6">
        <svg width="220" height="130" viewBox="0 0 220 130" className="overflow-visible">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={tier.from} />
              <stop offset="100%" stopColor={tier.to} />
            </linearGradient>
            <filter id="arc-glow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path d={bgArcPath} fill="none" stroke="#1a1f2e" strokeWidth="12" strokeLinecap="round" />

          {/* Animated score arc */}
          {score > 0 && (
            <path
              ref={arcRef}
              d={bgArcPath}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC}
              filter="url(#arc-glow)"
            />
          )}

          {/* Score number */}
          <text
            x={CX} y={CY - 6}
            textAnchor="middle" fill="white"
            fontSize="48" fontWeight="800"
            style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-2px" }}
          >
            {score}
          </text>
          <text x={CX} y={CY + 16} textAnchor="middle" fill="#4b5563" fontSize="11">
            out of 1000
          </text>
        </svg>

        {/* Tier badge */}
        <div
          className="px-4 py-1 rounded-full text-[11px] font-bold tracking-widest mt-1"
          style={{ background: `${tier.from}28`, color: tier.color }}
        >
          {tier.label}
        </div>

        <div className="w-full h-px bg-white/5 my-4" />

        {/* Credit limit row */}
        <div className="w-full flex items-end justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Credit Limit</p>
            <p className="text-2xl font-black text-white leading-none">
              {maxLoanAmount > 0 ? `$${maxLoanAmount.toLocaleString()}` : "—"}
              {maxLoanAmount > 0 && (
                <span className="text-sm font-normal text-gray-400 ml-1">USDC</span>
              )}
            </p>
          </div>
          <p className="text-xs text-gray-600 pb-0.5">{timeAgo(lastUpdated)}</p>
        </div>
      </div>
    </div>
  );
}
