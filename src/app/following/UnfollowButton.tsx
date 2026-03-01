"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unfollowUser } from "@/app/actions/social";

export function UnfollowButton({ followingId }: { followingId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleUnfollow() {
    startTransition(async () => {
      await unfollowUser(followingId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleUnfollow}
      disabled={isPending}
      className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition-colors hover:border-red-500/50 hover:text-red-400"
    >
      {isPending ? "…" : "Unfollow"}
    </button>
  );
}
