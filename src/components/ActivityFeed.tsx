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
      style={{ width: 176, maxHeight: "calc(100vh - 100px)", overflow: "hidden" }}
      aria-hidden="true"
    >
      {/* Padding-bottom reserves room so items don't poke through the fade */}
      <div className="relative pb-20">
        <ul className="space-y-4">
          {items.slice(0, 18).map((item, idx) => {
            // Items get progressively less visible as they age down the list
            const agingOpacity = Math.max(0.08, 0.55 - idx * 0.035);

            return (
              // Outer li controls age-based opacity
              <li key={item.id} style={{ opacity: agingOpacity }}>
                {/* Inner div carries the entrance animation — opacity multiplies */}
                <div
                  style={{
                    animation: `activityFadeIn 0.45s ease ${Math.min(idx * 25, 300)}ms both`,
                  }}
                >
                  {item.type === "TRADE" ? (
                    <div className="flex items-center gap-1 overflow-hidden text-[11px] font-medium leading-snug">
                      <span
                        className="shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {item.username ?? "Someone"}
                      </span>
                      <span className="shrink-0" style={{ color: "var(--muted)" }}>bet</span>
                      <CoinIcon size={9} />
                      <span className="shrink-0" style={{ color: "var(--muted)" }}>
                        {item.amount?.toLocaleString()}
                      </span>
                      <span className="shrink-0" style={{ color: "var(--muted)" }}>on</span>
                      <span
                        className="shrink-0"
                        style={{ color: item.side === "YES" ? "#22c55e" : "#60a5fa" }}
                      >
                        {item.side} @ {item.price?.toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <p className="text-[11px] font-medium leading-snug" style={{ color: "var(--muted)" }}>
                      Resolved →{" "}
                      <span style={{ color: item.side === "YES" ? "#22c55e" : "#60a5fa" }}>
                        {item.side}
                      </span>
                    </p>
                  )}
                  <p
                    className="mt-0.5 truncate text-[10px] leading-snug"
                    style={{ color: "var(--muted)" }}
                  >
                    {item.marketTitle}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Soft fade — items dissolve into the page background */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0"
          style={{
            height: 96,
            background: "linear-gradient(to bottom, transparent, var(--bg))",
          }}
        />
      </div>
    </div>
  );
}
