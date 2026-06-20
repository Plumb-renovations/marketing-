"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star, Loader2, Send, MessageSquare, Plug, AlertTriangle } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import RequestReview from "@/components/reviews/RequestReview";

interface Review {
  id: string;
  name: string;
  author: string;
  photo: string | null;
  rating: number;
  comment: string;
  createTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
}

interface ReviewsData {
  connected: boolean;
  error?: string;
  reviewUri?: string | null;
  averageRating?: number;
  totalReviewCount?: number;
  reviews?: Review[];
}

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-4 w-4 ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-700"}`} />
      ))}
    </span>
  );
}

export default function ReviewsScreen() {
  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      setData(await res.json());
    } catch {
      setData({ connected: false, error: "load_failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your Google reviews…
      </div>
    );
  }

  if (!data?.connected) {
    const reconnect = data?.error === "reconnect_required";
    return (
      <Panel className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400">
          <Star className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-base font-semibold text-slate-100">
          {reconnect ? "Reconnect Google Business Profile" : "Connect Google Business Profile"}
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {reconnect
            ? "Your Google connection expired. Reconnect to load your reviews."
            : "Connect your Google Business Profile to see your star rating, read reviews and reply from here."}
        </p>
        <Link
          href="/integrations"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
        >
          <Plug className="h-4 w-4" /> Go to Integrations
        </Link>
      </Panel>
    );
  }

  const reviews = data.reviews || [];

  return (
    <div className="space-y-6">
      <SectionHeader icon={Star} title="Reviews" desc="Your Google reviews — reply to any of them from here." />

      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-data text-3xl font-semibold tabular-nums text-slate-100">
                {(data.averageRating || 0).toFixed(1)}
              </span>
              <Stars rating={data.averageRating || 0} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{data.totalReviewCount ?? reviews.length} reviews on Google</p>
          </div>
        </div>
      </Panel>

      <RequestReview />

      {data.error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn't load reviews: {data.error}
        </div>
      )}

      <div className="space-y-3">
        {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
        {reviews.map((r) => (
          <ReviewCard key={r.id} review={r} onReplied={load} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review, onReplied }: { review: Review; onReplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const post = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewName: review.name, comment: text.trim() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error === "reconnect_required" ? "Connection expired — reconnect in Integrations." : "Couldn't post reply.");
        return;
      }
      setOpen(false);
      setText("");
      onReplied();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-medium text-slate-200">{review.author}</span>
          <Stars rating={review.rating} />
        </div>
        {review.createTime && (
          <span className="text-[11px] text-slate-500">{new Date(review.createTime).toLocaleDateString()}</span>
        )}
      </div>
      {review.comment && <p className="mt-2 text-sm leading-relaxed text-slate-300">{review.comment}</p>}

      {review.reply ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Your reply</p>
          <p className="mt-1 text-sm text-slate-300">{review.reply.comment}</p>
        </div>
      ) : open ? (
        <div className="mt-3 space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Write a reply that posts publicly to Google…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={post}
              disabled={busy || !text.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post reply
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
        >
          <MessageSquare className="h-4 w-4" /> Reply
        </button>
      )}
    </Panel>
  );
}
