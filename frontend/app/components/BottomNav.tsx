"use client";

import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/",          label: "Home",      icon: "🌍" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/apply",     label: "Apply",     icon: "💳" },
  { href: "/repay",     label: "Repay",     icon: "💰" },
  { href: "/history",   label: "History",   icon: "📋" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5"
      style={{ background: "rgba(6, 6, 15, 0.92)", backdropFilter: "blur(20px)" }}
    >
      <div className="max-w-md mx-auto flex h-16 relative">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-all"
            >
              {/* Active pill indicator */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
                  style={{ background: "linear-gradient(90deg, #14b8a6, #10b981)" }}
                />
              )}
              <span className={`text-xl transition-all ${active ? "scale-110" : "opacity-40 scale-100"}`}>
                {item.icon}
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide transition-colors ${
                  active ? "text-teal-400" : "text-gray-600"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
