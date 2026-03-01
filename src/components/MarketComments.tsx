"use client";

import { useState, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { postComment } from "@/app/actions/comments";
import type { CommentRow } from "@/app/actions/comments";
import { Avatar } from "@/components/Avatar";
import type { AvatarEquipped } from "@/lib/avatar";

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

function UserLabel({ userId, username, isPremium }: {
  userId: string;
  username: string;
  isPremium?: boolean;
}) {
  if (userId) {
    return (
      <Link
        href={`/users/${userId}`}
        className="text-sm font-semibold transition-colors hover:opacity-80"
        style={{ color: isPremium ? "#a78bfa" : "var(--text)" }}
      >
        {username}
      </Link>
    );
  }
  return <span className="text-sm font-semibold text-[var(--text)]">{username}</span>;
}

// ─── Reply item (flat, no nesting) ────────────────────────────────────────────

const ReplyItem = memo(function ReplyItem({ reply }: { reply: CommentRow }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-white/[0.015] px-4 py-3">
      <div className="shrink-0 -my-1">
        <Avatar equipped={reply.avatarEquipped ?? {}} size="sm" animate={false} />
      </div>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-baseline gap-2">
          <UserLabel userId={reply.userId} username={reply.username} isPremium={reply.isPremium} />
          <span className="text-xs text-[var(--muted)]">{timeAgo(reply.createdAt)}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{reply.content}</p>
      </div>
    </div>
  );
});

// ─── Comment thread (top-level comment + its replies) ─────────────────────────

function CommentThread({
  comment,
  marketId,
  isSignedIn,
  currentUserName,
  currentUserEquipped,
}: {
  comment:             CommentRow;
  marketId:            string;
  isSignedIn:          boolean;
  currentUserName:     string | undefined;
  currentUserEquipped: AvatarEquipped | undefined;
}) {
  const [replies, setReplies]             = useState<CommentRow[]>(comment.replies ?? []);
  const [showReplies, setShowReplies]     = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent]   = useState("");
  const [replyLoading, setReplyLoading]   = useState(false);
  const [replyError, setReplyError]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function openReplyForm() {
    setShowReplyForm(true);
    setReplyError("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = replyContent.trim();
    if (!text || replyLoading) return;

    setReplyLoading(true);
    setReplyError("");

    const optimisticId = `opt-reply-${Date.now()}`;
    const optimistic: CommentRow = {
      id:             optimisticId,
      userId:         "",
      username:       currentUserName ?? "You",
      content:        text,
      createdAt:      new Date().toISOString(),
      parentId:       comment.id,
      avatarEquipped: currentUserEquipped,
    };
    setReplies((prev) => [...prev, optimistic]);
    setShowReplies(true);
    setShowReplyForm(false);
    setReplyContent("");

    const fd = new FormData();
    fd.set("marketId", marketId);
    fd.set("content", text);
    fd.set("parentId", comment.id);
    const result = await postComment(fd);
    setReplyLoading(false);

    if (result.error) {
      setReplies((prev) => prev.filter((r) => r.id !== optimisticId));
      setReplyContent(text);
      setShowReplyForm(true);
      setReplyError(result.error);
    }
  }

  const hasReplies = replies.length > 0;
  const showFooter = showReplyForm || hasReplies || !!replyError;

  return (
    <div className="space-y-1.5">
      {/* Top-level comment card */}
      <div className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="shrink-0 -my-1">
          <Avatar equipped={comment.avatarEquipped ?? {}} size="sm" animate={false} />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-baseline gap-2">
            <UserLabel userId={comment.userId} username={comment.username} isPremium={comment.isPremium} />
            <span className="text-xs text-[var(--muted)]">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{comment.content}</p>
          {isSignedIn && (
            <button
              type="button"
              onClick={openReplyForm}
              className="mt-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition"
            >
              Reply
            </button>
          )}
        </div>
      </div>

      {/* Replies area — indented to align with comment body */}
      {showFooter && (
        <div className="pl-[68px] space-y-2">
          {/* Inline reply form */}
          {showReplyForm && (
            <form onSubmit={handleReplySubmit} className="space-y-2">
              <input
                ref={inputRef}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`Reply to ${comment.username}…`}
                maxLength={300}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] outline-none focus:border-pink-400/50"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={replyLoading || !replyContent.trim()}
                  className="btn-primary px-3 py-1 text-xs disabled:opacity-50"
                >
                  {replyLoading ? "…" : "Reply"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReplyForm(false); setReplyContent(""); setReplyError(""); }}
                  className="btn-ghost px-3 py-1 text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {replyError && <p className="text-xs text-red-400">{replyError}</p>}

          {/* Reply count toggle */}
          {hasReplies && (
            <button
              type="button"
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-75 transition"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {showReplies
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />}
              </svg>
              {showReplies ? "Hide" : replies.length} repl{replies.length === 1 ? "y" : "ies"}
            </button>
          )}

          {/* Reply list */}
          {showReplies && (
            <div className="space-y-2">
              {replies.map((reply) => (
                <ReplyItem key={reply.id} reply={reply} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MarketComments({
  marketId,
  initialComments,
  isSignedIn,
  currentUserName,
  currentUserEquipped,
}: {
  marketId:            string;
  initialComments:     CommentRow[];
  isSignedIn:          boolean;
  currentUserName?:    string;
  currentUserEquipped?: AvatarEquipped;
}) {
  const [comments, setComments] = useState<CommentRow[]>(() =>
    [...initialComments].reverse()
  );
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = content.trim();
      if (!text || loading) return;

      setError("");
      setLoading(true);

      const optimisticId = `opt-${Date.now()}`;
      const optimistic: CommentRow = {
        id:             optimisticId,
        userId:         "",
        username:       currentUserName ?? "You",
        content:        text,
        createdAt:      new Date().toISOString(),
        replies:        [],
        avatarEquipped: currentUserEquipped,
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
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        setContent(text);
        setError(result.error);
      }
    },
    [content, currentUserEquipped, currentUserName, loading, marketId],
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">
        Comments{" "}
        {comments.length > 0 && (
          <span className="text-[var(--muted)]">({comments.length})</span>
        )}
      </h2>

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

      <div className="space-y-3">
        {comments.map((c) => (
          <CommentThread
            key={c.id}
            comment={c}
            marketId={marketId}
            isSignedIn={isSignedIn}
            currentUserName={currentUserName}
            currentUserEquipped={currentUserEquipped}
          />
        ))}
        {comments.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--muted)]">
            No comments yet. Be the first!
          </p>
        )}
      </div>

      <div ref={bottomRef} />
    </section>
  );
}
