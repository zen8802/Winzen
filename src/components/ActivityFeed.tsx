"use client";

import { useEffect, useState } from "react";
import { getRecentActivity, ActivityItem } from "@/app/actions/activity";
import { CoinIcon } from "@/components/CoinIcon";

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getRecentActivity();
      setItems(data);
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (items.length === 0) return null;

  return (
    // Fixed overlay — completely outside document flow, never affects layout
    <div
      className="pointer-events-none fixed right-5 top-20 hidden select-none xl:block"
      style={{ width: 160, overflow: "hidden" }}
      aria-hidden="true"
    >
      <div className="relative pb-12">
        <ul className="space-y-3">
          {items.slice(0, 5).map((item, idx) => {
            // Gentle fade: newest = 0.65, oldest = ~0.15
            const agingOpacity = Math.max(0.1, 0.65 - idx * 0.13);
            // Truncate name to 10 chars so the gradient ellipsis is visible
            const rawName = item.username ?? "Someone";
            const displayName = rawName.length > 10 ? rawName.slice(0, 9) + "…" : rawName;

            return (
              <li key={item.id} style={{ opacity: agingOpacity }}>
                <div
                  style={{
                    animation: `activityFadeIn 0.45s ease ${Math.min(idx * 25, 200)}ms both`,
                  }}
                >
                  {item.type === "TRADE" ? (
                    <div className="text-[10px] font-medium leading-snug">
                      {/* Name on its own line — always fits */}
                      <p
                        style={{
                          background: "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {displayName}
                      </p>
                      {/* Compact trade summary */}
                      <p className="inline-flex items-center gap-0.5 mt-px">
                        <CoinIcon size={8} />
                        <span style={{ color: "var(--muted)" }}>
                          {item.amount?.toLocaleString()}
                        </span>
                        <span style={{ color: "var(--muted)" }}> · </span>
                        <span style={{ color: item.side === "YES" ? "#22c55e" : "#60a5fa" }}>
                          {item.side} @ {item.price?.toFixed(0)}%
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] font-medium leading-snug" style={{ color: "var(--muted)" }}>
                      Resolved →{" "}
                      <span style={{ color: item.side === "YES" ? "#22c55e" : "#60a5fa" }}>
                        {item.side}
                      </span>
                    </p>
                  )}
                  <p
                    className="mt-px truncate text-[9px] leading-snug"
                    style={{ color: "var(--muted)" }}
                  >
                    {item.marketTitle}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Soft fade — items dissolve into page background */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0"
          style={{
            height: 56,
            background: "linear-gradient(to bottom, transparent, var(--bg))",
          }}
        />
      </div>
    </div>
  );
}
