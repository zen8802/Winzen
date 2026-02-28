"use client";

import { useState } from "react";
import { setAdminLevel } from "@/app/actions/agent";

export function AdminLevelSetter({ currentLevel }: { currentLevel: number }) {
  const [value, setValue]   = useState(String(currentLevel));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    const fd = new FormData();
    fd.set("level", value);
    const res = await setAdminLevel(fd);
    setLoading(false);
    setMsg(res?.error ?? "Level updated");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs"
    >
      <span className="text-[var(--muted)] shrink-0">Admin level:</span>
      <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-center text-[var(--text)] outline-none focus:border-pink-400/50"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn-gradient px-2 py-0.5 text-xs"
      >
        {loading ? "…" : "Set"}
      </button>
      {msg && <span className="text-[var(--muted)]">{msg}</span>}
    </form>
  );
}
