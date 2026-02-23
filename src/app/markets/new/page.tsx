"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMarket } from "@/app/actions/markets";
import Link from "next/link";

const TZ_OFFSET = new Date().getTimezoneOffset() * 60 * 1000;

function toLocalISO(d: Date) {
  return new Date(d.getTime() - TZ_OFFSET).toISOString().slice(0, 16);
}

const defaultCloses = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalISO(d);
};

export default function NewMarketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"yes_no" | "multiple_choice">("yes_no");
  const [category, setCategory] = useState<"sports" | "politics" | "culture" | "crypto" | "tech">("culture");
  const [closesAt, setClosesAt] = useState(defaultCloses());
  const [outcomes, setOutcomes] = useState([{ label: "Yes" }, { label: "No" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateOutcome(i: number, label: string) {
    setOutcomes((prev) => prev.map((o, j) => (j === i ? { ...o, label } : o)));
  }

  function addOutcome() {
    setOutcomes((prev) => [...prev, { label: "" }]);
  }

  function removeOutcome(i: number) {
    if (outcomes.length <= 2) return;
    setOutcomes((prev) => prev.filter((_, j) => j !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const filtered = outcomes.map((o) => o.label.trim()).filter(Boolean);
    if (filtered.length < 2) {
      setError("Add at least 2 outcomes");
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("description", description.trim());
    formData.set("type", type);
    formData.set("category", category);
    formData.set("closesAt", new Date(closesAt).toISOString());
    formData.set("outcomes", JSON.stringify(filtered.map((label) => ({ label }))));
    const result = await createMarket(formData);
    setLoading(false);
    if (result?.error) {
      setError(typeof result.error === "object" ? JSON.stringify(result.error) : result.error);
      return;
    }
    if (result?.marketId) {
      window.dispatchEvent(new CustomEvent("balance-updated"));
      router.push(`/markets/${result.marketId}`);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/markets" className="text-sm text-[var(--muted)] hover:text-[var(--accent)]">
        ← Back to markets
      </Link>
      <h1 className="text-2xl font-bold">Create market</h1>
      <p className="text-sm text-[var(--muted)]">
        Creating a market costs <strong className="text-[var(--coin)]">100 coins</strong>. Refunded if your market gets 10+ participants or 500+ volume.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
        )}
        <div>
          <label htmlFor="title" className="mb-1 block text-sm text-[var(--muted)]">
            Question / title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="e.g. Will it rain tomorrow?"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm text-[var(--muted)]">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm text-[var(--muted)]">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="sports">Sports</option>
            <option value="politics">Politics</option>
            <option value="culture">Culture</option>
            <option value="crypto">Crypto</option>
            <option value="tech">Tech</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm text-[var(--muted)]">Type</label>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="type"
                value="yes_no"
                checked={type === "yes_no"}
                onChange={() => {
                  setType("yes_no");
                  setOutcomes([{ label: "Yes" }, { label: "No" }]);
                }}
                className="rounded border-[var(--border)] text-[var(--accent)]"
              />
              Yes / No
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="type"
                value="multiple_choice"
                checked={type === "multiple_choice"}
                onChange={() => setType("multiple_choice")}
                className="rounded border-[var(--border)] text-[var(--accent)]"
              />
              Multiple choice
            </label>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm text-[var(--muted)]">Outcomes</label>
          <div className="space-y-2">
            {outcomes.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={o.label}
                  onChange={(e) => updateOutcome(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => removeOutcome(i)}
                  disabled={outcomes.length <= 2}
                  className="btn-ghost rounded-lg px-3 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={addOutcome} className="btn-ghost text-sm">
              + Add outcome
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="closesAt" className="mb-1 block text-sm text-[var(--muted)]">
            Closes at
          </label>
          <input
            id="closesAt"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            required
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating…" : "Create market"}
        </button>
      </form>
    </div>
  );
}
