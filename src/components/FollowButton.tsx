"use client";

import { useTransition, useState } from "react";
import { followUser, unfollowUser } from "@/app/actions/social";

type Props = {
  followingId: string;
  initialIsFollowing: boolean;
  followerCount: number;
};

export function FollowButton({ followingId, initialIsFollowing, followerCount }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [count, setCount] = useState(followerCount);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const next = !isFollowing;
    setIsFollowing(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      if (next) {
        await followUser(followingId);
      } else {
        await unfollowUser(followingId);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={[
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        isFollowing
          ? "border border-[var(--border)] text-[var(--muted)] hover:border-red-500/50 hover:text-red-400"
          : "border border-transparent text-white hover:opacity-90",
      ].join(" ")}
      style={!isFollowing ? { background: "linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)" } : undefined}
    >
      {isFollowing ? "Following" : "Follow"}
      {count > 0 && (
        <span className="ml-2 text-xs opacity-70">{count.toLocaleString()}</span>
      )}
    </button>
  );
}
