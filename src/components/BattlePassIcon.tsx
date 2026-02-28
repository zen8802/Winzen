"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Genshin-inspired shield/crest badge icon linking to /battle-pass */
export function BattlePassIcon() {
  const pathname = usePathname();
  const active = pathname === "/battle-pass";

  return (
    <Link
      href="/battle-pass"
      aria-label="Battle Pass"
      className={`relative flex items-center justify-center rounded-lg p-1.5 transition hover:bg-white/5 ${
        active ? "text-violet-400" : "text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Shield outline */}
        <path
          d="M12 2L4 5.5v6C4 16.09 7.41 20.68 12 22c4.59-1.32 8-5.91 8-10.5v-6L12 2z"
          fill={active ? "url(#bp-grad)" : "none"}
          stroke={active ? "url(#bp-grad)" : "currentColor"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Inner star / crest */}
        <path
          d="M12 7l1.09 2.26L15.5 9.5l-1.75 1.7.41 2.4L12 12.5l-2.16 1.1.41-2.4L8.5 9.5l2.41-.24L12 7z"
          fill={active ? "white" : "currentColor"}
          opacity={active ? 0.9 : 0.7}
        />
        <defs>
          <linearGradient id="bp-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f472b6" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
    </Link>
  );
}
