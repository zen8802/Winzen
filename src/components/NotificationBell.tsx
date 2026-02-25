"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  getNotifications,
  markNotificationsRead,
  type NotificationRow,
} from "@/app/actions/notifications";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const NotificationItem = memo(function NotificationItem({
  n,
  onClose,
}: {
  n: NotificationRow;
  onClose: () => void;
}) {
  const isWin = n.message.includes("WON");
  const isLoss = n.message.includes("LOST");
  const icon = isWin ? "🎉" : isLoss ? "❌" : "📢";

  const inner = (
    <div
      className={`flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 transition hover:bg-white/[0.03] ${
        !n.isRead ? "bg-[var(--logo)]/[0.06]" : ""
      }`}
    >
      <span className="mt-0.5 shrink-0 text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-[var(--text)]">{n.message}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{timeAgo(n.createdAt)}</p>
      </div>
      {!n.isRead && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--logo)]" />
      )}
    </div>
  );

  if (n.marketId) {
    return (
      <Link href={`/markets/${n.marketId}`} onClick={onClose}>
        {inner}
      </Link>
    );
  }
  return inner;
});

export function NotificationBell() {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.isRead).length;

  async function fetch() {
    const data = await getNotifications();
    setNotifications(data);
  }

  // Fetch on mount + every 30s
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => clearInterval(id);
  }, [status, session?.user?.id]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  async function handleToggle() {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && unread > 0) {
      const ids = notifications.filter((n) => !n.isRead).map((n) => n.id);
      // Optimistic mark-read
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await markNotificationsRead(ids);
    }
  }

  if (status !== "authenticated") return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        className="relative rounded-lg p-2 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--text)]"
        aria-label="Notifications"
      >
        {/* Bell icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--logo)] text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--text)]">Notifications</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onClose={() => setIsOpen(false)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
