"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { id: "trending", label: "Trending", emoji: "🔥" },
  { id: "sports", label: "Sports" },
  { id: "politics", label: "Politics" },
  { id: "culture", label: "Culture" },
  { id: "crypto", label: "Crypto" },
  { id: "tech", label: "Tech" },
] as const;

export function Subheader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only show on homepage and /markets listing (not on individual market pages, portfolio, etc.)
  const isHomepage = pathname === "/";
  const isMarketsListing = pathname === "/markets";
  if (!isHomepage && !isMarketsListing) return null;

  const currentTab = searchParams.get("tab") || "trending";
  const basePath = isMarketsListing ? "/markets" : "/";

  return (
    <nav className="border-b border-[var(--border)] bg-[var(--bg)]/80">
      <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 py-2 scrollbar-hide">
        {TABS.map((tab) => {
          const href = basePath + (tab.id === "trending" ? "" : `?tab=${tab.id}`);
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--logo)]/20 text-[var(--logo)]"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--text)]"
              }`}
            >
              {tab.emoji && <span className="mr-1">{tab.emoji}</span>}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
