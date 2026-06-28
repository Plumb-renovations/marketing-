"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Lead, Post, Ad, Settings, Metrics, Quote } from "@/lib/domain/types";
import { SEED_LEADS, SEED_POSTS, DEFAULT_SETTINGS, DEFAULT_METRICS } from "@/lib/domain/seed";
import { uid, today, firstOfNextMonth, quoteTotals } from "@/lib/domain/format";
import { fetchLeads, patchLead, persistQuote, upsertLeadRow, resetLeads, deleteLeadPermanent } from "@/lib/data/leads";
import { fetchPosts, upsertPost, deletePost } from "@/lib/data/posts";
import { fetchAds, upsertAd, deleteAd } from "@/lib/data/ads";
import { fetchSettings, saveSettings } from "@/lib/data/settings";

interface Editor {
  leadId: string;
  quote: Quote;
}

interface LeadActions {
  qualify: (id: string) => void;
  newQuote: (id: string) => void;
  editQuote: (id: string, qid: string) => void;
  saveQuote: (leadId: string, quote: Quote) => void;
  markWon: (id: string, qid: string) => void;
  scheduleJob: (id: string, p: Partial<Lead>) => void;
  markLost: (id: string, reason: string) => void;
  reopen: (id: string) => void;
  setTradify: (id: string, v: string) => void;
  setSource: (id: string, src: string) => void;
  archive: (id: string) => void;
  unarchive: (id: string) => void;
  deleteLead: (id: string) => void;
}

interface DataCtx {
  hydrated: boolean;
  leads: Lead[]; // ACTIVE leads only (archived excluded — so every tally skips them)
  archivedLeads: Lead[];
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  ads: Ad[];
  setAds: React.Dispatch<React.SetStateAction<Ad[]>>;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  metrics: Metrics;
  setMetrics: React.Dispatch<React.SetStateAction<Metrics>>;
  selId: string | null;
  setSelId: (id: string | null) => void;
  editor: Editor | null;
  setEditor: (e: Editor | null) => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
  aiDismissed: boolean;
  setAiDismissed: (v: boolean) => void;
  done: Set<string>;
  toggleDone: (id: string) => void;
  actions: LeadActions;
  addLead: (f: { name: string; suburb: string; source: string; project: string }) => void;
  resetBoard: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}

const warn = (p: Promise<unknown>) =>
  p.catch((e) => console.error("[command-centre] persist failed:", e?.message || e));

export function DataProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [leads, setLeads] = useState<Lead[]>(SEED_LEADS);
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [ads, setAds] = useState<Ad[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [metrics, setMetrics] = useState<Metrics>(DEFAULT_METRICS);
  const [hydrated, setHydrated] = useState(false);

  const [selId, setSelId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [aiDismissed, setAiDismissed] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  // ---- Hydrate from Supabase (fall back to seeds if not configured) ----
  const persistedPosts = useRef<Map<string, string>>(new Map());
  const persistedAds = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [L, P, A, S] = await Promise.all([
          fetchLeads(supabase),
          fetchPosts(supabase),
          fetchAds(supabase),
          fetchSettings(supabase),
        ]);
        if (!alive) return;
        // Show the org's own data — including an empty board for a new org.
        // (The seed fallback below is only for when Supabase isn't reachable.)
        setLeads(L);
        setPosts(P);
        setAds(A);
        setSettings(S.settings);
        setMetrics(S.metrics);
        persistedPosts.current = new Map(P.map((p) => [p.id, JSON.stringify(p)]));
        persistedAds.current = new Map(A.map((a) => [a.id, JSON.stringify(a)]));
      } catch (e) {
        console.error("[command-centre] hydrate failed, using seed data:", e);
        if (!alive) return;
        setLeads(SEED_LEADS);
        setPosts(SEED_POSTS);
      } finally {
        if (alive) setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  // ---- Diff-persist posts / ads ----------------------------------------
  useEffect(() => {
    if (!hydrated) return;
    const next = new Map<string, string>();
    for (const p of posts) {
      const json = JSON.stringify(p);
      next.set(p.id, json);
      if (persistedPosts.current.get(p.id) !== json) warn(upsertPost(supabase, p));
    }
    for (const id of persistedPosts.current.keys())
      if (!next.has(id)) warn(deletePost(supabase, id));
    persistedPosts.current = next;
  }, [posts, hydrated, supabase]);

  useEffect(() => {
    if (!hydrated) return;
    const next = new Map<string, string>();
    for (const a of ads) {
      const json = JSON.stringify(a);
      next.set(a.id, json);
      if (persistedAds.current.get(a.id) !== json) warn(upsertAd(supabase, a));
    }
    for (const id of persistedAds.current.keys())
      if (!next.has(id)) warn(deleteAd(supabase, id));
    persistedAds.current = next;
  }, [ads, hydrated, supabase]);

  // ---- Persist settings + metrics --------------------------------------
  const settingsReady = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!settingsReady.current) {
      settingsReady.current = true;
      return; // skip the write triggered by hydration itself
    }
    warn(saveSettings(supabase, settings, metrics));
  }, [settings, metrics, hydrated, supabase]);

  // ---- Lead actions (optimistic local update + targeted persist) -------
  const findLead = (id: string) => leads.find((l) => l.id === id);
  const patchLocal = (id: string, fields: Partial<Lead>) =>
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)));
  const persist = (id: string, fields: Record<string, any>) => warn(patchLead(supabase, id, fields));

  const actions: LeadActions = {
    qualify: (id) => {
      patchLocal(id, { stage: "qualified" });
      persist(id, { stage: "qualified" });
    },
    newQuote: (id) =>
      setEditor({ leadId: id, quote: { id: uid(), status: "draft", createdAt: today(), lineItems: [] } }),
    editQuote: (id, qid) => {
      const l = findLead(id);
      const q = l?.quotes.find((x) => x.id === qid);
      if (q) setEditor({ leadId: id, quote: q });
    },
    saveQuote: (leadId, quote) => {
      const l = findLead(leadId);
      const exists = !!l?.quotes.some((q) => q.id === quote.id);
      const quotes = exists
        ? (l!.quotes.map((q) => (q.id === quote.id ? quote : q)) as Quote[])
        : [...(l?.quotes || []), quote];
      const stage = l && (l.stage === "qualified" || l.stage === "new") ? "quote" : l?.stage;
      setLeads((prev) => prev.map((x) => (x.id === leadId ? { ...x, quotes, stage: (stage || x.stage) as Lead["stage"] } : x)));
      warn(persistQuote(supabase, leadId, quote));
      if (stage && stage !== l?.stage) persist(leadId, { stage });
      setEditor(null);
    },
    markWon: (id, qid) => {
      const l = findLead(id);
      // Capture the accepted-quote value on the won job (feeds capacity +
      // cost-per-won-job). quoteTotals returns the GST-inclusive total.
      const wonQuote = l?.quotes.find((q) => q.id === qid) || null;
      const jobValue = wonQuote ? quoteTotals(wonQuote).total : (l?.jobValue ?? null);
      const fields: Partial<Lead> = {
        stage: "won",
        wonQuoteId: qid,
        lostReason: null,
        jobStatus: l?.jobStatus || "scheduled",
        durationWeeks: l?.durationWeeks || 2,
        startDate: l?.startDate || firstOfNextMonth(),
        jobValue,
      };
      patchLocal(id, fields);
      persist(id, fields);
    },
    scheduleJob: (id, p) => {
      patchLocal(id, p);
      persist(id, p as Record<string, any>);
    },
    markLost: (id, reason) => {
      patchLocal(id, { stage: "lost", lostReason: reason });
      persist(id, { stage: "lost", lostReason: reason });
    },
    reopen: (id) => {
      const l = findLead(id);
      const stage = (l?.quotes.length ? "quote" : "qualified") as Lead["stage"];
      patchLocal(id, { stage, wonQuoteId: null, lostReason: null });
      persist(id, { stage, wonQuoteId: null, lostReason: null });
    },
    setTradify: (id, v) => {
      patchLocal(id, { tradify: v });
      persist(id, { tradify: v });
    },
    setSource: (id, src) => {
      patchLocal(id, { source: src as Lead["source"] });
      persist(id, { source: src });
    },
    archive: (id) => {
      const archivedAt = new Date().toISOString();
      patchLocal(id, { archivedAt });
      persist(id, { archivedAt });
      if (selId === id) setSelId(null); // close the drawer if it was open
    },
    unarchive: (id) => {
      patchLocal(id, { archivedAt: null });
      persist(id, { archivedAt: null });
    },
    deleteLead: (id) => {
      // Permanent: remove locally + hard-delete + tombstone (no Meta re-import).
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (selId === id) setSelId(null);
      warn(deleteLeadPermanent(supabase, id));
    },
  };

  const addLead = (f: { name: string; suburb: string; source: string; project: string }) => {
    const id = "n" + uid();
    const lead: Lead = {
      id,
      date: today(),
      name: f.name.trim(),
      suburb: f.suburb.trim() || "—",
      source: f.source as Lead["source"],
      project: f.project.trim() || "Bathroom",
      stage: "new",
      quotes: [],
    };
    setLeads((p) => [lead, ...p]);
    warn(upsertLeadRow(supabase, lead));
    setAddOpen(false);
    setSelId(id);
  };

  const resetBoard = () => {
    if (typeof window !== "undefined" && window.confirm("Reset the board to your tracker data? This clears any changes.")) {
      setLeads(SEED_LEADS);
      setSelId(null);
      warn(resetLeads(supabase, SEED_LEADS));
    }
  };

  const toggleDone = (id: string) =>
    setDone((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Archived leads are soft-deleted: exclude them from the leads everything
  // reads (board, sidebar count, Home metrics, capacity), expose them
  // separately for the Archived view.
  const activeLeads = leads.filter((l) => !l.archivedAt);
  const archivedLeads = leads.filter((l) => l.archivedAt);

  const value: DataCtx = {
    hydrated,
    leads: activeLeads,
    archivedLeads,
    posts,
    setPosts,
    ads,
    setAds,
    settings,
    setSettings,
    metrics,
    setMetrics,
    selId,
    setSelId,
    editor,
    setEditor,
    addOpen,
    setAddOpen,
    aiDismissed,
    setAiDismissed,
    done,
    toggleDone,
    actions,
    addLead,
    resetBoard,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
