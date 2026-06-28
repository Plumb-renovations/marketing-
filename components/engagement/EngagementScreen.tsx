"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageCircle, Facebook, Instagram, Star, Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  Plug, Wand2, Send, ExternalLink, Flag, User,
} from "lucide-react";
import { Panel, SectionHeader, Chip } from "@/components/ui/primitives";
import {
  fetchEngagement, syncEngagement, draftEngagement, replyEngagement,
  type EngagementData, type EngagementItem, type CommentAccess,
} from "@/lib/engagement";

const CH = {
  facebook: { label: "Facebook", icon: Facebook, status: "indigo" },
  instagram: { label: "Instagram", icon: Instagram, status: "red" },
  google: { label: "Google", icon: Star, status: "amber" },
} as const;

const SENTIMENT: Record<string, string> = { positive: "emerald", neutral: "slate", negative: "red" };

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const d = Date.parse(iso);
  if (isNaN(d)) return "";
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
};

export default function EngagementScreen() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => { setData(await fetchEngagement()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const sync = async () => { setSyncing(true); await syncEngagement(); await load(); setSyncing(false); };

  const access = data?.meta.access || null;
  const metaItems = (data?.items || []).filter((i) => i.channel === "facebook" || i.channel === "instagram");
  const googleItems = (data?.items || []).filter((i) => i.channel === "google");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={MessageCircle} title="Comments & Reviews" desc="Hazel drafts replies in your voice for comments and reviews — you approve before anything posts. Nothing auto-posts." />
        <button onClick={sync} disabled={syncing} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {syncing ? "Checking…" : "Check for new"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {/* Facebook + Instagram comments */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-slate-200">Facebook & Instagram comments</h3>
            <MetaBanner connected={!!data?.meta.connected} access={access} />
            {metaItems.length === 0 ? (
              <Panel className="p-6 text-center text-sm text-slate-500">
                {access?.canRead ? "No new comments right now." : "Comments will appear here once Meta approves comment access (see above) — nothing is faked."}
              </Panel>
            ) : metaItems.map((it) => (
              <ItemCard key={it.id} item={it} canReply={it.channel === "instagram" ? !!access?.canReplyIg : !!access?.canReplyFb} onChanged={load} />
            ))}
          </section>

          {/* Google reviews */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold text-slate-200">Google reviews</h3>
            {!data?.google.connected ? (
              <Panel className="border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start gap-2 text-sm text-amber-200">
                  <Plug className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Pending Google connection</p>
                    <p className="mt-0.5 text-xs text-amber-200/80">Google Business Profile isn't connected yet, so reviews can't be pulled. Once it's connected in Settings → Integrations, your reviews appear here and Hazel drafts replies the same way — this lights up automatically. Nothing here is faked.</p>
                  </div>
                </div>
              </Panel>
            ) : googleItems.length === 0 ? (
              <Panel className="p-6 text-center text-sm text-slate-500">No new reviews right now.</Panel>
            ) : googleItems.map((it) => (
              <ItemCard key={it.id} item={it} canReply onChanged={load} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function MetaBanner({ connected, access }: { connected: boolean; access: CommentAccess | null }) {
  if (!connected) {
    return (
      <Panel className="p-4"><div className="flex items-start gap-2 text-sm text-slate-300"><Plug className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" /><div><p className="font-medium text-slate-200">Connect Meta</p><p className="mt-0.5 text-xs text-slate-500">Connect your Facebook Page & Instagram in <Link href="/integrations" className="text-cyan-300 underline">Settings → Integrations</Link>.</p></div></div></Panel>
    );
  }
  if (access?.canReply) {
    return <Panel className="border-emerald-500/30 bg-emerald-500/5 p-3"><div className="flex items-start gap-2 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Connected — Hazel can pull comments and post your approved replies.</div></Panel>;
  }
  return (
    <Panel className="border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{access?.canRead ? "Reading comments, but replying is pending approval" : "Connecting… — pending Meta approval"}</p>
          <p className="mt-0.5 text-xs text-amber-200/80">{access?.note || "Reading & replying to comments needs extra Meta permissions."}</p>
          <p className="mt-1 text-xs text-amber-200/70">Comment access (<span className="font-data">pages_read_engagement</span>, <span className="font-data">pages_manage_engagement</span>, <span className="font-data">instagram_manage_comments</span>) is separate from the ads/leads access Hazel has, and needs <strong>Meta App Review</strong>. Until then this stays in a pending state — no fake comments.</p>
        </div>
      </div>
    </Panel>
  );
}

function ItemCard({ item, canReply, onChanged }: { item: EngagementItem; canReply: boolean; onChanged: () => void }) {
  const ch = CH[item.channel];
  const Icon = ch.icon;
  const [text, setText] = useState(item.draftReply || "");
  const [drafting, setDrafting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(item.status === "replied");

  const draft = async () => {
    setDrafting(true); setErr("");
    const r = await draftEngagement(item.id);
    if (r) setText(r.reply || "");
    else setErr("Couldn't draft a reply.");
    setDrafting(false);
  };
  const post = async () => {
    if (!text.trim()) return;
    setPosting(true); setErr("");
    const r = await replyEngagement(item.id, text);
    setPosting(false);
    if (r.ok) { setDone(true); onChanged(); } else setErr(r.message || "Couldn't post.");
  };

  if (done) {
    return <Panel className="p-3 text-sm text-emerald-300"><CheckCircle2 className="mr-1.5 inline h-4 w-4" /> Replied to {item.author || "this " + item.kind}.</Panel>;
  }

  return (
    <Panel className={`p-3.5 ${item.flagged ? "border-amber-500/40" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-400"><User className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-slate-100">{item.author || (item.kind === "review" ? "Reviewer" : "Commenter")}</span>
            <Chip status={ch.status}><Icon className="mr-0.5 h-3 w-3" /> {ch.label}</Chip>
            {item.kind === "review" && item.rating != null && <span className="font-data text-[11px] text-amber-300">{"★".repeat(item.rating)}{"☆".repeat(Math.max(0, 5 - item.rating))}</span>}
            {item.sentiment && <Chip status={SENTIMENT[item.sentiment] || "slate"}>{item.sentiment}</Chip>}
            {item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-300 hover:underline">view <ExternalLink className="inline h-3 w-3" /></a>}
            <span className="ml-auto text-[11px] text-slate-500">{timeAgo(item.itemAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{item.text}</p>

          {item.flagged && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-200">
              <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span><span className="font-semibold">Needs your personal attention.</span> {item.flagReason || "This looks sensitive — Hazel hasn't auto-written a reply. Handle it in your own words."}</span>
            </p>
          )}

          {/* Draft + approve */}
          <div className="mt-2">
            {text ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50" />
            ) : (
              <button onClick={draft} disabled={drafting} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50">
                {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Draft a reply with Hazel
              </button>
            )}
            {err && <p className="mt-1 text-[11px] text-red-300">{err}</p>}
            {text && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canReply ? (
                  <button onClick={post} disabled={posting} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Approve & post</button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">Posting unlocks once Meta approves replies. {item.permalink && <a href={item.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-cyan-300 hover:underline">reply manually <ExternalLink className="h-3 w-3" /></a>}</span>
                )}
                <button onClick={draft} disabled={drafting} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">{drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Redraft</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
