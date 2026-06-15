"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Workflow, Menu } from "lucide-react";
import { NAV, TITLES } from "@/lib/domain/constants";
import Drawers from "@/components/leads/Drawers";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const current = pathname.split("/")[1] || "leads";
  const group = ["leads", "pipeline", "revenue"].includes(current) ? "Operations" : "Marketing";

  return (
    <div className="flex">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-slate-800 bg-slate-900/80 transition-transform lg:static lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-slate-950"><Workflow className="h-5 w-5" /></div>
          <div className="leading-tight"><p className="font-display text-sm font-semibold text-slate-100">Plumb Renovations</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Command Centre</p></div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((grp) => (
            <div key={grp.group} className="mb-4">
              <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.18em] text-cyan-400/80 font-display">{grp.group}</p>
              <div className="space-y-0.5">
                {grp.items.map((n) => {
                  const active = current === n.id;
                  const Icon = n.icon;
                  return (
                    <Link key={n.id} href={`/${n.id}`} onClick={() => setNavOpen(false)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
                      <Icon className="h-4 w-4" />
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="border-t border-slate-800 p-3">
          <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-xs text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-300">Sign out</button>
        </form>
      </aside>
      {navOpen && <div onClick={() => setNavOpen(false)} className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden" />}

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setNavOpen(true)} className="rounded-lg border border-slate-700 p-2 text-slate-400 lg:hidden"><Menu className="h-4 w-4" /></button>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 font-display">{group}</div>
              <h1 className="font-display text-lg font-semibold tracking-tight text-slate-100">{TITLES[current] || "Command Centre"}</h1>
            </div>
          </div>
          <span className="hidden items-center gap-1.5 text-[11px] text-emerald-400 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live data</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <Drawers />
    </div>
  );
}
