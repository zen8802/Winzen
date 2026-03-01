"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
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
import type { SnapshotRow, BetPosition, BetPositionEntry } from "@/app/actions/charts";
import type { FollowedTrade } from "@/app/actions/social";
import { baseUrl, LAYER_ORDER } from "@/lib/avatar";
import type { AvatarEquipped, AvatarCategory } from "@/lib/avatar";

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
  userEquipped?: AvatarEquipped;
  userName?: string;
  followedTrades?: FollowedTrade[];
};

// Extracted tooltip so Recharts gets a stable component reference
const ChartTooltip = memo(function ChartTooltip({
  active,
  payload,
  label,
  outcomes,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active?: boolean; payload?: any[]; label?: string; outcomes: Outcome[];
}) {
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
});

// ─── Avatar chip rendered inside SVG via shape prop ─────────────────────────

type HoveredEntry = { kind: "own"; i: number; cx: number; cy: number }
                  | { kind: "followed"; i: number; cx: number; cy: number };

function AvatarChip({
  cx,
  cy,
  r = 14,
  equipped,
  borderColor,
  clipId,
  onMouseEnter,
  onMouseLeave,
}: {
  cx: number;
  cy: number;
  r?: number;
  equipped: AvatarEquipped;
  borderColor: string;
  clipId: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* Base avatar */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <image
        href={baseUrl()}
        x={cx - r} y={cy - r}
        width={r * 2} height={r * 2}
        clipPath={`url(#${clipId})`}
      />
      {/* Equipped layers */}
      {LAYER_ORDER
        .filter((layer) => layer !== "base" && equipped[layer as AvatarCategory])
        .map((layer) => (
          <image
            key={layer}
            href={equipped[layer as AvatarCategory]!}
            x={cx - r} y={cy - r}
            width={r * 2} height={r * 2}
            clipPath={`url(#${clipId})`}
          />
        ))
      }
      {/* Border ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={borderColor} strokeWidth={2} />
      {/* Invisible hover target */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="transparent"
        style={{ cursor: "pointer" }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </g>
  );
}

export function ProbabilityChart({
  marketId,
  outcomes,
  initialSnapshots,
  userPosition,
  marketClosed,
  userEquipped = {},
  userName,
  followedTrades = [],
}: Props) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>(initialSnapshots);
  const [showFollowed, setShowFollowed] = useState(false);
  const [hovered, setHovered] = useState<HoveredEntry | null>(null);

  const fetchSnapshots = useCallback(async () => {
    const fresh = await getMarketSnapshots(marketId);
    setSnapshots(fresh);
  }, [marketId]);

  useEffect(() => {
    if (marketClosed) return;
    const interval = setInterval(fetchSnapshots, 3_000);
    return () => clearInterval(interval);
  }, [fetchSnapshots, marketClosed]);

  // ─── Memoized derived data ────────────────────────────────────────────────
  const chartData = useMemo(() => transformSnapshots(snapshots), [snapshots]);

  const isMoving = useMemo(() => {
    const sixtySecondsAgo = Date.now() - 60_000;
    const recentTimestamps = new Set(
      snapshots
        .filter((s) => new Date(s.recordedAt).getTime() > sixtySecondsAgo)
        .map((s) => s.recordedAt)
    );
    return recentTimestamps.size > 1 && recentTimestamps.size - 1 >= 3;
  }, [snapshots]);

  const hasSpike = useMemo(() => {
    if (chartData.length < 2) return false;
    const prev = chartData[chartData.length - 2];
    const last = chartData[chartData.length - 1];
    return outcomes.some((o) => {
      const prevVal = prev[o.id] as number | undefined;
      const lastVal = last[o.id] as number | undefined;
      if (prevVal === undefined || lastVal === undefined) return false;
      return Math.abs(lastVal - prevVal) > 5;
    });
  }, [chartData, outcomes]);

  // Resolve each own entry position to the nearest chart point
  const entryPoints = useMemo(() => {
    if (!userPosition || chartData.length === 0) return [];
    return userPosition
      .map((pos: BetPositionEntry) => {
        const entryTs = new Date(pos.entryTimestamp).getTime();
        const closestPoint = chartData.reduce((best, point) => {
          const diff    = Math.abs(new Date(point.time).getTime() - entryTs);
          const bestDiff = Math.abs(new Date(best.time).getTime() - entryTs);
          return diff < bestDiff ? point : best;
        }, chartData[0]);
        const outcomeIndex = outcomes.findIndex((o) => o.id === pos.outcomeId);
        return { closestPoint, pos, outcomeIndex };
      })
      .filter((ep) => ep.outcomeIndex >= 0);
  }, [userPosition, chartData, outcomes]);

  // Resolve followed trade entry points
  const followedEntryPoints = useMemo(() => {
    if (!followedTrades.length || chartData.length === 0) return [];
    return followedTrades.map((trade) => {
      const entryTs = new Date(trade.entryTimestamp).getTime();
      const closestPoint = chartData.reduce((best, point) => {
        const diff     = Math.abs(new Date(point.time).getTime() - entryTs);
        const bestDiff = Math.abs(new Date(best.time).getTime() - entryTs);
        return diff < bestDiff ? point : best;
      }, chartData[0]);
      const outcomeIndex = outcomes.findIndex((o) => o.id === trade.outcomeId);
      const outcomeLabel = outcomes.find((o) => o.id === trade.outcomeId)?.label ?? "?";
      return { closestPoint, trade, outcomeIndex: Math.max(0, outcomeIndex), outcomeLabel };
    });
  }, [followedTrades, chartData, outcomes]);

  // Stable tooltip renderer — outcomes ref doesn't change between polls
  const renderTooltip = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => <ChartTooltip {...props} outcomes={outcomes} />,
    [outcomes]
  );

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

      {/* Top row: legend + followed trades toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {followedTrades.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFollowed((v) => !v)}
            className={[
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              showFollowed
                ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40"
                : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {showFollowed ? "Hide trades" : `Show trades (${followedTrades.length})`}
          </button>
        )}
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
          <Tooltip content={renderTooltip} />
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

          {/* Own entry avatar chips */}
          {entryPoints.map((ep, i) => (
            <ReferenceDot
              key={`own-${i}`}
              x={ep.closestPoint.time}
              y={Math.round(ep.pos.entryProbability)}
              r={14}
              fill="transparent"
              stroke="none"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(shapeProps: any) => {
                const cx = shapeProps.cx as number;
                const cy = shapeProps.cy as number;
                if (cx === undefined || cy === undefined) return <g />;
                return (
                  <g key={`own-chip-${i}`}>
                    <AvatarChip
                      cx={cx}
                      cy={cy}
                      equipped={userEquipped}
                      borderColor={getColor(ep.outcomeIndex)}
                      clipId={`clip-own-${i}`}
                      onMouseEnter={() => setHovered({ kind: "own", i, cx, cy })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    {hovered?.kind === "own" && hovered.i === i && (
                      <foreignObject
                        x={cx - 65}
                        y={cy - 46}
                        width={130}
                        height={34}
                        style={{ overflow: "visible" }}
                      >
                        <div
                          // @ts-expect-error xmlns needed for SVG foreignObject
                          xmlns="http://www.w3.org/1999/xhtml"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 11,
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            color: "var(--text)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                          }}
                        >
                          {userName ?? "You"}: {Math.round(ep.pos.entryProbability)}%
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              }}
            />
          ))}

          {/* Followed users' trade entry chips */}
          {showFollowed &&
            followedEntryPoints.map((fep, i) => (
              <ReferenceDot
                key={`followed-${i}`}
                x={fep.closestPoint.time}
                y={Math.round(fep.trade.entryProbability)}
                r={14}
                fill="transparent"
                stroke="none"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={(shapeProps: any) => {
                  const cx = shapeProps.cx as number;
                  const cy = shapeProps.cy as number;
                  if (cx === undefined || cy === undefined) return <g />;
                  return (
                    <g key={`followed-chip-${i}`}>
                      <AvatarChip
                        cx={cx}
                        cy={cy}
                        equipped={fep.trade.equipped}
                        borderColor={getColor(fep.outcomeIndex)}
                        clipId={`clip-followed-${i}`}
                        onMouseEnter={() => setHovered({ kind: "followed", i, cx, cy })}
                        onMouseLeave={() => setHovered(null)}
                      />
                      {hovered?.kind === "followed" && hovered.i === i && (
                        <foreignObject
                          x={cx - 80}
                          y={cy - 62}
                          width={160}
                          height={50}
                          style={{ overflow: "visible" }}
                        >
                          <div
                            // @ts-expect-error xmlns needed for SVG foreignObject
                            xmlns="http://www.w3.org/1999/xhtml"
                            style={{
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              padding: "6px 10px",
                              fontSize: 11,
                              textAlign: "center",
                              whiteSpace: "nowrap",
                              color: "var(--text)",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                              lineHeight: 1.5,
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{fep.trade.username}</div>
                            <div style={{ color: "var(--muted)" }}>
                              {fep.outcomeLabel} · {Math.round(fep.trade.entryProbability)}% · {fep.trade.amount.toLocaleString()} coins
                            </div>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                }}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
