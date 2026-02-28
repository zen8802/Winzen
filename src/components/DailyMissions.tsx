"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getGamificationData } from "@/app/actions/user";
import { RewardReveal } from "./RewardReveal";

type Mission = {
  key: string;
  label: string;
  target: number;
  reward: number;
  progress: number;
  completed: boolean;
};

export function DailyMissions() {
  const { status } = useSession();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  // Track previously-completed keys in a ref to avoid restarting effects
  const prevCompletedRef = useRef<Set<string>>(new Set());

  const fetchMissions = useCallback(async () => {
    const d = await getGamificationData();
    if (!d) return;
    const newMissions = d.dailyMissions;

    // Detect newly completed missions without nested setState
    for (const m of newMissions) {
      if (m.completed && !prevCompletedRef.current.has(m.key)) {
        setJustCompleted(m.key);
        break; // show one animation at a time
      }
    }
    prevCompletedRef.current = new Set(
      newMissions.filter((m) => m.completed).map((m) => m.key)
    );
    setMissions(newMissions);
  }, []);

  // Fetch once on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchMissions();
  }, [status, fetchMissions]);

  // Refresh after any action that could complete a mission (bet, reward, etc.)
  useEffect(() => {
    if (status !== "authenticated") return;
    const handler = () => fetchMissions();
    window.addEventListener("balance-updated", handler);
    return () => window.removeEventListener("balance-updated", handler);
  }, [status, fetchMissions]);

  if (status !== "authenticated" || missions.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">Daily Missions</h2>
      <ul className={`grid gap-3 ${missions.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {missions.map((mission) => {
          const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
          const isJustDone = justCompleted === mission.key;

          return (
            <li
              key={mission.key}
              className={`rounded-xl border px-4 py-3 transition ${
                mission.completed
                  ? "border-fuchsia-500/30 logo-gradient-bg"
                  : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-[var(--text)]">{mission.label}</p>
                {mission.completed ? (
                  <span className="logo-gradient shrink-0 text-sm font-bold">✓</span>
                ) : (
                  <span className="shrink-0 font-mono text-xs text-[var(--muted)]">
                    {mission.progress}/{mission.target}
                  </span>
                )}
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    mission.completed ? "" : "bg-[var(--accent)]"
                  }`}
                  style={{
                    width: `${pct}%`,
                    ...(mission.completed ? { background: "linear-gradient(135deg, #f472b6, #a78bfa)" } : {}),
                  }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">
                  +{mission.reward.toLocaleString()} coins
                </span>
                {isJustDone && (
                  <RewardReveal
                    amount={mission.reward}
                    delay={300}
                    onDone={() => setJustCompleted(null)}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
