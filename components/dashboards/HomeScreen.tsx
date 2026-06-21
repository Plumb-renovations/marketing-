"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Home as HomeIcon,
  Inbox,
  Trophy,
  Banknote,
  Timer,
  CalendarClock,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import { Panel, SectionHeader, Dot } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/DataProvider";
import { AI_RECS, ACTIONS } from "@/lib/domain/constants";
import { audFmt, leadValue } from "@/lib/domain/format";
import { fetchCapacity } from "@/lib/data/capacity";
import { computeCapacity, DEFAULT_CAPACITY, type CapacitySettings } from "@/lib/business/capacity";

// A snapshot tile. `accent` lifts the headline number for the hero metrics.
function Tile({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: typeof HomeIcon;
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <Panel className={`h-full p-4 transition ${href ? "hover:border-slate-700" : ""}`}>
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-wider font-display">{label}</span>
      </div>
      <p
        className={`mt-2 font-data font-semibold tabular-nums ${
          accent ? "text-2xl text-cyan-300" : "text-2xl text-slate-100"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </Panel>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const CAP_STATE: Record<string, { sub: string; accent: boolean }> = {
  empty: { sub: "No jobs booked yet", accent: false },
  thin: { sub: "Running thin — ramp up", accent: true },
  healthy: { sub: "Healthy booked range", accent: true },
  booked: { sub: "Booked solid — ease off ads", accent: true },
};

export default function HomeScreen() {
  const { leads, metrics } = useData();
  const supabase = useMemo(() => createClient(), []);
  const [capacity, setCapacity] = useState<CapacitySettings>(DEFAULT_CAPACITY);

  useEffect(() => {
    fetchCapacity(supabase).then(setCapacity);
  }, [supabase]);

  const cap = computeCapacity(leads, capacity);
  const capState = CAP_STATE[cap.state];

  const newLeads = leads.filter((l) => l.stage === "new").length;
  const open = leads.filter((l) => l.stage === "qualified" || l.stage === "quote");
  const pipelineValue = open.reduce((s, l) => s + leadValue(l), 0);
  const wonLeads = leads.filter((l) => l.stage === "won");
  const wonRevenue = wonLeads.reduce((s, l) => s + leadValue(l), 0);
  const totalSpend = Object.values(metrics.spend || {}).reduce((s, n) => s + (Number(n) || 0), 0);
  const costPerWon = wonLeads.length ? totalSpend / wonLeads.length : 0;

  // Top priority alerts from the Action Centre (the full list lives on /actions).
  const priorityRec = AI_RECS.find((r) => r.priority);
  const otherRecs = AI_RECS.filter((r) => !r.priority);
  const topActions = ACTIONS.filter((a) => a.pri === "high");
  const alerts = [
    priorityRec && {
      id: priorityRec.id,
      tone: "red",
      label: priorityRec.area,
      text: priorityRec.title,
    },
    ...otherRecs.slice(0, 1).map((r) => ({ id: r.id, tone: "amber", label: r.area, text: r.title })),
    ...topActions.slice(0, 1).map((a) => ({ id: a.id, tone: "amber", label: "Action", text: a.text })),
  ]
    .filter(Boolean)
    .slice(0, 3) as { id: string; tone: string; label: string; text: string }[];

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={HomeIcon}
        title="Home"
        desc="Your business at a glance — leads, jobs and what to do next."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          icon={CalendarClock}
          label="Weeks of work booked"
          value={cap.activeJobs === 0 ? "—" : cap.weeksInBank.toFixed(1)}
          sub={
            cap.bookedOutUntil
              ? `Booked out to ${new Date(cap.bookedOutUntil).toLocaleDateString()} · ${capState.sub}`
              : capState.sub
          }
          href="/business"
          accent
        />
        <Tile
          icon={Banknote}
          label="Cost per won job"
          value={costPerWon ? audFmt(costPerWon) : "—"}
          sub={`${wonLeads.length} won · ${totalSpend ? audFmt(totalSpend) + " spend" : "no spend tracked"}`}
        />
        <Tile
          icon={Timer}
          label="Avg response time"
          value="—"
          sub="Tracked via Speed to Lead"
          href="/lead-response"
        />
        <Tile
          icon={Inbox}
          label="New leads"
          value={newLeads}
          sub="Awaiting first contact"
          href="/leads"
        />
        <Tile
          icon={ListChecks}
          label="Pipeline value"
          value={pipelineValue ? audFmt(pipelineValue) : "—"}
          sub={`${open.length} open ${open.length === 1 ? "opportunity" : "opportunities"}`}
          href="/pipeline"
        />
        <Tile
          icon={Trophy}
          label="Won jobs"
          value={wonLeads.length}
          sub={wonRevenue ? audFmt(wonRevenue) + " revenue" : undefined}
          href="/revenue"
        />
      </div>

      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-100">Priorities</h3>
          <Link
            href="/actions"
            className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
          >
            Action Centre <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing urgent right now.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3.5"
              >
                <Dot status={a.tone} />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-display">
                    {a.label}
                  </span>
                  <p className="text-sm text-slate-200">{a.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
