const PALETTE = [
  { border: "#22c55e", bg: "rgba(34, 197, 94, 0.18)", text: "#22c55e" },  // green
  { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.18)", text: "#3b82f6" },  // blue
  { border: "#eab308", bg: "rgba(234, 179, 8, 0.18)", text: "#eab308" },   // yellow
  { border: "#a855f7", bg: "rgba(168, 85, 247, 0.18)", text: "#a855f7" },  // purple (4th+)
  { border: "#f97316", bg: "rgba(249, 115, 22, 0.18)", text: "#f97316" },  // orange (5th+)
];

export function getOutcomeColors(index: number) {
  return PALETTE[index % PALETTE.length];
}
