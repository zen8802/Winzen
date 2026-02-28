"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  claimBpReward,
  claimChoiceCosmetic,
  togglePremium,
  getBpShopItems,
  type BpStatus,
  type BpRewardRow,
} from "@/app/actions/battle-pass";
import { PREMIUM_PURPLE } from "@/lib/battle-pass";
import { CoinIcon } from "@/components/CoinIcon";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeRemaining(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`;
}

// ─── Choice cosmetic modal ────────────────────────────────────────────────────

type ShopItem = { id: string; name: string; icon: string | null; category: string };

function ChoiceModal({
  reward,
  onClose,
  onClaim,
}: {
  reward: BpRewardRow;
  onClose: () => void;
  onClaim: (itemId: string) => Promise<void>;
}) {
  const [items, setItems]     = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);

  // Load items on mount
  useState(() => {
    if (!reward.itemSlot) { setLoading(false); return; }
    getBpShopItems(reward.itemSlot).then((rows) => {
      setItems(rows);
      setLoading(false);
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">{reward.label ?? "Choose an item"}</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)]">✕</button>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Select one free {reward.itemSlot} for your character.
        </p>

        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No items available yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(item.id);
                  await onClaim(item.id);
                  setBusy(null);
                }}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] transition hover:border-pink-400/50 disabled:opacity-50"
              >
                <div className="relative aspect-square bg-[var(--bg)]">
                  {item.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.icon} alt={item.name} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--muted)]">{item.name}</span>
                  )}
                  {busy === item.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white">…</div>
                  )}
                </div>
                <p className="truncate px-1 py-1 text-[10px] text-[var(--text)]">{item.name}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tier row ─────────────────────────────────────────────────────────────────

function RewardCell({
  reward,
  onClaim,
}: {
  reward: BpRewardRow | undefined;
  onClaim: (reward: BpRewardRow) => void;
}) {
  if (!reward) return <div className="w-full" />;

  const isPremium = reward.track === "PREMIUM";

  const icon =
    reward.rewardType === "COINS"            ? "🪙" :
    reward.rewardType === "CHOICE_COSMETIC"  ? "🎁" :
    reward.rewardType === "XP_BOOST_MARKER"  ? "⚡" : "❓";

  const label =
    reward.rewardType === "COINS"
      ? `${reward.amount?.toLocaleString()} coins`
      : reward.label ?? reward.rewardType;

  const borderClass =
    reward.claimed
      ? "border-green-500/50 bg-green-500/10"
      : reward.rewardType === "XP_BOOST_MARKER"
        ? isPremium
          ? "border-violet-500/30 bg-violet-500/5"
          : "border-[var(--border)] bg-[var(--bg)]"
        : reward.eligible
          ? isPremium
            ? "border-violet-500/50 bg-violet-500/10"
            : "border-pink-400/40 bg-pink-400/10"
          : "border-[var(--border)] bg-[var(--bg)]";

  return (
    <div className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${borderClass}`}>
      <span className={`text-xl leading-none ${reward.claimed ? "opacity-40" : ""}`}>{icon}</span>
      <p className={`text-[10px] leading-tight line-clamp-2 ${reward.claimed ? "text-green-400/60" : "text-[var(--muted)]"}`}>
        {label}
      </p>

      {reward.rewardType === "XP_BOOST_MARKER" ? (
        <span
          className="mt-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ color: PREMIUM_PURPLE }}
        >
          {reward.eligible ? "Active" : "Locked"}
        </span>
      ) : reward.claimed ? (
        <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-md bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
          ✓ Claimed
        </span>
      ) : reward.eligible ? (
        <button
          type="button"
          onClick={() => onClaim(reward)}
          className="mt-0.5 rounded-md px-2 py-0.5 text-[9px] font-bold text-white transition hover:opacity-85"
          style={{ background: "linear-gradient(135deg, #f472b6, #a78bfa)" }}
        >
          Claim
        </button>
      ) : (
        <span className="mt-0.5 text-[9px] text-[var(--muted)]">Locked</span>
      )}
    </div>
  );
}

function TierRow({
  tier,
  totalTiers,
  userTier,
  freeReward,
  premReward,
  isPremium,
  onClaim,
}: {
  tier:       number;
  totalTiers: number;
  userTier:   number;
  freeReward: BpRewardRow | undefined;
  premReward: BpRewardRow | undefined;
  isPremium:  boolean;
  onClaim:    (reward: BpRewardRow) => void;
}) {
  const reached = userTier >= tier;
  const isCurrent = userTier === tier;

  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl p-2 transition ${
        isCurrent
          ? "border border-pink-400/30 bg-pink-400/5"
          : reached
            ? "border border-white/5 bg-white/[0.02]"
            : "opacity-75"
      }`}
    >
      {/* Free reward */}
      <RewardCell reward={freeReward} onClaim={onClaim} />

      {/* Tier pip */}
      <div className="flex flex-col items-center gap-1 w-10">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
            reached
              ? "text-white"
              : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
          }`}
          style={reached ? { background: "linear-gradient(135deg, #f472b6, #a78bfa)" } : undefined}
        >
          {tier}
        </div>
      </div>

      {/* Premium reward */}
      <div className={`rounded-xl transition ${
        isPremium
          ? "ring-1 ring-violet-500/30"
          : "opacity-40 saturate-0"
      }`}>
        <RewardCell reward={premReward} onClaim={onClaim} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BattlePassUI({ initial }: { initial: BpStatus }) {
  const router        = useRouter();
  const [status, setStatus]         = useState<BpStatus>(initial);
  const [togglingPrem, setToggling] = useState(false);
  const [error, setError]           = useState("");
  const [choiceReward, setChoiceReward] = useState<BpRewardRow | null>(null);

  const { season, user, rewards } = status;

  // Group rewards by tier
  const byTier = useMemo(() => {
    const map = new Map<number, { free?: BpRewardRow; prem?: BpRewardRow }>();
    for (let t = 1; t <= season.totalTiers; t++) map.set(t, {});
    for (const r of rewards) {
      const entry = map.get(r.tier) ?? {};
      if (r.track === "FREE")    entry.free = r;
      else                        entry.prem = r;
      map.set(r.tier, entry);
    }
    return map;
  }, [rewards, season.totalTiers]);

  const refresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  async function handleClaim(reward: BpRewardRow) {
    setError("");
    if (reward.rewardType === "CHOICE_COSMETIC") {
      setChoiceReward(reward);
      return;
    }
    const fd = new FormData();
    fd.set("rewardId", reward.id);
    const res = await claimBpReward(fd);
    if (res.error) { setError(res.error); return; }
    window.dispatchEvent(new CustomEvent("balance-updated"));
    refresh();
  }

  async function handleChoiceClaim(itemId: string) {
    if (!choiceReward) return;
    setError("");
    const fd = new FormData();
    fd.set("rewardId", choiceReward.id);
    fd.set("itemId",   itemId);
    const res = await claimChoiceCosmetic(fd);
    if (res.error) { setError(res.error); return; }
    setChoiceReward(null);
    refresh();
  }

  async function handleTogglePremium() {
    setToggling(true);
    const res = await togglePremium();
    setToggling(false);
    if (res.error) { setError(res.error); return; }
    refresh();
  }

  const xpPct = Math.round((user.xpInTier / user.xpPerTier) * 100);
  const halfway = Math.ceil(season.totalTiers / 2);

  return (
    <>
      {choiceReward && (
        <ChoiceModal
          reward={choiceReward}
          onClose={() => setChoiceReward(null)}
          onClaim={handleChoiceClaim}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
                {season.name}
              </h1>
              <p className="text-sm text-[var(--muted)]">{timeRemaining(season.endsAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              {user.isPremium ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                    boxShadow: "0 0 16px rgba(167,139,250,0.4)",
                  }}
                >
                  ✦ Premium Pass
                </span>
              ) : (
                <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                  Free Track
                </span>
              )}
              {/* Dev / admin toggle */}
              {process.env.NODE_ENV === "development" || true ? (
                <button
                  type="button"
                  onClick={handleTogglePremium}
                  disabled={togglingPrem}
                  className="rounded-full border px-3 py-1 text-[10px] font-medium transition disabled:opacity-50"
                  style={user.isPremium
                    ? { borderColor: "rgba(167,139,250,0.4)", color: "#a78bfa" }
                    : { borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  {togglingPrem ? "…" : user.isPremium ? "Revoke (dev)" : "Enable Premium (dev)"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── XP bar ─────────────────────────────────────────────────────────── */}
        <div className="card space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--text)]">
              Tier {user.tier} / {season.totalTiers}
            </span>
            <span className="font-mono text-[var(--muted)]">
              {user.xpInTier} / {user.xpPerTier} XP
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width:      `${xpPct}%`,
                background: "linear-gradient(135deg, #f472b6, #a78bfa)",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[var(--muted)]">
            <span>
              {user.isPremium
                ? user.tier >= season.totalTiers ? "+25% XP Boost Active"
                  : user.tier >= halfway          ? "+10% XP Boost Active"
                  : `+10% boost unlocks at tier ${halfway}`
                : user.tier >= season.totalTiers ? "+12% XP Boost Active"
                  : user.tier >= halfway          ? "+5% XP Boost Active"
                  : `+5% boost unlocks at tier ${halfway}`}
            </span>
            <span>
              {season.totalTiers * season.xpPerTier - user.xp} XP to completion
            </span>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        {/* ── Column headers ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2">
          <p className="text-center text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Free</p>
          <div className="w-10" />
          <div className="flex justify-center">
            {user.isPremium ? (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}
              >
                ✦ Premium
              </span>
            ) : (
              <p className="text-center text-xs font-semibold uppercase tracking-wider opacity-40"
                 style={{ color: PREMIUM_PURPLE }}>
                Premium
              </p>
            )}
          </div>
        </div>

        {/* ── Tier rows ──────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {Array.from({ length: season.totalTiers }, (_, i) => i + 1).map((tier) => {
            const entry = byTier.get(tier) ?? {};
            return (
              <TierRow
                key={tier}
                tier={tier}
                totalTiers={season.totalTiers}
                userTier={user.tier}
                freeReward={entry.free}
                premReward={entry.prem}
                isPremium={user.isPremium}
                onClaim={handleClaim}
              />
            );
          })}
        </div>

        {/* ── XP sources guide ────────────────────────────────────────────────── */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-[var(--text)]">How to earn XP</h2>
          <ul className="space-y-1.5 text-sm text-[var(--muted)]">
            <li className="flex justify-between"><span>Complete a daily quest</span><span className="font-mono text-[var(--text)]">+50 XP</span></li>
            <li className="flex justify-between"><span>Complete ALL daily quests</span><span className="font-mono text-[var(--text)]">+150 XP bonus</span></li>
            <li className="flex justify-between"><span>First bet of the day</span><span className="font-mono text-[var(--text)]">+25 XP</span></li>
            <li className="flex justify-between"><span>First comment of the day</span><span className="font-mono text-[var(--text)]">+10 XP</span></li>
          </ul>
        </div>
      </div>
    </>
  );
}
