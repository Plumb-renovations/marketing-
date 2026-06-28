"use client";

import { useCallback, useEffect, useState } from "react";
import { Target, Phone, Snowflake, Flame, Loader2, RefreshCw, AlertTriangle, TrendingUp, ChevronRight, CalendarCheck, CalendarDays, Clock } from "lucide-react";
import { Panel, SectionHeader, Chip } from "@/components/ui/primitives";
import { useData } from "@/components/DataProvider";
import { fetchSalesCoach, type SalesCoachData, type SalesQueueItem, type VisitItem } from "@/lib/leadJourney/client";
import { speedLabel } from "@/lib/leadJourney/coach";

const CONF: Record<string, { label: string; status: string }> = {
  early: { label: "Early read — still learning your patterns", status: "amber" },
  building: { label: "Patterns building as deals close", status: "cyan" },
  solid: { label: "Solid read on your win/loss patterns", status: "emerald" },
};

// Visit times are stored as ISO and rendered in the viewer's local timezone.
const pad2 = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
function dayLabel(iso: string): string {
  const now = new Date();
  const tom = new Date(now); tom.setDate(now.getDate() + 1);
  const k = dayKey(new Date(iso));
  if (k === dayKey(now)) return "Today";
  if (k === dayKey(tom)) return "Tomorrow";
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}
// Imminent = same local day, or starting within the hour (and not long past).
function isImminent(iso: string): boolean {
  const t = Date.parse(iso);
  if (isNaN(t)) return false;
  const mins = (t - Date.now()) / 60000;
  return dayKey(new Date(iso)) === dayKey(new Date()) || (mins > -180 && mins <= 60);
}

// Prominent in-app reminder for visits happening today / within the hour, with
// the prep front-and-centre. (Push-when-app-closed is the future app/PWA phase.)
function ImminentVisits({ visits, onOpen }: { visits: VisitItem[]; onOpen: (id: string) => void }) {
  const imminent = visits.filter((v) => isImminent(v.visitAt));
  if (!imminent.length) return null;
  return (
    <div className="space-y-2">
      {imminent.map((v) => (
        <button key={v.id} onClick={() => onOpen(v.id)} className="block w-full rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left transition hover:border-amber-400">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="font-display text-sm font-semibold text-amber-100">Quote visit with {v.name} at {fmtTime(v.visitAt)} — here&apos;s how to win it</span>
          </div>
          {v.briefing?.why && <p className="mt-1.5 text-xs text-amber-100/90"><span className="text-amber-300/80">Why:</span> {v.briefing.why}</p>}
          {v.briefing?.leadWith && <p className="mt-0.5 text-xs text-amber-100/90"><span className="text-amber-300/80">Lead with:</span> {v.briefing.leadWith}</p>}
          {!v.briefing && <p className="mt-1.5 text-xs text-amber-100/80">Open the lead to prep — generate the pre-quote briefing before you go.</p>}
          {v.notes && <p className="mt-0.5 text-[11px] text-amber-200/70">Notes: {v.notes}</p>}
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-200">Open the prep <ChevronRight className="h-3.5 w-3.5" /></span>
        </button>
      ))}
    </div>
  );
}

// The schedule: upcoming booked quote visits, grouped by day (Today / Tomorrow
// / date). Each opens the lead so the user sees the pre-quote briefing prep.
function UpcomingVisits({ visits, onOpen }: { visits: VisitItem[]; onOpen: (id: string) => void }) {
  const todayKey = dayKey(new Date());
  const upcoming = visits.filter((v) => dayKey(new Date(v.visitAt)) >= todayKey);
  const groups: { key: string; label: string; items: VisitItem[] }[] = [];
  for (const v of upcoming) {
    const k = dayKey(new Date(v.visitAt));
    let g = groups.find((x) => x.key === k);
    if (!g) { g = { key: k, label: dayLabel(v.visitAt), items: [] }; groups.push(g); }
    g.items.push(v);
  }
  return (
    <Panel className="p-4">
      <div className="mb-2 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-400" /><h3 className="font-display text-sm font-semibold text-slate-100">Upcoming quote visits</h3>{upcoming.length > 0 && <Chip status="emerald">{upcoming.length}</Chip>}</div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">No quote visits booked. Qualify a lead, then book a visit — it&apos;ll show here with the prep ready.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">{g.label}</p>
              <div className="space-y-2">
                {g.items.map((v) => (
                  <button key={v.id} onClick={() => onOpen(v.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left transition hover:border-emerald-500/40">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Clock className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-100">{fmtTime(v.visitAt)}</span>
                        <span className="truncate text-sm text-slate-200">· {v.name}</span>
                        {v.project && <span className="truncate text-[11px] text-slate-500">· {v.project}</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{v.briefing ? "Prep ready — tap to review the briefing" : "Tap to prep — generate the briefing before you go"}{v.notes ? ` · ${v.notes}` : ""}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function SalesCoachScreen() {
  const { setSelId } = useData();
  const [data, setData] = useState<SalesCoachData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setData(await fetchSalesCoach()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const Item = ({ it, tone }: { it: SalesQueueItem; tone: "call" | "cold" }) => (
    <button onClick={() => setSelId(it.id)} className="flex w-full items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left transition hover:border-cyan-500/40">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone === "call" ? "bg-red-500/10 text-red-300" : "bg-sky-500/10 text-sky-300"}`}>{tone === "call" ? <Phone className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-100">{it.name}</span>
          {it.project && <span className="text-[11px] text-slate-500">· {it.project}</span>}
          {tone === "call" && it.waitingMin != null && <Chip status="red">waiting {speedLabel(it.waitingMin)}</Chip>}
          {tone === "cold" && <Chip status="sky">follow-up {(it.step ?? 0) + 1}</Chip>}
        </div>
        <p className="mt-0.5 text-xs text-cyan-200">{it.action.title}</p>
        <p className="text-[11px] text-slate-400">{it.action.detail}</p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={Target} title="Sales Coach" desc="Hazel works every deal — who to call now, which quotes are going cold, and what your wins and losses are teaching you. Open a lead to log an update and get coached." />
        <button onClick={load} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your deals…</div>
      ) : !data ? (
        <Panel className="p-6 text-center text-sm text-slate-500">Couldn't load the Sales Coach.</Panel>
      ) : (
        <>
          {/* Imminent visit reminder — surfaced prominently at the top */}
          <ImminentVisits visits={data.visits || []} onOpen={setSelId} />

          {/* Call now */}
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2"><Flame className="h-4 w-4 text-red-400" /><h3 className="font-display text-sm font-semibold text-slate-100">Call now — speed wins jobs</h3>{data.callNow.length > 0 && <Chip status="red">{data.callNow.length}</Chip>}</div>
            {data.callNow.length === 0 ? <p className="text-sm text-slate-500">No uncontacted leads — nice, you're on top of it.</p> : <div className="space-y-2">{data.callNow.map((it) => <Item key={it.id} it={it} tone="call" />)}</div>}
          </Panel>

          {/* Upcoming quote visits — the schedule */}
          <UpcomingVisits visits={data.visits || []} onOpen={setSelId} />

          {/* Deals going cold */}
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2"><Snowflake className="h-4 w-4 text-sky-400" /><h3 className="font-display text-sm font-semibold text-slate-100">Deals going cold — chase them</h3>{data.cold.length > 0 && <Chip status="sky">{data.cold.length}</Chip>}</div>
            {data.cold.length === 0 ? <p className="text-sm text-slate-500">No quotes overdue a follow-up. Keep the cadence going.</p> : <div className="space-y-2">{data.cold.map((it) => <Item key={it.id} it={it} tone="cold" />)}</div>}
          </Panel>

          {/* Patterns */}
          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-cyan-400" /><h3 className="font-display text-sm font-semibold text-slate-100">What your deals are teaching you</h3></div>
            <p className="mb-2 text-xs text-slate-500">{data.patterns.won} won · {data.patterns.lost} lost</p>
            {data.patterns.insights.length > 0 ? (
              <ul className="space-y-1.5">{data.patterns.insights.map((i, n) => <li key={n} className="flex items-start gap-2 text-sm text-slate-200"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" /> {i}</li>)}</ul>
            ) : (
              <p className="text-sm text-slate-500">Not enough closed deals yet to spot patterns. Hazel sharpens this as you log wins and losses.</p>
            )}
            {data.patterns.lossByReason.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Losses by reason</p>
                {data.patterns.lossByReason.map((r) => (
                  <div key={r.reason} className="flex items-center gap-2 text-xs"><span className="w-44 shrink-0 truncate text-slate-300">{r.label}</span><div className="h-1.5 flex-1 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-red-400/70" style={{ width: `${Math.min(100, (r.count / Math.max(1, data.patterns.lost)) * 100)}%` }} /></div><span className="w-6 text-right font-data text-slate-400">{r.count}</span></div>
                ))}
              </div>
            )}
            <div className="mt-3"><Chip status={CONF[data.patterns.confidence]?.status || "slate"}>{CONF[data.patterns.confidence]?.label}</Chip></div>
          </Panel>
        </>
      )}
    </div>
  );
}
