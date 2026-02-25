"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  getUserSettings,
  updateUserSettings,
  type UserSettingsRow,
} from "@/app/actions/notifications";

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={value}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ backgroundColor: value ? "var(--accent)" : "var(--border)" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export function SettingsDropdown() {
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [settings, setSettings] = useState<UserSettingsRow>({
    notifyOnMarketResolution: true,
    notifyOnBetResult: true,
  });
  const ref = useRef<HTMLDivElement>(null);

  // Read theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    if (saved) setTheme(saved);
  }, []);

  // Fetch notification preferences when authenticated
  useEffect(() => {
    if (status !== "authenticated") return;
    getUserSettings().then(setSettings);
  }, [status]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  function applyTheme(next: "dark" | "light") {
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function toggleNotif(key: keyof UserSettingsRow) {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated); // optimistic
    await updateUserSettings({ [key]: updated[key] });
  }

  function handleSignOut() {
    setIsOpen(false);
    signOut({ callbackUrl: "/" });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--text)]"
        aria-label="Settings"
      >
        {/* Gear icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          {/* Appearance */}
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Appearance
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text)]">
                {theme === "dark" ? "Dark" : "Light"} mode
              </span>
              <Toggle
                value={theme === "light"}
                onToggle={() => applyTheme(theme === "dark" ? "light" : "dark")}
              />
            </div>
          </div>

          {/* Notifications — only when signed in */}
          {status === "authenticated" && (
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Notifications
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text)]">Market resolution</span>
                  <Toggle
                    value={settings.notifyOnMarketResolution}
                    onToggle={() => toggleNotif("notifyOnMarketResolution")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text)]">Bet results</span>
                  <Toggle
                    value={settings.notifyOnBetResult}
                    onToggle={() => toggleNotif("notifyOnBetResult")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sign out — only when signed in */}
          {status === "authenticated" && (
            <div className="px-4 py-3">
              <button
                onClick={handleSignOut}
                className="text-sm text-red-400 transition hover:text-red-300"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
