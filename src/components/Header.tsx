"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { getCurrentUserBalance } from "@/app/actions/user";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CoinIcon } from "@/components/CoinIcon";
import { NotificationBell } from "@/components/NotificationBell";
import { SettingsDropdown } from "@/components/SettingsDropdown";
import { BattlePassIcon } from "@/components/BattlePassIcon";

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    const fetchBalance = () => {
      if (session?.user?.id) {
        getCurrentUserBalance().then((u) => u && setBalance(u.balance));
      } else {
        setBalance(null);
      }
    };
    fetchBalance();
    const onBalanceUpdated = () => fetchBalance();
    window.addEventListener("balance-updated", onBalanceUpdated);
    return () => window.removeEventListener("balance-updated", onBalanceUpdated);
  }, [status, session?.user?.id, pathname]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const close = () => setMenuOpen(false);

  const navLinks =
    status === "authenticated" ? (
      <>
        <Link href="/leaderboard" className="btn-ghost text-sm" onClick={close}>Leaderboard</Link>
        <Link href="/agent" className="btn-ghost text-sm" onClick={close}>My Agent</Link>
        <Link href="/portfolio" className="btn-ghost text-sm" onClick={close}>Portfolio</Link>
        <Link href="/markets/new" className="btn-ghost text-sm" onClick={close}>Create</Link>
        {session?.user?.role === "admin" && (
          <Link href="/admin" className="btn-ghost text-sm logo-gradient" onClick={close}>Admin</Link>
        )}
      </>
    ) : (
      <>
        <Link href="/leaderboard" className="btn-ghost text-sm" onClick={close}>Leaderboard</Link>
        <Link href="/login" className="btn-ghost text-sm" onClick={close}>Log in</Link>
        <Link href="/register" className="btn-primary text-sm" onClick={close}>Sign up</Link>
      </>
    );

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        {/* Left: logo + balance */}
        <div className="flex items-center gap-3">
          <Link href="/" className="logo-gradient text-xl font-semibold tracking-tight transition">
            Winzen
          </Link>
          {status === "authenticated" && balance !== null && (
            <span className="inline-flex items-center gap-1.5 font-mono text-sm font-medium text-[var(--coin)]">
              <CoinIcon size={18} />
              {balance.toLocaleString()}
            </span>
          )}
        </div>

        {/* Desktop nav — hidden below md */}
        <nav className="hidden md:flex items-center gap-4">
          {navLinks}
          {status === "authenticated" && <BattlePassIcon />}
          {status === "authenticated" && <NotificationBell />}
          <SettingsDropdown />
        </nav>

        {/* Mobile right side: notification + settings + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          {status === "authenticated" && <BattlePassIcon />}
          {status === "authenticated" && <NotificationBell />}
          <SettingsDropdown />
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="btn-ghost px-2 py-2"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav className="md:hidden border-t border-[var(--border)] bg-[var(--bg)] px-4 pb-4 pt-2 flex flex-col gap-1">
          {navLinks}
        </nav>
      )}
    </header>
  );
}
