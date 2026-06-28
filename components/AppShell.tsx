"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal, X } from "lucide-react";
import {
  NAV,
  NAV_ITEMS,
  MOBILE_TAB_GROUPS,
  groupHome,
  type NavGroup,
} from "@/lib/domain/constants";
import { useData } from "@/components/DataProvider";
import Drawers from "@/components/leads/Drawers";
import { HazelLogo } from "@/components/brand/HazelLogo";
import BriefingStrip from "@/components/coach/BriefingStrip";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = pathname.split("/")[1] || "home";
  const activeGroup = NAV_ITEMS[current]?.group ?? NAV[0];

  // Badge counts surfaced next to nav items (e.g. new leads on the Inbox).
  const { leads } = useData();
  const newLeads = leads.filter((l) => l.stage === "new").length;
  const counts: Record<string, number> = { leads: newLeads };

  // Accordion: the active group stays expanded; the user can open others.
  const [open, setOpen] = useState<Set<string>>(new Set([activeGroup.id]));
  useEffect(() => {
    setOpen((prev) => new Set(prev).add(activeGroup.id));
  }, [activeGroup.id]);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV.filter((g) => MOBILE_TAB_GROUPS.includes(g.id));
  const secondary = NAV.filter((g) => !MOBILE_TAB_GROUPS.includes(g.id));

  function NavLink({
    id,
    label,
    Icon,
    onClick,
  }: {
    id: string;
    label: string;
    Icon: NavGroup["icon"];
    onClick?: () => void;
  }) {
    const active = current === id;
    const count = counts[id] || 0;
    return (
      <Link
        href={`/${id}`}
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
          active
            ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30"
            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{label}</span>
        {count > 0 && (
          <span className="rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">
            {count}
          </span>
        )}
      </Link>
    );
  }

  // A collapsible group (or a flat link when it has a single self-named item).
  function Group({ group }: { group: NavGroup }) {
    const single = group.items.length === 1 && group.items[0].id === group.id;
    if (single) {
      const it = group.items[0];
      return <NavLink id={it.id} label={it.label} Icon={it.icon} />;
    }
    const expanded = open.has(group.id);
    const groupActive = group.items.some((i) => i.id === current);
    const GroupIcon = group.icon;
    const childCount = group.items.reduce((s, i) => s + (counts[i.id] || 0), 0);
    return (
      <div>
        <button
          onClick={() => toggle(group.id)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            groupActive ? "text-slate-100" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <GroupIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left font-medium">{group.label}</span>
          {!expanded && childCount > 0 && (
            <span className="rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950">
              {childCount}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {expanded && (
          <div className="mt-0.5 space-y-0.5 border-l border-slate-800 pl-3">
            {group.items.map((it) => (
              <NavLink key={it.id} id={it.id} label={it.label} Icon={it.icon} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-slate-800 bg-slate-900/80 lg:flex">
        <div className="flex h-16 flex-col justify-center border-b border-slate-800 px-5">
          <HazelLogo size={28} />
          <p className="mt-0.5 font-serif text-[11px] italic leading-tight text-cyan-300">
            your best friend in marketing
          </p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {primary.map((g) => (
            <Group key={g.id} group={g} />
          ))}
          <div className="!my-3 border-t border-slate-800/70" />
          {secondary
            .filter((g) => g.tier === "secondary")
            .map((g) => (
              <Group key={g.id} group={g} />
            ))}
          <div className="!my-3 border-t border-slate-800/70" />
          {secondary
            .filter((g) => g.tier === "settings")
            .map((g) => (
              <Group key={g.id} group={g} />
            ))}
        </nav>
        <form action="/auth/signout" method="post" className="border-t border-slate-800 p-3">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300"
          >
            Sign out
          </button>
        </form>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="lg:hidden">
              <HazelLogo size={24} />
            </span>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 font-display">
                {activeGroup.label}
              </div>
              <h1 className="font-display text-lg font-semibold tracking-tight text-slate-100">
                {NAV_ITEMS[current]?.label || "Hazel"}
              </h1>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 text-[11px] text-emerald-400 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live data
          </span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-6">
          <BriefingStrip />
          {children}
        </main>
      </div>

      {/* ---------------- Mobile bottom tabs ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-800 bg-slate-900/95 backdrop-blur lg:hidden">
        {primary.map((g) => {
          const tabActive = g.items.some((i) => i.id === current);
          const Icon = g.icon;
          const count = g.items.reduce((s, i) => s + (counts[i.id] || 0), 0);
          return (
            <Link
              key={g.id}
              href={`/${groupHome(g)}`}
              onClick={() => setMoreOpen(false)}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                tabActive ? "text-cyan-300" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {g.label}
              {count > 0 && (
                <span className="absolute right-[18%] top-1 h-4 min-w-4 rounded-full bg-cyan-500 px-1 text-center text-[9px] font-semibold leading-4 text-slate-950">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
            secondary.some((g) => g.items.some((i) => i.id === current))
              ? "text-cyan-300"
              : "text-slate-500"
          }`}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* ---------------- Mobile "More" sheet ---------------- */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-slate-950/60" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-900 p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-400/80 font-display">
                More
              </span>
              <button onClick={() => setMoreOpen(false)} className="text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {secondary.map((g) => (
                <div key={g.id}>
                  <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-display">
                    {g.label}
                  </p>
                  <div className="space-y-0.5">
                    {g.items.map((it) => (
                      <NavLink
                        key={it.id}
                        id={it.id}
                        label={it.label}
                        Icon={it.icon}
                        onClick={() => setMoreOpen(false)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <form action="/auth/signout" method="post" className="border-t border-slate-800 pt-3">
                <button
                  type="submit"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800/60"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <Drawers />
    </div>
  );
}
