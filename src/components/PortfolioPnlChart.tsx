"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PnlSnapshot } from "@/app/actions/portfolio";

type Range = "24h" | "7d" | "30d" | "all";

const RANGES: { label: string; value: Range }[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "All", value: "all" },
];

function filterByRange(snapshots: PnlSnapshot[], range: Range): PnlSnapshot[] {
  if (range === "all") return snapshots;
  const now = Date.now();
  const cutoffs: Record<Range, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    all: 0,
  };
  const cutoff = now - cutoffs[range];
  return snapshots.filter((s) => new Date(s.date).getTime() >= cutoff);
}

function formatDate(dateStr: string, range: Range): string {
  const d = new Date(dateStr);
  if (range === "24h") {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value as number;
  const change = payload[0]?.payload?.change as number;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--muted)]">{label}</p>
      <p className="font-mono font-bold text-[var(--text)]">{value.toLocaleString()} coins</p>
      {change !== 0 && (
        <p className="font-mono" style={{ color: change >= 0 ? "#22c55e" : "#f97316" }}>
          {change >= 0 ? "+" : ""}
          {change.toLocaleString()} coins
        </p>
      )}
    </div>
  );
}

export function PortfolioPnlChart({ snapshots }: { snapshots: PnlSnapshot[] }) {
  const [range, setRange] = useState<Range>("all");

  const filtered = useMemo(() => filterByRange(snapshots, range), [snapshots, range]);

  const chartData = useMemo(() => {
    const baseValue = filtered[0]?.totalValue ?? 0;
    return filtered.map((s) => ({
      time: formatDate(s.date, range),
      value: s.totalValue,
      change: s.totalValue - baseValue,
    }));
  }, [filtered, range]);

  const first = filtered[0]?.totalValue ?? 0;
  const last = filtered[filtered.length - 1]?.totalValue ?? 0;
  const deltaColor = last >= first ? "#22c55e" : "#f97316";

  if (chartData.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">No portfolio history yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Range tabs */}
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className="rounded-lg px-3 py-1 text-xs font-semibold transition"
            style={
              range === r.value
                ? { background: "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)", color: "#fff" }
                : undefined
            }
          >
            <span className={range !== r.value ? "text-[var(--muted)] hover:text-[var(--text)]" : ""}>
              {r.label}
            </span>
          </button>
        ))}
      </div>

      {/* Delta summary */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold text-[var(--text)]">
          {last.toLocaleString()} coins
        </span>
        <span className="font-mono text-sm" style={{ color: deltaColor }}>
          {last - first >= 0 ? "+" : ""}
          {(last - first).toLocaleString()} (
          {first > 0 ? (((last - first) / first) * 100).toFixed(1) : "—"}%)
        </span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            {/* Horizontal stroke gradient: pink → purple */}
            <linearGradient id="pnlStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            {/* Vertical fill gradient: purple tint → transparent */}
            <linearGradient id="pnlFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
            width={55}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="url(#pnlStrokeGrad)"
            strokeWidth={2}
            fill="url(#pnlFillGrad)"
            isAnimationActive={false}
            dot={chartData.length <= 2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
