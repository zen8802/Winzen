"use client";

interface XPBarProps {
  xp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
}

export function XPBar({ xp, level, title, currentLevelXp, nextLevelXp }: XPBarProps) {
  const range = nextLevelXp - currentLevelXp;
  const progress = xp - currentLevelXp;
  const pct = range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="logo-gradient-bg rounded-md px-2 py-0.5 text-xs font-bold text-fuchsia-300">
            Lv {level}
          </span>
          <span className="text-sm font-medium text-[var(--text)]">{title}</span>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">
          {xp.toLocaleString()} XP
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(135deg, #f472b6, #a78bfa)" }}
        />
      </div>
      <p className="mt-1 text-right text-xs text-[var(--muted)]">
        {progress.toLocaleString()} / {range.toLocaleString()} XP to Lv {level + 1}
      </p>
    </div>
  );
}
