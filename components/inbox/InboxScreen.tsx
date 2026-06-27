"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  MessagesSquare, Facebook, Instagram, Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  ExternalLink, Send, Plug, User,
} from "lucide-react";
import { Panel, SectionHeader, Chip } from "@/components/ui/primitives";
import { fetchInbox, fetchInboxStatus, replyToThread, type InboxThread, type InboxStatus } from "@/lib/inbox";

const CHANNEL = {
  facebook: { label: "Facebook", icon: Facebook, status: "indigo", dm: "https://www.facebook.com/messages/t/" },
  instagram: { label: "Instagram", icon: Instagram, status: "red", dm: "https://www.instagram.com/direct/inbox/" },
} as const;

const timeAgo = (iso: string) => {
  const d = Date.parse(iso);
  if (isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
};

export default function InboxScreen() {
  const [status, setStatus] = useState<InboxStatus | null>(null);
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, t] = await Promise.all([fetchInboxStatus(), fetchInbox()]);
    setStatus(s);
    setThreads(t);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const canReply = !!status?.access?.canReply;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={MessagesSquare} title="Messages" desc="Facebook Page messages and Instagram DMs in one place, alongside your leads — so nothing slips between two apps." />
        <button onClick={load} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {/* Honest connection state — never claims live when it isn't. */}
      {!loading && <StatusBanner status={status} />}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your inbox…</div>
      ) : threads.length === 0 ? (
        <Panel className="p-8 text-center">
          <MessagesSquare className="mx-auto h-7 w-7 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">No messages here yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-600">
            {status?.access?.canReceive
              ? "When someone messages your Facebook Page or Instagram, it'll appear here."
              : "Your Facebook & Instagram messages will appear here once Meta approves messaging access (see above). This panel stays empty rather than showing anything fake."}
          </p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <ThreadRow key={t.key} t={t} open={openKey === t.key} onToggle={() => setOpenKey(openKey === t.key ? null : t.key)} canReply={canReply} onSent={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBanner({ status }: { status: InboxStatus | null }) {
  if (!status || !status.connected) {
    return (
      <Panel className="p-4">
        <div className="flex items-start gap-2 text-sm text-slate-300">
          <Plug className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
          <div>
            <p className="font-medium text-slate-200">Connect Meta to bring your messages in</p>
            <p className="mt-0.5 text-xs text-slate-500">Connect your Facebook Page & Instagram in <Link href="/integrations" className="text-cyan-300 underline">Settings → Integrations</Link>. Reading messages also needs extra Meta messaging permissions (see below).</p>
          </div>
        </div>
      </Panel>
    );
  }
  const a = status.access;
  if (a?.canReceive) {
    return (
      <Panel className="border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-2 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Messaging connected — Facebook & Instagram messages flow in here, and you can reply from Hazel.</div>
      </Panel>
    );
  }
  return (
    <Panel className="border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-2 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Connecting… — pending Meta approval</p>
          <p className="mt-0.5 text-xs text-amber-200/80">{a?.note || "Messaging permission not granted yet."}</p>
          <p className="mt-1.5 text-xs text-amber-200/70">
            Reading & replying to FB Page messages and IG DMs needs Meta permissions
            (<span className="font-data">pages_messaging</span>, <span className="font-data">instagram_manage_messages</span>) that are separate from the ads/leads access Hazel already has, and require <strong>Meta App Review</strong>. Until that's approved, this inbox stays in this pending state — it won't show fake messages.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <Chip status={a?.pagesMessaging ? "emerald" : "slate"}>FB messages perm {a?.pagesMessaging ? "✓" : "—"}</Chip>
            <Chip status={a?.instagramMessages ? "emerald" : "slate"}>IG messages perm {a?.instagramMessages ? "✓" : "—"}</Chip>
            <Chip status={a?.pageSubscribedMessages ? "emerald" : "slate"}>Webhook subscribed {a?.pageSubscribedMessages ? "✓" : "—"}</Chip>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ThreadRow({ t, open, onToggle, canReply, onSent }: { t: InboxThread; open: boolean; onToggle: () => void; canReply: boolean; onSent: () => void }) {
  const ch = CHANNEL[t.channel];
  const Icon = ch.icon;
  const name = t.senderName || (t.channel === "instagram" ? "Instagram user" : "Facebook user");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!text.trim()) return;
    setSending(true); setErr("");
    const r = await replyToThread({ threadId: t.threadId, channel: t.channel, text });
    setSending(false);
    if (r.ok) { setText(""); onSent(); } else setErr(r.message || "Couldn't send.");
  };

  return (
    <Panel className="overflow-hidden p-0">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-400"><User className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-100">{name}</span>
            <Chip status={ch.status}><Icon className="mr-0.5 h-3 w-3" /> {ch.label}</Chip>
            {t.leadId && <Link href="/leads" onClick={(e) => e.stopPropagation()} className="text-[11px] text-cyan-300 hover:underline">· linked lead</Link>}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{t.lastSnippet || "—"}</p>
        </div>
        <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(t.lastAt)}</span>
      </button>

      {open && (
        <div className="border-t border-slate-800 bg-slate-950/30 px-4 py-3">
          <div className="space-y-1.5">
            {t.messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                <span className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${m.direction === "out" ? "bg-cyan-500/90 text-slate-950" : "bg-slate-800 text-slate-200"}`}>{m.body || "[attachment]"}</span>
              </div>
            ))}
          </div>

          {canReply ? (
            <div className="mt-3">
              <div className="flex items-end gap-2">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={`Reply to ${name}…`} className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" />
                <button onClick={send} disabled={sending || !text.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
              </div>
              {err && <p className="mt-1 text-[11px] text-red-300">{err}</p>}
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <span className="text-[11px] text-slate-500">Replying from Hazel unlocks once Meta approves messaging. For now, reply in the app:</span>
              <a href={ch.dm} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" /> Open {ch.label}</a>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
