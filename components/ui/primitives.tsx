"use client";

import React from "react";
import { PlugZap, type LucideIcon } from "lucide-react";
import { STATUS, SOURCES } from "@/lib/domain/constants";

export const Dot = ({ status }: { status?: string }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${(STATUS[status || ""] || STATUS.slate).dot}`} />
);

export const Eyebrow = ({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) => (
  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 font-display">
    {Icon && <Icon className="h-3.5 w-3.5 text-cyan-400" />}
    {children}
  </div>
);

export const Panel = ({
  children,
  className = "",
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) => (
  <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 ${glow ? "ring-1 ring-cyan-500/25" : ""} ${className}`}>
    {children}
  </div>
);

export const Chip = ({
  status,
  children,
  className = "",
}: {
  status?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${(STATUS[status || ""] || STATUS.slate).chip} ${className}`}>
    {children}
  </span>
);

export const SrcChip = ({ source }: { source: string }) => {
  const s = SOURCES[source];
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${s?.chip || "bg-slate-700/40 text-slate-300 border-slate-600/50"}`}>
      {s?.short || source}
    </span>
  );
};

export const SectionHeader = ({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) => (
  <div className="mb-5 flex items-start gap-3">
    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-cyan-400">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-100">{title}</h2>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  </div>
);

export function Spark({ data, status = "cyan" }: { data: number[]; status?: string }) {
  const w = 60,
    h = 18,
    max = Math.max(...data),
    min = Math.min(...data);
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * h).toFixed(1)}`)
    .join(" ");
  return (
    <span className={(STATUS[status] || STATUS.cyan).text}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
        <polyline points={pts} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function StatTable({
  columns,
  rows,
  render,
}: {
  columns: string[];
  rows: any[];
  render: (row: any, index: number) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500 font-display">
            {columns.map((c) => (
              <th key={c} className={`px-4 py-3 font-medium ${c !== columns[0] ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">{rows.map(render)}</tbody>
      </table>
    </div>
  );
}

export const RecBlock = ({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: { status?: string; t: string; d?: string }[];
}) => (
  <div>
    <Eyebrow icon={Icon}>{title}</Eyebrow>
    <ul className="mt-3 space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
          <Dot status={it.status} />
          <div>
            <p className="text-sm font-medium text-slate-200">{it.t}</p>
            {it.d && <p className="mt-0.5 text-xs text-slate-500">{it.d}</p>}
          </div>
        </li>
      ))}
    </ul>
  </div>
);

export function ConnectPrompt({
  icon: Icon,
  title,
  body,
  items,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  items?: string[];
}) {
  return (
    <Panel className="p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-400">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-slate-100">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>
      {items && (
        <ul className="mx-auto mt-4 flex max-w-md flex-col gap-2 text-left">
          {items.map((t, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
              <PlugZap className="h-4 w-4 shrink-0 text-cyan-400" />
              {t}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</p>
    <p className="mt-1 font-data text-lg font-semibold tabular-nums text-slate-100">{value}</p>
    {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
  </div>
);

export const Draft = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</p>
    <p className="mt-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-300">{value}</p>
  </div>
);

export const Dial = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <div className="w-12">
    <p className={`font-data text-lg font-semibold tabular-nums ${tone === "cyan" ? "text-cyan-300" : "text-slate-300"}`}>
      {value}
      <span className="text-[11px] text-slate-600">/10</span>
    </p>
    <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
  </div>
);

export const DiagnosisCard = ({
  icon: Icon,
  status,
  title,
  body,
}: {
  icon: LucideIcon;
  status?: string;
  title: string;
  body: string;
}) => (
  <Panel className="p-5">
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${(STATUS[status || ""] || STATUS.slate).text}`} />
      <span className="font-display text-sm font-medium text-slate-200">{title}</span>
    </div>
    <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
  </Panel>
);

export const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</p>
    <p className="mt-0.5 text-sm text-slate-200">{value || "—"}</p>
  </div>
);

export function SettingNum({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</p>
      <div className="mt-1 flex items-center rounded-lg border border-slate-700 bg-slate-950 focus-within:border-cyan-500/50">
        {prefix && <span className="pl-2.5 text-sm text-slate-500">{prefix}</span>}
        <input
          type="number"
          step={step || "1"}
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="w-full bg-transparent px-2.5 py-2 font-data text-sm text-slate-200 focus:outline-none"
        />
        {suffix && <span className="pr-2.5 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

export const CharCount = ({ s, max }: { s: string; max: number }) => {
  const n = (s || "").length;
  return <span className={`font-data text-[10px] ${n <= max ? "text-slate-500" : "text-red-400"}`}>{n}/{max}</span>;
};

export const copyText = (t: string) => {
  try {
    navigator.clipboard.writeText(t);
  } catch {}
};
