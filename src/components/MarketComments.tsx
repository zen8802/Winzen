"use client";

import { useState, useRef, useCallback, memo } from "react";
import { postComment } from "@/app/actions/comments";
import type { CommentRow } from "@/app/actions/comments";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const CommentItem = memo(function CommentItem({ comment }: { comment: CommentRow }) {
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">{comment.username}</span>
        <span className="text-xs text-[var(--muted)]">{timeAgo(comment.createdAt)}</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{comment.content}</p>
    </li>
  );
});

export function MarketComments({
  marketId,
  initialComments,
  isSignedIn,
}: {
  marketId: string;
  // Server passes newest-first; we display oldest-first (natural chat order)
  initialComments: CommentRow[];
  isSignedIn: boolean;
}) {
  const [comments, setComments] = useState<CommentRow[]>(() =>
    [...initialComments].reverse()
  );
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = content.trim();
      if (!text || loading) return;

      setError("");
      setLoading(true);

      // Optimistic update — shown immediately, rolled back on error
      const optimisticId = `opt-${Date.now()}`;
      const optimistic: CommentRow = {
        id: optimisticId,
        username: "You",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, optimistic]);
      setContent("");
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });

      const fd = new FormData();
      fd.set("marketId", marketId);
      fd.set("content", text);
      const result = await postComment(fd);
      setLoading(false);

      if (result.error) {
        // Roll back and restore draft
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        setContent(text);
        setError(result.error);
      }
    },
    [content, loading, marketId],
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        Comments {comments.length > 0 && <span className="text-[var(--muted)]">({comments.length})</span>}
      </h2>

      {/* Input */}
      {isSignedIn ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment…"
            maxLength={300}
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="btn-primary shrink-0 text-sm disabled:opacity-50"
          >
            {loading ? "…" : "Post"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          <a href="/login" className="text-[var(--accent)] hover:underline">Sign in</a> to comment.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Comment list */}
      <ul className="space-y-3">
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
        {comments.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--muted)]">
            No comments yet. Be the first!
          </p>
        )}
      </ul>

      <div ref={bottomRef} />
    </section>
  );
}
