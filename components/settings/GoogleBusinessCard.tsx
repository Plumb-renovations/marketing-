"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, Loader2, CheckCircle2, AlertTriangle, RefreshCw, Link2Off, MapPin } from "lucide-react";
import { Panel } from "@/components/ui/primitives";

interface GbStatus {
  provider: "google_business";
  source: "org" | "system_user" | "none";
  status: "connected" | "pending" | "expired" | "disconnected";
  title?: string | null;
  address?: string | null;
  locationName?: string | null;
  reviewUri?: string | null;
}

interface Location {
  accountName: string;
  locationName: string;
  locationId: string;
  title: string;
  address: string | null;
  placeId: string | null;
  reviewUri: string | null;
}

const CONNECT_URL = "/api/integrations/google/oauth/start";

export default function GoogleBusinessCard() {
  const [status, setStatus] = useState<GbStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google/status", { cache: "no-store" });
      setStatus(await res.json());
    } catch {
      setBanner({ kind: "error", text: "Couldn't load Google Business Profile status." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("google_error");
    if (err) setBanner({ kind: "error", text: errorText(err) });
    if (params.get("google_connected")) setBanner({ kind: "info", text: "Google connected — choose your business location below." });
    if (err || params.get("google_connected")) window.history.replaceState({}, "", window.location.pathname);
    load();
  }, [load]);

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-cyan-400">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">Google Business Profile</h3>
            <p className="mt-0.5 text-sm text-slate-500">Read and reply to your Google reviews, and send review requests.</p>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <StatusPill status={status} />}
      </div>

      {banner && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
            banner.kind === "error" ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-cyan-500/30 bg-cyan-500/5 text-cyan-200"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {banner.text}
        </div>
      )}

      {!loading && status && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <Body status={status} onChanged={load} setBanner={setBanner} />
        </div>
      )}
    </Panel>
  );
}

function StatusPill({ status }: { status: GbStatus | null }) {
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

function Body({
  status,
  onChanged,
  setBanner,
}: {
  status: GbStatus;
  onChanged: () => void;
  setBanner: (b: { kind: "error" | "info"; text: string } | null) => void;
}) {
  if (status.source === "system_user") {
    return (
      <div className="flex items-start gap-2 text-sm text-slate-400">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
        <div>Connected with environment credentials (managed in the deployment).</div>
      </div>
    );
  }

  if (status.status === "pending") return <LocationPicker onChanged={onChanged} setBanner={setBanner} />;

  if (status.status === "connected") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <MapPin className="h-4 w-4 text-cyan-400" /> {status.title || status.locationName || "Connected location"}
          </div>
          {status.address && <p className="mt-1 text-xs text-slate-500">{status.address}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={CONNECT_URL} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">
            <RefreshCw className="h-4 w-4" /> Reconnect
          </a>
          <DisconnectButton onChanged={onChanged} setBanner={setBanner} />
        </div>
      </div>
    );
  }

  const expired = status.status === "expired";
  return (
    <div className="space-y-3">
      {expired && <p className="text-sm text-red-300">Your Google connection expired or was revoked. Reconnect to keep reviews and review requests working.</p>}
      <a href={CONNECT_URL} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
        <Star className="h-4 w-4" /> {expired ? "Reconnect Google Business Profile" : "Connect Google Business Profile"}
      </a>
      {status.status === "disconnected" && status.source !== "org" && (
        <p className="text-xs text-slate-500">You'll be sent to Google to grant access, then pick your business location.</p>
      )}
    </div>
  );
}

function LocationPicker({
  onChanged,
  setBanner,
}: {
  onChanged: () => void;
  setBanner: (b: { kind: "error" | "info"; text: string } | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/integrations/google/locations", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setBanner({ kind: "error", text: body?.error === "reconnect_required" ? "Connection expired — reconnect to continue." : "Couldn't load your business locations." });
          return;
        }
        const data = await res.json();
        setLocations(data.locations || []);
        if (data.locations?.length === 1) setSelected(data.locations[0].locationName);
      } finally {
        setLoading(false);
      }
    })();
  }, [setBanner]);

  const save = async () => {
    const loc = locations.find((l) => l.locationName === selected);
    if (!loc) return;
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/google/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loc),
      });
      if (!res.ok) {
        setBanner({ kind: "error", text: "Couldn't save your selection." });
        return;
      }
      setBanner({ kind: "info", text: "Google Business Profile connected." });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your business locations…
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Choose which business location this workspace should manage reviews for.</p>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Business location</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50"
        >
          <option value="">Select a location…</option>
          {locations.map((l) => (
            <option key={l.locationName} value={l.locationName}>{l.title}{l.address ? ` — ${l.address}` : ""}</option>
          ))}
        </select>
      </label>
      {!locations.length && <p className="text-xs text-slate-500">No business locations were returned for this Google account.</p>}
      <button
        onClick={save}
        disabled={saving || !selected}
        className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save location
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
    if (!window.confirm("Disconnect Google Business Profile from this workspace?")) return;
    setBusy(true);
    try {
      await fetch("/api/integrations/google/disconnect", { method: "POST" });
      setBanner({ kind: "info", text: "Google Business Profile disconnected." });
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

function errorText(code: string): string {
  switch (code) {
    case "google_app_not_configured":
      return "Google isn't configured on the server (GOOGLE_GBP_CLIENT_ID / GOOGLE_GBP_CLIENT_SECRET).";
    case "invalid_state":
      return "The connection request expired or didn't match. Please try again.";
    case "no_refresh_token":
      return "Google didn't return a refresh token. Remove the app's access in your Google account, then connect again.";
    case "token_exchange_failed":
      return "Google couldn't complete the connection. Please try again.";
    case "access_denied":
      return "Permission was declined. Connect again and grant access to continue.";
    default:
      return `Connection error: ${code}`;
  }
}
