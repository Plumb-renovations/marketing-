"use client";

import { useCallback, useEffect, useState } from "react";
import { QrCode, MessageSquare, Mail, Loader2, Send, Copy, Check, Smartphone } from "lucide-react";
import { Panel } from "@/components/ui/primitives";

interface RequestInfo {
  connected: boolean;
  reviewUri: string | null;
  qrDataUrl: string | null;
  businessName: string | null;
  sms: { enabled: boolean };
  email: { enabled: boolean };
  requests: Array<{ id: string; customer_name: string | null; channel: string; destination: string | null; status: string; created_at: string }>;
}

export default function RequestReview() {
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews/request-info", { cache: "no-store" });
      setInfo(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Panel className="p-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading review-request options…
        </div>
      </Panel>
    );
  }
  if (!info?.connected) return null;

  return (
    <Panel className="p-5">
      <h3 className="font-display text-base font-semibold text-slate-100">Request a review</h3>
      <p className="mt-0.5 text-sm text-slate-500">Ask a happy customer to leave a Google review.</p>

      {!info.reviewUri && (
        <p className="mt-4 text-sm text-amber-300">No Google review link is available for this location — try reconnecting in Integrations.</p>
      )}

      {info.reviewUri && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <QrPanel info={info} />
          <div className="space-y-5">
            <SmsPanel enabled={info.sms.enabled} onSent={load} />
            {info.email.enabled && <EmailPanel onSent={load} />}
          </div>
        </div>
      )}

      <RecentRequests requests={info.requests || []} />
    </Panel>
  );
}

function QrPanel({ info }: { info: RequestInfo }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!info.reviewUri) return;
    navigator.clipboard.writeText(info.reviewUri).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <QrCode className="h-4 w-4 text-cyan-400" /> Scan in person
      </div>
      <p className="mt-1 text-xs text-slate-500">Show this to a customer — they scan it to open your Google review page.</p>
      {info.qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.qrDataUrl} alt="Google review QR code" className="mx-auto mt-3 h-44 w-44 rounded-lg bg-white p-2" />
      )}
      <button
        onClick={copy}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:bg-slate-800"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Link copied" : "Copy review link"}
      </button>
    </div>
  );
}

function SmsPanel({ enabled, onSent }: { enabled: boolean; onSent: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!enabled) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Smartphone className="h-4 w-4 text-cyan-400" /> Text the link (SMS)
        </div>
        <p className="mt-1 text-xs text-slate-500">
          SMS isn't set up. Add <span className="font-data text-slate-400">TWILIO_ACCOUNT_SID</span>,{" "}
          <span className="font-data text-slate-400">TWILIO_AUTH_TOKEN</span> and{" "}
          <span className="font-data text-slate-400">TWILIO_FROM</span> to enable it. The QR code works without this.
        </p>
      </div>
    );
  }

  const send = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "sms", name, destination: phone.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: b?.message || "Couldn't send the text." });
        return;
      }
      setMsg({ ok: true, text: "Text sent." });
      setName("");
      setPhone("");
      onSent();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <MessageSquare className="h-4 w-4 text-cyan-400" /> Text the link (SMS)
      </div>
      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name (optional)"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile number e.g. +61412345678"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
        />
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <button
          onClick={send}
          disabled={busy || !phone.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send text
        </button>
      </div>
    </div>
  );
}

function EmailPanel({ onSent }: { onSent: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "email", name, destination: email.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: b?.message || "Couldn't send the email." });
        return;
      }
      setMsg({ ok: true, text: "Email sent." });
      setName("");
      setEmail("");
      onSent();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <Mail className="h-4 w-4 text-cyan-400" /> Email the link
      </div>
      <div className="mt-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name (optional)"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
        />
        {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
        <button
          onClick={send}
          disabled={busy || !email.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send email
        </button>
      </div>
    </div>
  );
}

function RecentRequests({ requests }: { requests: RequestInfo["requests"] }) {
  if (!requests.length) return null;
  return (
    <div className="mt-5 border-t border-slate-800 pt-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Recent requests</p>
      <ul className="mt-2 divide-y divide-slate-800/70">
        {requests.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-slate-300">{r.customer_name || r.destination || "—"}</span>
            <span className="flex items-center gap-3 text-xs text-slate-500">
              <span className="uppercase tracking-wide">{r.channel}</span>
              {r.status === "failed" && <span className="text-red-400">failed</span>}
              <span>{new Date(r.created_at).toLocaleDateString()}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
