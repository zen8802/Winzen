"use client";

import { useRef, useState } from "react";
import { PnLCard } from "@/components/PnLCard";
import {
  PRESET_BACKGROUNDS,
  computeTimeframePnl,
  downloadCardAsPng,
  copyCardToClipboard,
  shareCard,
  type BackgroundConfig,
} from "@/lib/generatePnLImage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PnLCardModalProps {
  userName: string;
  eloRating: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  realizedPnl: number;
  unrealizedPnl: number;
  snapshots: { totalValue: number; date: string }[];
}

type Timeframe = "24h" | "7d" | "30d" | "all";
type ExportStatus = "idle" | "working" | "copied" | "error";

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  "24h": "24H",
  "7d": "7D",
  "30d": "30D",
  "all": "ALL TIME",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PnLCardModal({
  userName,
  eloRating,
  totalTrades,
  totalWins,
  realizedPnl,
  unrealizedPnl,
  snapshots,
}: PnLCardModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("all");
  const [background, setBackground] = useState<BackgroundConfig>({
    type: "gradient",
    cssValue: PRESET_BACKGROUNDS[0].cssValue,
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  // Compute PnL for selected timeframe
  const snapshotPnl = computeTimeframePnl(snapshots, timeframe);
  const pnl =
    snapshotPnl !== 0
      ? snapshotPnl
      : timeframe === "all"
        ? realizedPnl + unrealizedPnl
        : 0;

  const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
  const timeframeLabel = TIMEFRAME_LABELS[timeframe];

  // ─── Export handlers ────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!cardRef.current) return;
    setExportStatus("working");
    setErrorMsg("");
    try {
      await downloadCardAsPng(cardRef.current, `winzen-pnl-${timeframe}.png`);
      setExportStatus("idle");
    } catch {
      setExportStatus("error");
      setErrorMsg("Download failed. Please try again.");
    }
  }

  async function handleCopy() {
    if (!cardRef.current) return;
    setExportStatus("working");
    setErrorMsg("");
    try {
      await copyCardToClipboard(cardRef.current);
      setExportStatus("copied");
      setTimeout(() => setExportStatus("idle"), 2000);
    } catch {
      setExportStatus("error");
      setErrorMsg("Copied as download (clipboard not supported).");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  }

  async function handleShare() {
    if (!cardRef.current) return;
    setExportStatus("working");
    setErrorMsg("");
    try {
      await shareCard(cardRef.current, "winzen-pnl.png", "My Winzen PnL");
      setExportStatus("idle");
    } catch {
      setExportStatus("error");
      setErrorMsg("Share failed.");
      setTimeout(() => setExportStatus("idle"), 3000);
    }
  }

  // ─── Background upload ──────────────────────────────────────────────────────

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) {
      alert("Image too large (max 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBackground({ type: "image", dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  const isWorking = exportStatus === "working";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="btn-gradient flex items-center gap-2 text-sm"
      >
        Share PnL Card
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.72)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="relative w-full max-h-[90vh] overflow-y-auto rounded-2xl border p-6"
            style={{
              maxWidth: 560,
              background: "#0f1520",
              borderColor: "#252d3a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: "#e6edf5" }}>
                Your PnL Card
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none"
                style={{ color: "#8b9cb3" }}
              >
                ×
              </button>
            </div>

            {/* Timeframe tabs */}
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium" style={{ color: "#8b9cb3" }}>
                Timeframe
              </p>
              <div className="flex gap-2">
                {(["24h", "7d", "30d", "all"] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background:
                        timeframe === tf ? "rgba(217,70,239,0.18)" : "rgba(255,255,255,0.05)",
                      color: timeframe === tf ? "#d946ef" : "#8b9cb3",
                      border: `1px solid ${timeframe === tf ? "rgba(217,70,239,0.35)" : "rgba(255,255,255,0.07)"}`,
                    }}
                  >
                    {TIMEFRAME_LABELS[tf]}
                  </button>
                ))}
              </div>
            </div>

            {/* Background picker */}
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium" style={{ color: "#8b9cb3" }}>
                Background
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESET_BACKGROUNDS.map((preset) => {
                  const isSelected =
                    background.type === "gradient" &&
                    background.cssValue === preset.cssValue;
                  return (
                    <button
                      key={preset.id}
                      onClick={() =>
                        setBackground({ type: "gradient", cssValue: preset.cssValue })
                      }
                      title={preset.label}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 10,
                        background: preset.cssValue,
                        outline: isSelected ? "2px solid #e6edf5" : "2px solid transparent",
                        outlineOffset: 2,
                        cursor: "pointer",
                        border: "none",
                        flexShrink: 0,
                      }}
                    />
                  );
                })}

                {/* Upload custom image */}
                <label
                  title="Upload custom background"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    border: "2px dashed #252d3a",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#8b9cb3",
                    fontSize: 22,
                    flexShrink: 0,
                    background:
                      background.type === "image"
                        ? `url(${background.dataUrl}) center/cover no-repeat`
                        : "transparent",
                    outline:
                      background.type === "image"
                        ? "2px solid #e6edf5"
                        : "2px solid transparent",
                    outlineOffset: 2,
                  }}
                >
                  {background.type !== "image" && "+"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>

            {/* Card preview — CSS scale is cosmetic; html2canvas captures native 480×600 */}
            <div className="mb-5 flex justify-center">
              <div
                style={{
                  transform: "scale(0.82)",
                  transformOrigin: "top center",
                  height: 600 * 0.82,
                  width: 480 * 0.82,
                  overflow: "hidden",
                }}
              >
                <PnLCard
                  ref={cardRef}
                  variant="portfolio"
                  userName={userName}
                  pnl={pnl}
                  background={background}
                  timeframeLabel={timeframeLabel}
                  totalTrades={totalTrades}
                  winRate={winRate}
                  eloRating={eloRating}
                />
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownload}
                disabled={isWorking}
                className="btn-gradient flex items-center gap-2 text-sm"
              >
                {isWorking ? "Generating…" : "↓ Download PNG"}
              </button>

              <button
                onClick={handleCopy}
                disabled={isWorking}
                className="btn-ghost text-sm"
              >
                {exportStatus === "copied" ? "Copied!" : "⎘ Copy Image"}
              </button>

              <button
                onClick={handleShare}
                disabled={isWorking}
                className="btn-ghost text-sm"
              >
                ↗ Share
              </button>
            </div>

            {/* Error / info message */}
            {errorMsg && (
              <p className="mt-3 text-xs" style={{ color: "#f97316" }}>
                {errorMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
