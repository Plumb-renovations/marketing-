"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Save, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/DataProvider";
import { fetchCapacity, saveCapacity } from "@/lib/data/capacity";
import {
  computeCapacity,
  DEFAULT_CAPACITY,
  type CapacitySettings,
} from "@/lib/business/capacity";

// Per-org job capacity: how much work the team can run at once and the healthy
// "booked range". Drives the "weeks of work in the bank" number on Home + the
// Action Centre, and (Part B) gates the scale/ramp ad alerts.
export default function CapacityCard() {
  const supabase = useMemo(() => createClient(), []);
  const { leads } = useData();
  const [c, setC] = useState<CapacitySettings>(DEFAULT_CAPACITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setC(await fetchCapacity(supabase));
      setLoading(false);
    })();
  }, [supabase]);

  const set = <K extends keyof CapacitySettings>(k: K, v: number) => {
    setC((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await saveCapacity(supabase, c);
      setSaved(true);
    } catch {
      setError("Couldn't save capacity. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const preview = computeCapacity(leads, c);
  const stateLabel: Record<string, { text: string; cls: string }> = {
    empty: { text: "No work booked", cls: "text-slate-400" },
    thin: { text: "Running thin", cls: "text-amber-300" },
    healthy: { text: "Healthy", cls: "text-emerald-300" },
    booked: { text: "Booked solid", cls: "text-cyan-300" },
  };
  const s = stateLabel[preview.state];

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-cyan-400">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold text-slate-100">Job capacity</h3>
          <p className="text-sm text-slate-500">
            How much work you can run at once, and the booked-out range you're aiming for. Hazel uses
            this to throttle marketing to capacity.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Num label="Concurrent jobs" hint="crews / slots" value={c.concurrentJobs} onChange={(v) => set("concurrentJobs", v)} min={1} />
            <Num label="Typical job length" hint="weeks" value={c.typicalJobWeeks} onChange={(v) => set("typicalJobWeeks", v)} min={0} step="0.5" />
            <Num label="Healthy from" hint="weeks booked" value={c.healthyMinWeeks} onChange={(v) => set("healthyMinWeeks", v)} min={0} />
            <Num label="Healthy to" hint="weeks booked" value={c.healthyMaxWeeks} onChange={(v) => set("healthyMaxWeeks", v)} min={0} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">
                Right now
              </span>
              <span className={`text-xs font-medium ${s.cls}`}>{s.text}</span>
            </div>
            <p className="mt-1 font-data text-xl font-semibold text-slate-100">
              {preview.activeJobs === 0
                ? "—"
                : `${preview.weeksInBank.toFixed(1)} weeks of work in the bank`}
            </p>
            <p className="text-[11px] text-slate-500">
              {preview.activeJobs} active {preview.activeJobs === 1 ? "job" : "jobs"}
              {preview.bookedOutUntil
                ? ` · booked out until ${new Date(preview.bookedOutUntil).toLocaleDateString()}`
                : ""}
              {" · target "}
              {c.healthyMinWeeks}–{c.healthyMaxWeeks} weeks
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 border-t border-slate-800 pt-4">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save capacity
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </span>
            )}
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </>
      )}
    </Panel>
  );
}

function Num({
  label,
  hint,
  value,
  onChange,
  min = 0,
  step = "1",
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</span>
      {hint && <span className="ml-1.5 text-[11px] text-slate-600">{hint}</span>}
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? min : Number(raw));
        }}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-sm text-slate-200 focus:border-cyan-500/50"
      />
    </label>
  );
}
