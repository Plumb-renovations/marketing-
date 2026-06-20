"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchBusinessProfile, saveBusinessProfile } from "@/lib/data/businessProfile";
import { DEFAULT_PROFILE, type BusinessProfile } from "@/lib/business/profile";

const toLines = (arr: string[]) => (arr || []).join("\n");
const fromLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function BusinessProfileScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState<BusinessProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setP(await fetchBusinessProfile(supabase));
      } catch {
        setError("Couldn't load your business profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => {
    setP((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await saveBusinessProfile(supabase, p);
      setSaved(true);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your business profile…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building2}
        title="Business Profile"
        desc="Tell Hazel about your business — it tailors AI ad copy and ad targeting to you."
      />

      <Panel className="p-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Text label="Business name" value={p.businessName} onChange={(v) => set("businessName", v)} placeholder="e.g. Coastline Pressure Washing" />
          <Text label="Business / service type" value={p.businessType} onChange={(v) => set("businessType", v)} placeholder="e.g. pressure washing, plumbing, landscaping" />
        </div>

        <Area label="Services offered" hint="One per line" value={toLines(p.services)} onChange={(v) => set("services", fromLines(v))} placeholder={"Driveway & path cleaning\nRoof & gutter cleaning\nHouse soft-washing"} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Text label="Service area (suburbs / region)" value={p.serviceAreaLabel} onChange={(v) => set("serviceAreaLabel", v)} placeholder="e.g. Gold Coast & Northern Rivers" />
          <Num label="Service radius (km)" value={p.serviceRadiusKm} onChange={(v) => set("serviceRadiusKm", v)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Num label="Area centre latitude (optional)" value={p.serviceAreaLat} onChange={(v) => set("serviceAreaLat", v)} step="0.0001" nullable />
          <Num label="Area centre longitude (optional)" value={p.serviceAreaLng} onChange={(v) => set("serviceAreaLng", v)} step="0.0001" nullable />
        </div>
        <p className="-mt-2 text-[11px] text-slate-500">
          The centre + radius set the default location for paid ads. Leave lat/long blank if unsure.
        </p>

        <Area label="Key selling points" hint="One per line — your differentiators" value={toLines(p.sellingPoints)} onChange={(v) => set("sellingPoints", fromLines(v))} placeholder={"Fully licensed & insured\nFixed-price quotes, no surprises\n100% satisfaction guarantee"} />

        <Text label="Tone of voice" value={p.tone} onChange={(v) => set("tone", v)} placeholder="e.g. friendly, down-to-earth, trustworthy" />

        <Area label="Current offer / promo" hint="Optional — featured in copy when set" value={p.offer} onChange={(v) => set("offer", v)} placeholder="e.g. $50 off your first service this month" rows={2} />

        <Area label="Audience interests (paid targeting)" hint="One per line — Meta detailed-targeting interests" value={toLines(p.audienceInterests)} onChange={(v) => set("audienceInterests", fromLines(v))} placeholder={"Home improvement\nHome Ownership\nGardening"} />

        <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
      </Panel>
    </div>
  );
}

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
      />
    </label>
  );
}

function Area({ label, hint, value, onChange, placeholder, rows = 4 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</span>
      {hint && <span className="ml-2 text-[11px] text-slate-600">{hint}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
      />
    </label>
  );
}

function Num({ label, value, onChange, step = "1", nullable }: { label: string; value: number | null; onChange: (v: any) => void; step?: string; nullable?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(nullable ? null : 0);
          onChange(Number(raw));
        }}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-sm text-slate-200 focus:border-cyan-500/50"
      />
    </label>
  );
}
