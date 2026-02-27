"use client";

interface CreditScoreCardProps {
  score: number;
  maxLoanAmount: number;
  lastUpdated: number;
}

function getScoreColor(score: number): string {
  if (score >= 850) return "#14b8a6"; // teal
  if (score >= 700) return "#22c55e"; // green
  if (score >= 550) return "#eab308"; // yellow
  if (score >= 400) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getTierLabel(score: number): string {
  if (score === 0) return "NO SCORE";
  if (score >= 850) return "PREMIUM";
  if (score >= 700) return "PRIME";
  if (score >= 550) return "STANDARD";
  if (score >= 400) return "MICRO";
  return "NO SCORE";
}

function getTierBgColor(score: number): string {
  if (score >= 850) return "bg-teal-500/20 text-teal-400";
  if (score >= 700) return "bg-green-500/20 text-green-400";
  if (score >= 550) return "bg-yellow-500/20 text-yellow-400";
  if (score >= 400) return "bg-orange-500/20 text-orange-400";
  return "bg-red-500/20 text-red-400";
}

function timeAgo(timestamp: number): string {
  if (timestamp === 0) return "Never";
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function CreditScoreCard({ score, maxLoanAmount, lastUpdated }: CreditScoreCardProps) {
  const color = getScoreColor(score);
  const tier = getTierLabel(score);
  const tierBg = getTierBgColor(score);
  const angle = (score / 1000) * 180;

  // SVG arc gauge
  const radius = 80;
  const cx = 100;
  const cy = 100;
  const startAngle = -180;
  const endAngle = startAngle + angle;

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const largeArc = angle > 180 ? 1 : 0;

  const arcPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  const bgArcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex flex-col items-center">
        <svg width="200" height="120" viewBox="0 0 200 120">
          {/* Background arc */}
          <path d={bgArcPath} fill="none" stroke="#374151" strokeWidth="12" strokeLinecap="round" />
          {/* Score arc */}
          {score > 0 && (
            <path d={arcPath} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
          )}
          {/* Score text */}
          <text x="100" y="90" textAnchor="middle" fill="white" fontSize="36" fontWeight="bold">
            {score}
          </text>
          <text x="100" y="110" textAnchor="middle" fill="#9ca3af" fontSize="12">
            out of 1000
          </text>
        </svg>

        <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${tierBg}`}>
          {tier}
        </span>

        <div className="mt-4 text-center">
          <p className="text-gray-400 text-sm">Max Loan Amount</p>
          <p className="text-2xl font-bold text-white">${maxLoanAmount.toLocaleString()} USDC</p>
        </div>

        <p className="mt-2 text-gray-500 text-xs">Last updated: {timeAgo(lastUpdated)}</p>
      </div>
    </div>
  );
}
