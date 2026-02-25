"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { getCurrentUserBalance } from "@/app/actions/user";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { formatCoins } from "@/lib/coins";
import { CoinIcon } from "@/components/CoinIcon";

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
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
  }, [session?.user?.id, pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
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
        <nav className="flex items-center gap-4">
          <Link href="/agent" className="btn-ghost text-sm">
            My Agent
          </Link>
          {status === "authenticated" ? (
            <>
              <Link href="/portfolio" className="btn-ghost text-sm">
                Portfolio
              </Link>
              <Link href="/markets/new" className="btn-ghost text-sm">
                Create
              </Link>
              {session?.user?.role === "admin" && (
                <Link href="/admin" className="btn-ghost text-sm logo-gradient">
                  Admin
                </Link>
              )}
              <Link href="/api/auth/signout" className="btn-ghost text-sm">
                Sign out
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost text-sm">
                Log in
              </Link>
              <Link href="/register" className="btn-primary text-sm">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
