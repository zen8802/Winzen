"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { getMarketSnapshots } from "@/app/actions/charts";
import type { SnapshotRow, BetPosition } from "@/app/actions/charts";

// Matches src/lib/outcome-colors.ts palette exactly
const COLORS = ["#22c55e", "#3b82f6", "#eab308", "#a855f7", "#f97316"];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

type Outcome = { id: string; label: string; order: number };
type ChartPoint = { time: string; [outcomeId: string]: number | string };

function transformSnapshots(snapshots: SnapshotRow[]): ChartPoint[] {
  const grouped = new Map<string, ChartPoint>();
  for (const snap of snapshots) {
    if (!grouped.has(snap.recordedAt)) {
      grouped.set(snap.recordedAt, { time: snap.recordedAt });
    }
    const point = grouped.get(snap.recordedAt)!;
    // Convert 0.0–1.0 to 0–100, rounded to 1 decimal
    point[snap.outcomeId] = Math.round(snap.probability * 1000) / 10;
  }
  return Array.from(grouped.values());
}

type Props = {
  marketId: string;
  outcomes: Outcome[];
  initialSnapshots: SnapshotRow[];
  userPosition: BetPosition;
  marketClosed: boolean;
};

export function ProbabilityChart({
  marketId,
  outcomes,
  initialSnapshots,
  userPosition,
  marketClosed,
}: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>(initialSnapshots);

  const fetchSnapshots = useCallback(async () => {
    const fresh = await getMarketSnapshots(marketId);
    setSnapshots(fresh);
  }, [marketId]);

  useEffect(() => {
    if (marketClosed) return;
    const interval = setInterval(fetchSnapshots, 3_000);
    return () => clearInterval(interval);
  }, [fetchSnapshots, marketClosed]);

  const chartData = transformSnapshots(snapshots);

  // ─── Activity signals ────────────────────────────────────────────────────
  const isMoving = (() => {
    const sixtySecondsAgo = Date.now() - 60_000;
    const recentTimestamps = new Set(
      snapshots
        .filter((s) => new Date(s.recordedAt).getTime() > sixtySecondsAgo)
        .map((s) => s.recordedAt)
    );
    // Subtract 1 for the initial creation snapshot
    return recentTimestamps.size > 1 && recentTimestamps.size - 1 >= 3;
  })();

  const hasSpike = (() => {
    if (chartData.length < 2) return false;
    const prev = chartData[chartData.length - 2];
    const last = chartData[chartData.length - 1];
    return outcomes.some((o) => {
      const prevVal = prev[o.id] as number | undefined;
      const lastVal = last[o.id] as number | undefined;
      if (prevVal === undefined || lastVal === undefined) return false;
      return Math.abs(lastVal - prevVal) > 5;
    });
  })();

  // ─── User position overlay ───────────────────────────────────────────────
  const entryPoint =
    userPosition && chartData.length > 0
      ? chartData.reduce((best, point) => {
          const diff = Math.abs(
            new Date(point.time).getTime() - new Date(userPosition.entryTimestamp).getTime()
          );
          const bestDiff = Math.abs(
            new Date(best.time).getTime() - new Date(userPosition.entryTimestamp).getTime()
          );
          return diff < bestDiff ? point : best;
        }, chartData[0])
      : null;

  const userOutcomeIndex = userPosition
    ? outcomes.findIndex((o) => o.id === userPosition.outcomeId)
    : -1;

  // ─── Fallback ────────────────────────────────────────────────────────────
  if (chartData.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
        No probability history yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isMoving && (
        <p className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
          Market moving fast
        </p>
      )}
      {!isMoving && hasSpike && (
        <p className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-400">
          Significant probability shift
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {outcomes.map((o, i) => (
          <div key={o.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded-full"
              style={{ backgroundColor: getColor(i) }}
            />
            <span className="text-xs text-[var(--muted)]">{o.label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="time"
            tickFormatter={(val: string) =>
              new Date(val).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
            tick={{ fontSize: 10, fill: "#8b9cb3" }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: "#8b9cb3" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-xl">
                  <p className="mb-1.5 text-[var(--muted)]">
                    {new Date(label as string).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {payload.map((entry) => {
                    const outcome = outcomes.find((o) => o.id === entry.dataKey);
                    return (
                      <p key={entry.dataKey as string} style={{ color: entry.color as string }}>
                        {outcome?.label ?? entry.dataKey}: {entry.value}%
                      </p>
                    );
                  })}
                </div>
              );
            }}
          />
          {outcomes.map((outcome, i) => (
            <Line
              key={outcome.id}
              type="monotone"
              dataKey={outcome.id}
              stroke={getColor(i)}
              strokeWidth={2}
              dot={chartData.length <= 1}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
          {userPosition && entryPoint && userOutcomeIndex >= 0 && (
            <ReferenceDot
              x={entryPoint.time}
              y={Math.round(userPosition.entryProbability * 1000) / 10}
              r={5}
              fill={getColor(userOutcomeIndex)}
              stroke="#0c0f14"
              strokeWidth={2}
              label={{
                value: `You: ${Math.round(userPosition.entryProbability * 100)}%`,
                position: "top",
                fontSize: 10,
                fill: "#8b9cb3",
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
