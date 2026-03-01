import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getFollowingUsers } from "@/app/actions/social";
import { UnfollowButton } from "./UnfollowButton";

export const metadata = { title: "Following — Winzen" };

export default async function FollowingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const users = await getFollowingUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Following</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Users you follow · their trade entries appear on market charts
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">You&apos;re not following anyone yet.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Visit a{" "}
            <Link href="/leaderboard" className="text-[var(--accent)] hover:underline">
              user&apos;s profile
            </Link>{" "}
            to follow them.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <li key={u.id} className="card flex items-center gap-4">
              <Link href={`/users/${u.id}`} className="shrink-0">
                <Avatar equipped={u.equipped} size="sm" animate={false} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/users/${u.id}`}
                  className="font-semibold hover:text-[var(--accent)]"
                >
                  {u.name}
                </Link>
                <p className="text-xs text-[var(--muted)]">ELO {u.eloRating.toLocaleString()}</p>
              </div>
              <UnfollowButton followingId={u.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
