"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getGamificationData } from "@/app/actions/user";
import { RewardReveal } from "./RewardReveal";

export function StreakBanner() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<Awaited<ReturnType<typeof getGamificationData>>>(null);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    getGamificationData().then((d) => {
      setData(d);

      // Show reward animation once per login session
      const today = new Date().toISOString().slice(0, 10);
      const streakReward = session?.user?.streakReward ?? 0;
      const key = `streak_shown_${today}_${session?.user?.id}`;
      if (streakReward > 0 && sessionStorage.getItem(key) !== "1") {
        setShowReward(true);
        sessionStorage.setItem(key, "1");
      }
    });
  }, [status, session?.user?.id, session?.user?.streakReward]);

  if (status !== "authenticated" || !data) return null;

  const multiplierLabel =
    data.winStreak >= 1 ? `${data.winMultiplier.toFixed(1)}x win streak` : null;
  const streakReward = session?.user?.streakReward ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🔥</span>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">
            Day {data.loginStreak} streak
          </p>
          {multiplierLabel && (
            <p className="text-xs text-[var(--muted)]">{multiplierLabel} active</p>
          )}
        </div>
      </div>

      {data.winStreak >= 1 && (
        <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-xs font-medium text-orange-300">
          ⚡ {data.winStreak} win streak · {data.winMultiplier.toFixed(1)}x bonus
        </span>
      )}

      {showReward && streakReward > 0 && (
        <RewardReveal
          amount={streakReward}
          label="coins"
          delay={500}
          onDone={() => setShowReward(false)}
        />
      )}

      {!showReward && streakReward > 0 && (
        <span className="font-mono text-xs text-yellow-400">+{streakReward.toLocaleString()} coins</span>
      )}
    </div>
  );
}
