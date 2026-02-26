// This module is browser-only. Do NOT import from server components or server actions.

// ─── Types ────────────────────────────────────────────────────────────────────

export type BackgroundConfig =
  | { type: "gradient"; cssValue: string }
  | { type: "image"; dataUrl: string };

// ─── Background presets ───────────────────────────────────────────────────────

export const PRESET_BACKGROUNDS: ReadonlyArray<{
  id: string;
  label: string;
  cssValue: string;
}> = [
  {
    id: "dark-green",
    label: "Bull Market",
    cssValue: "linear-gradient(135deg, #0c0f14 0%, #052e16 60%, #14532d 100%)",
  },
  {
    id: "dark-red",
    label: "Bear Run",
    cssValue: "linear-gradient(135deg, #0c0f14 0%, #450a0a 60%, #7f1d1d 100%)",
  },
  {
    id: "dark-purple",
    label: "Winzen",
    cssValue: "linear-gradient(135deg, #0c0f14 0%, #2e1065 50%, #3b0764 100%)",
  },
  {
    id: "dark-blue",
    label: "Deep Sea",
    cssValue: "linear-gradient(135deg, #0c0f14 0%, #0c1a2e 50%, #0f3460 100%)",
  },
  {
    id: "dark-slate",
    label: "Midnight",
    cssValue: "linear-gradient(135deg, #0c0f14 0%, #0f172a 50%, #1e293b 100%)",
  },
] as const;

// ─── PnL from snapshots ───────────────────────────────────────────────────────

export function computeTimeframePnl(
  snapshots: { totalValue: number; date: string }[],
  timeframe: "24h" | "7d" | "30d" | "all",
): number {
  if (snapshots.length < 2) return 0;
  const msAgo: Record<string, number> = {
    "24h": 86_400_000,
    "7d": 7 * 86_400_000,
    "30d": 30 * 86_400_000,
    "all": Infinity,
  };
  const cutoff = Date.now() - msAgo[timeframe];
  const filtered = snapshots.filter(s => new Date(s.date).getTime() >= cutoff);
  if (filtered.length < 2) return 0;
  return filtered[filtered.length - 1].totalValue - filtered[0].totalValue;
}

// ─── Internal capture ─────────────────────────────────────────────────────────

async function captureCard(element: HTMLElement): Promise<HTMLCanvasElement> {
  // Dynamic import ensures html2canvas is never bundled server-side
  const { default: html2canvas } = await import("html2canvas");
  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    logging: false,
    width: 480,
    height: 600,
  });
}

// ─── Export utilities ─────────────────────────────────────────────────────────

export async function downloadCardAsPng(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const canvas = await captureCard(element);
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export async function copyCardToClipboard(element: HTMLElement): Promise<void> {
  const canvas = await captureCard(element);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
  } catch {
    // Clipboard API not supported — fall back to download
    await downloadCardAsPng(element, "winzen-pnl.png");
    throw new Error("Clipboard not supported; downloaded instead.");
  }
}

export async function shareCard(
  element: HTMLElement,
  filename: string,
  title: string,
): Promise<void> {
  const canvas = await captureCard(element);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
  if (navigator.share) {
    const file = new File([blob], filename, { type: "image/png" });
    await navigator.share({ title, files: [file] });
  } else {
    // Web Share API not available — fall back to download
    await downloadCardAsPng(element, filename);
  }
}
