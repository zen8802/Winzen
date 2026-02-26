"use client";

import React from "react";
import { CoinIcon } from "@/components/CoinIcon";
import type { BackgroundConfig } from "@/lib/generatePnLImage";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PnLCardProps {
  variant: "portfolio" | "bet";
  userName: string;
  pnl: number;
  background: BackgroundConfig;
  // Portfolio-only
  timeframeLabel?: string; // "24H" | "7D" | "30D" | "ALL TIME"
  totalTrades?: number;
  winRate?: number;  // 0–100
  eloRating?: number;
  // Bet-only
  marketTitle?: string;
  side?: "YES" | "NO";
  amount?: number;
  entryProbability?: number;
  currentProb?: number;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * Fixed 480×600 PnL card — all styles are inline hardcoded hex values.
 * No Tailwind, no CSS variables. Required for reliable html2canvas capture.
 */
export const PnLCard = React.forwardRef<HTMLDivElement, PnLCardProps>(
  function PnLCard(props, ref) {
    const {
      variant,
      userName,
      pnl,
      background,
      timeframeLabel = "ALL TIME",
      totalTrades = 0,
      winRate = 0,
      eloRating = 1000,
      marketTitle = "",
      side = "YES",
      amount = 0,
      entryProbability = 50,
      currentProb = 50,
    } = props;

    const isPositive = pnl >= 0;
    const pnlColor = isPositive ? "#22c55e" : "#f97316";
    const pnlSign = isPositive ? "+" : "";
    const pnlFormatted = `${pnlSign}${Math.round(Math.abs(pnl)).toLocaleString()}`;

    const bgStyle =
      background.type === "gradient"
        ? { background: background.cssValue }
        : { backgroundImage: `url(${background.dataUrl})`, backgroundSize: "cover", backgroundPosition: "center" };

    const sideColor = side === "YES" ? "#22c55e" : "#f97316";
    const sideBg = side === "YES" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)";
    const sideBorder = side === "YES" ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)";

    const winRateDisplay =
      totalTrades === 0 ? "—" : `${winRate.toFixed(1)}%`;

    return (
      <div
        ref={ref}
        style={{
          width: 480,
          height: 600,
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          ...bgStyle,
        }}
      >
        {/* Layer 1: Dark gradient overlay for readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)",
            zIndex: 1,
          }}
        />

        {/* Layer 2: Glow blob behind PnL number */}
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 180,
            borderRadius: "50%",
            background: isPositive
              ? "radial-gradient(ellipse, rgba(34,197,94,0.30) 0%, transparent 70%)"
              : "radial-gradient(ellipse, rgba(249,115,22,0.30) 0%, transparent 70%)",
            left: "50%",
            top: 200,
            transform: "translateX(-50%)",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {/* Layer 3: All content */}

        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            padding: "20px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            zIndex: 3,
          }}
        >
          {/* Left: logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CoinIcon size={26} />
            <span
              style={{
                background: "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Winzen
            </span>
          </div>
          {/* Right: domain */}
          <span style={{ fontSize: 12, color: "#8b9cb3", letterSpacing: "0.04em" }}>
            winzen.gg
          </span>
        </div>

        {/* Center zone: variant label + PnL number */}
        <div
          style={{
            position: "absolute",
            top: 130,
            left: 0,
            right: 0,
            zIndex: 3,
            textAlign: "center",
          }}
        >
          {/* Variant label */}
          <p
            style={{
              fontSize: 13,
              color: "#8b9cb3",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              margin: 0,
              marginBottom: 20,
            }}
          >
            {variant === "portfolio"
              ? `${timeframeLabel} Performance`
              : "Bet PnL"}
          </p>

          {/* Large PnL number */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 78,
                fontWeight: 800,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                color: pnlColor,
                lineHeight: 1,
                letterSpacing: "-0.03em",
              }}
            >
              {pnlFormatted}
            </span>
            <CoinIcon size={50} />
          </div>

          {/* Subline */}
          <p
            style={{
              fontSize: 14,
              color: "#8b9cb3",
              letterSpacing: "0.02em",
              margin: 0,
              marginTop: 14,
            }}
          >
            {isPositive ? "Profit" : "Loss"}
          </p>
        </div>

        {/* Stats panel */}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 24,
            right: 24,
            background: "rgba(12,16,24,0.82)",
            borderRadius: 16,
            padding: "18px 22px",
            zIndex: 3,
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {variant === "portfolio" ? (
            /* Portfolio: 3 stats */
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              {[
                { label: "Win Rate", value: winRateDisplay },
                { label: "Trades", value: totalTrades.toLocaleString() },
                { label: "ELO", value: eloRating.toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#e6edf5",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {value}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#8b9cb3",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      margin: 0,
                      marginTop: 5,
                    }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            /* Bet: market title + entry → current prob */
            <div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#e6edf5",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  margin: 0,
                  marginBottom: 10,
                  lineHeight: 1.4,
                }}
              >
                {marketTitle}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, color: "#8b9cb3" }}>
                    {entryProbability.toFixed(1)}%
                  </span>
                  <span style={{ color: "#8b9cb3", fontSize: 14 }}>→</span>
                  <span style={{ fontSize: 15, color: sideColor }}>
                    {currentProb.toFixed(1)}%
                  </span>
                </div>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: sideBg,
                    color: sideColor,
                    border: `1px solid ${sideBorder}`,
                  }}
                >
                  {side}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "#8b9cb3",
                  margin: 0,
                  marginTop: 8,
                }}
              >
                Wagered: {amount.toLocaleString()} coins
              </p>
            </div>
          )}
        </div>

        {/* Username footer */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 3,
          }}
        >
          <span style={{ fontSize: 12, color: "rgba(139,156,179,0.7)" }}>
            @{userName}
          </span>
        </div>
      </div>
    );
  },
);
