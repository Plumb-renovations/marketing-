"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Facebook,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plug,
  RefreshCw,
  Link2Off,
} from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";

interface MetaStatus {
  provider: "meta";
  source: "org" | "system_user" | "none";
  status: "connected" | "pending" | "expired" | "disconnected";
  adAccountId?: string | null;
  pageId?: string | null;
  adAccountName?: string | null;
  pageName?: string | null;
  userName?: string | null;
  scopes?: string[];
  expiresAt?: string | null;
}

interface AdAccount { id: string; name: string; currency: string | null; active: boolean }
interface Page { id: string; name: string; igUserId: string | null; igUsername: string | null }

const CONNECT_URL = "/api/integrations/meta/oauth/start";

export default function IntegrationsScreen() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/meta/status", { cache: "no-store" });
      setStatus(await res.json());
    } catch {
      setBanner({ kind: "error", text: "Couldn't load integration status." });
    } finally {
      setLoading(false);
    }
  }, []);

  // Read ?connected / ?error from the OAuth round-trip, then load status.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setBanner({ kind: "error", text: errorText(err) });
    if (params.get("connected")) setBanner({ kind: "info", text: "Meta connected — choose your ad account and Page below." });
    if (err || params.get("connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    loadStatus();
  }, [loadStatus]);

  return (
    <div className="space-y-6">
      <SectionHeader icon={Plug} title="Integrations" desc="Connect the ad and lead accounts this workspace uses." />

      {banner && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            banner.kind === "error"
              ? "border-red-500/30 bg-red-500/5 text-red-300"
              : "border-cyan-500/30 bg-cyan-500/5 text-cyan-200"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {banner.text}
        </div>
      )}

      <Panel className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-cyan-400">
              <Facebook className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-slate-100">Meta — Facebook &amp; Instagram</h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Used to publish lead ads and receive leads. Grants <span className="text-slate-400">ads&nbsp;management</span>,{" "}
                <span className="text-slate-400">leads&nbsp;retrieval</span> and Page access.
              </p>
            </div>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : (
            <StatusPill status={status} />
          )}
        </div>

        {!loading && status && (
          <div className="mt-5 border-t border-slate-800 pt-5">
            <MetaBody status={status} onChanged={loadStatus} setBanner={setBanner} />
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatusPill({ status }: { status: MetaStatus | null }) {
  const s = status?.status ?? "disconnected";
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: "Connected", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
    pending: { label: "Finish setup", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
    expired: { label: "Reconnect needed", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
    disconnected: { label: "Not connected", cls: "bg-slate-700/40 text-slate-400 border-slate-600/50" },
  };
  const v = map[s] || map.disconnected;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${v.cls}`}>{v.label}</span>;
}

function MetaBody({
  status,
  onChanged,
  setBanner,
}: {
  status: MetaStatus;
  onChanged: () => void;
  setBanner: (b: { kind: "error" | "info"; text: string } | null) => void;
}) {
  // Plumb's default org uses the env System User — read-only here.
  if (status.source === "system_user") {
    return (
      <div className="flex items-start gap-2 text-sm text-slate-400">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <div>
          Connected with a system-user token (managed in the deployment environment).
          {status.adAccountId && <div className="mt-1 text-xs text-slate-500">Ad account act_{status.adAccountId}{status.pageId ? ` · Page ${status.pageId}` : ""}</div>}
        </div>
      </div>
    );
  }

  if (status.status === "pending") return <AccountPicker onChanged={onChanged} setBanner={setBanner} />;

  if (status.status === "connected") {
    return (
      <div className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Ad account" value={status.adAccountName || (status.adAccountId ? `act_${status.adAccountId}` : "—")} />
          <Field label="Page" value={status.pageName || status.pageId || "—"} />
          {status.userName && <Field label="Connected by" value={status.userName} />}
          {status.expiresAt && <Field label="Token valid until" value={new Date(status.expiresAt).toLocaleDateString()} />}
        </dl>
        <div className="flex flex-wrap gap-2">
          <a href={CONNECT_URL} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" /> Reconnect
          </a>
          <DisconnectButton onChanged={onChanged} setBanner={setBanner} />
        </div>
      </div>
    );
  }

  // expired or disconnected
  const expired = status.status === "expired";
  return (
    <div className="space-y-3">
      {expired && (
        <p className="text-sm text-red-300">
          Your Meta connection has expired or was revoked. Reconnect to keep publishing ads and receiving leads.
        </p>
      )}
      <a
        href={CONNECT_URL}
        className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
      >
        <Facebook className="h-4 w-4" /> {expired ? "Reconnect Meta" : "Connect Meta"}
      </a>
      {status.status === "disconnected" && status.source === "org" && (
        <p className="text-xs text-slate-500">You'll be sent to Facebook to grant access, then pick your ad account and Page.</p>
      )}
    </div>
  );
}

function AccountPicker({
  onChanged,
  setBanner,
}: {
  onChanged: () => void;
  setBanner: (b: { kind: "error" | "info"; text: string } | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/integrations/meta/accounts", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setBanner({ kind: "error", text: body?.error === "reconnect_required" ? "Connection expired — reconnect to continue." : "Couldn't load your Meta accounts." });
          return;
        }
        const data = await res.json();
        setAdAccounts(data.adAccounts || []);
        setPages(data.pages || []);
        if (data.adAccounts?.length === 1) setAdAccountId(data.adAccounts[0].id);
        if (data.pages?.length === 1) setPageId(data.pages[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [setBanner]);

  const save = async () => {
    if (!adAccountId || !pageId) return;
    setSaving(true);
    const acct = adAccounts.find((a) => a.id === adAccountId);
    const page = pages.find((p) => p.id === pageId);
    try {
      const res = await fetch("/api/integrations/meta/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId,
          pageId,
          adAccountName: acct?.name,
          pageName: page?.name,
          igUserId: page?.igUserId,
        }),
      });
      if (!res.ok) {
        setBanner({ kind: "error", text: "Couldn't save your selection." });
        return;
      }
      setBanner({ kind: "info", text: "Meta connected and ready." });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your ad accounts and Pages…
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Choose which ad account and Page this workspace should use.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Ad account</span>
          <select
            value={adAccountId}
            onChange={(e) => setAdAccountId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50"
          >
            <option value="">Select an ad account…</option>
            {adAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.currency ? ` (${a.currency})` : ""}{a.active ? "" : " — inactive"}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Facebook Page</span>
          <select
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50"
          >
            <option value="">Select a Page…</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.igUsername ? ` · IG @${p.igUsername}` : ""}</option>
            ))}
          </select>
        </label>
      </div>
      {!adAccounts.length && !pages.length && (
        <p className="text-xs text-slate-500">No ad accounts or Pages were returned for this Meta user.</p>
      )}
      <button
        onClick={save}
        disabled={saving || !adAccountId || !pageId}
        className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save connection
      </button>
    </div>
  );
}

function DisconnectButton({
  onChanged,
  setBanner,
}: {
  onChanged: () => void;
  setBanner: (b: { kind: "error" | "info"; text: string } | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const disconnect = async () => {
    if (!window.confirm("Disconnect this Meta account from the workspace?")) return;
    setBusy(true);
    try {
      await fetch("/api/integrations/meta/disconnect", { method: "POST" });
      setBanner({ kind: "info", text: "Meta disconnected." });
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={disconnect}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-red-300 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />} Disconnect
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</p>
      <p className="mt-0.5 truncate text-sm text-slate-200">{value}</p>
    </div>
  );
}

function errorText(code: string): string {
  switch (code) {
    case "meta_app_not_configured":
      return "Meta app isn't configured on the server (META_APP_ID / META_APP_SECRET).";
    case "invalid_state":
      return "The connection request expired or didn't match. Please try again.";
    case "token_exchange_failed":
      return "Meta couldn't complete the connection. Please try again.";
    case "access_denied":
      return "Permission was declined. Connect again and grant access to continue.";
    default:
      return `Connection error: ${code}`;
  }
}
