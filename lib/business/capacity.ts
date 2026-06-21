// Per-org job capacity + the "weeks of work in the bank" computation.
//
// This is the foundation the Signals engine (Part B) builds on: it throttles
// marketing to capacity — ease off ad spend when booked solid, ramp up when
// work runs thin. Part A surfaces the number; Part B reads `state` to gate the
// scale/ramp alerts.
import type { Lead } from "@/lib/domain/types";

export interface CapacitySettings {
  concurrentJobs: number; // crews / job slots running at once
  typicalJobWeeks: number; // default job length when a job's duration isn't set
  healthyMinWeeks: number; // "healthy booked range" lower bound
  healthyMaxWeeks: number; // upper bound
}

export const DEFAULT_CAPACITY: CapacitySettings = {
  concurrentJobs: 1,
  typicalJobWeeks: 2,
  healthyMinWeeks: 4,
  healthyMaxWeeks: 8,
};

// empty  → no work booked
// thin   → below the healthy range (ramp up marketing)
// healthy→ inside the range
// booked → above the range (ease off ad spend)
export type CapacityState = "empty" | "thin" | "healthy" | "booked";

export interface CapacityResult {
  weeksInBank: number; // committed crew-weeks / crews
  bookedOutUntil: string | null; // ISO date, or null when nothing's booked
  state: CapacityState;
  activeJobs: number;
  committedWeeks: number; // total crew-weeks of active work
  healthyMin: number;
  healthyMax: number;
}

function addWeeks(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d.toISOString().slice(0, 10);
}

// "Weeks of work in the bank" = committed crew-weeks of active won jobs, divided
// across the available crews. Active = won and not yet complete.
export function computeCapacity(leads: Lead[], cap: CapacitySettings): CapacityResult {
  const active = leads.filter(
    (l) => l.stage === "won" && (l.jobStatus ?? "scheduled") !== "complete",
  );
  const committedWeeks = active.reduce(
    (s, l) => s + (Number(l.durationWeeks) || cap.typicalJobWeeks),
    0,
  );
  const crews = Math.max(1, cap.concurrentJobs);
  const weeksInBank = committedWeeks / crews;

  let state: CapacityState = "healthy";
  if (active.length === 0) state = "empty";
  else if (weeksInBank < cap.healthyMinWeeks) state = "thin";
  else if (weeksInBank > cap.healthyMaxWeeks) state = "booked";

  return {
    weeksInBank,
    bookedOutUntil: active.length ? addWeeks(weeksInBank) : null,
    state,
    activeJobs: active.length,
    committedWeeks,
    healthyMin: cap.healthyMinWeeks,
    healthyMax: cap.healthyMaxWeeks,
  };
}

// Row <-> settings mapping for the org_capacity table.
export function rowToCapacity(row: any): CapacitySettings {
  return {
    concurrentJobs: Number(row.concurrent_jobs) || DEFAULT_CAPACITY.concurrentJobs,
    typicalJobWeeks: Number(row.typical_job_weeks) || DEFAULT_CAPACITY.typicalJobWeeks,
    healthyMinWeeks: Number(row.healthy_min_weeks) || DEFAULT_CAPACITY.healthyMinWeeks,
    healthyMaxWeeks: Number(row.healthy_max_weeks) || DEFAULT_CAPACITY.healthyMaxWeeks,
  };
}

export function capacityToRow(orgId: string, c: CapacitySettings) {
  return {
    org_id: orgId,
    concurrent_jobs: c.concurrentJobs,
    typical_job_weeks: c.typicalJobWeeks,
    healthy_min_weeks: c.healthyMinWeeks,
    healthy_max_weeks: c.healthyMaxWeeks,
  };
}
