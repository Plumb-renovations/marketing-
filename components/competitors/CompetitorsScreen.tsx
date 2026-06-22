"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Swords, Plus, Trash2, ExternalLink, Wand2, Loader2, Copy, ArrowRight, AlertTriangle, Building2,
} from "lucide-react";
import { Panel, SectionHeader, copyText } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/DataProvider";
import { listCompetitors, upsertCompetitor, deleteCompetitor, type Competitor } from "@/lib/data/competitors";
import { adLibraryUrl, canLinkAdLibrary } from "@/lib/competitors/adLibrary";
import { generateCompetitorBeat } from "@/lib/ai/generators";
import { setComposerDraft, setAdDraft } from "@/lib/content/handoff";
import WhyTheyreWinning from "@/components/competitors/WhyTheyreWinning";

const uid = () => crypto.randomUUID();
// Ad Library country. Defaults to AU; ready to read a business-profile country
// once that field exists (for non-AU customers).
const COUNTRY = "AU";

type Beat = Awaited<ReturnType<typeof generateCompetitorBeat>>;

export default function CompetitorsScreen() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { leads } = useData();

  const [items, setItems] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setItems(await listCompetitors(supabase));
      setLoading(false);
    })();
  }, [supabase]);

  // ---- List CRUD (save on blur; delete immediately) --------------------
  const patch = (id: string, f: Partial<Competitor>) =>
    setItems((p) => p.map((c) => (c.id === id ? { ...c, ...f } : c)));

  const addRow = () =>
    setItems((p) => [...p, { id: uid(), name: "", fbUrl: "", notes: "", sortOrder: p.length }]);

  const saveRow = async (c: Competitor) => {
    if (!c.name.trim() && !c.fbUrl.trim()) return; // skip empty rows
    try {
      await upsertCompetitor(supabase, c);
    } catch (e) {
      console.error("[competitors] save failed", e);
    }
  };

  const removeRow = async (id: string) => {
    setItems((p) => p.filter((c) => c.id !== id));
    try {
      await deleteCompetitor(supabase, id);
    } catch (e) {
      console.error("[competitors] delete failed", e);
    }
  };

  const openAdLibrary = (c: Competitor) => {
    window.open(adLibraryUrl({ name: c.name, fbUrl: c.fbUrl, country: COUNTRY }), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Swords}
        title="Competitor Intelligence"
        desc="See why rivals are winning, learn from their live ads, then let Hazel write copy that out-positions them."
      />

      {/* ---------------- Section 1: Why they're winning ---------------- */}
      <WhyTheyreWinning />

      {/* ---------------- Section 2: Your competitors + paste & beat ---------------- */}
      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-100">Your competitors</h3>
            <p className="mt-0.5 text-sm text-slate-500">Add a rival's name + Facebook Page URL or @handle. “View live ads” opens their active ads in the Meta Ad Library.</p>
          </div>
          <button onClick={addRow} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Add competitor</button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No competitors yet — add your first above.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((c) => (
              <div key={c.id} className="grid grid-cols-12 items-center gap-2">
                <input
                  value={c.name}
                  onChange={(e) => patch(c.id, { name: e.target.value })}
                  onBlur={() => saveRow(c)}
                  placeholder="Business name (e.g. Kuda Bathrooms)"
                  className={inputCls + " col-span-12 sm:col-span-4"}
                />
                <input
                  value={c.fbUrl}
                  onChange={(e) => patch(c.id, { fbUrl: e.target.value })}
                  onBlur={() => saveRow(c)}
                  placeholder="facebook.com/their-page or @handle"
                  className={inputCls + " col-span-8 sm:col-span-5 font-data text-xs"}
                />
                <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => openAdLibrary(c)}
                    disabled={!canLinkAdLibrary(c)}
                    title="Open their active ads in the Meta Ad Library"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-40"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View live ads</span>
                  </button>
                  <button onClick={() => removeRow(c.id)} className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-500">Tip: the Ad Library opens to their currently-active ads in {COUNTRY}. Read their best ads, then paste them below to beat them.</p>
      </Panel>

      {/* ---------------- Paste & beat ---------------- */}
      <PasteAndBeat
        competitors={items}
        leads={leads}
        onSend={(text, format) => {
          // Follow the Format toggle: paid ad → Ad Creator; organic → composer.
          if (format === "ad") {
            setAdDraft(text);
            router.push("/ads");
          } else {
            setComposerDraft(text);
            router.push("/content");
          }
        }}
      />
    </div>
  );
}

function PasteAndBeat({
  competitors,
  leads,
  onSend,
}: {
  competitors: Competitor[];
  leads: ReturnType<typeof useData>["leads"];
  onSend: (text: string, format: "post" | "ad") => void;
}) {
  const [ads, setAds] = useState("");
  const [competitorId, setCompetitorId] = useState("");
  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [format, setFormat] = useState<"post" | "ad">("post");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Beat | null>(null);

  const run = async () => {
    if (!ads.trim()) {
      setError("Paste at least one competitor ad to analyse.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const name = competitors.find((c) => c.id === competitorId)?.name || "";
      const r = await generateCompetitorBeat({ competitorAds: ads, competitorName: name, platform, format, leads });
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Couldn't generate. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const fullCopy = (caption: string, hashtags: string[]) =>
    [caption, hashtags.length ? hashtags.join(" ") : ""].filter(Boolean).join("\n\n");
  // Button label follows where it sends (paid ad → Ad Creator; organic → composer).
  const sendLabel = format === "ad" ? "Send to ad creator" : "Send to composer";

  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-cyan-400"><Wand2 className="h-5 w-5" /></div>
        <div>
          <h3 className="font-display text-base font-semibold text-slate-100">Paste &amp; beat</h3>
          <p className="text-sm text-slate-500">Paste one or more of a competitor's ads (from the Ad Library). Hazel breaks down their angle, then writes sharper copy that out-positions them in your voice.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <textarea
          value={ads}
          onChange={(e) => setAds(e.target.value)}
          rows={6}
          placeholder={"Paste the competitor's ad copy here — one or more ads.\n\ne.g. “Transform your bathroom in 2 weeks! Book your free design consult…”"}
          className={inputCls + " w-full"}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <Lbl>Competitor (optional)</Lbl>
            <select value={competitorId} onChange={(e) => setCompetitorId(e.target.value)} className={inputCls + " mt-1"}>
              <option value="">— none / unspecified —</option>
              {competitors.filter((c) => c.name.trim()).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <Lbl>Platform</Lbl>
            <div className="mt-1 flex gap-1.5">
              {(["facebook", "instagram"] as const).map((pl) => (
                <button key={pl} onClick={() => setPlatform(pl)} className={pill(platform === pl)}>{pl === "facebook" ? "Facebook" : "Instagram"}</button>
              ))}
            </div>
          </label>
          <label className="block">
            <Lbl>Format</Lbl>
            <div className="mt-1 flex gap-1.5">
              {(["post", "ad"] as const).map((f) => (
                <button key={f} onClick={() => setFormat(f)} className={pill(format === f)}>{f === "post" ? "Organic post" : "Paid ad"}</button>
              ))}
            </div>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Analyse &amp; beat it
          </button>
          {error && <span className="inline-flex items-center gap-1.5 text-sm text-red-400"><AlertTriangle className="h-4 w-4" /> {error}</span>}
        </div>
      </div>

      {result && (
        <div className="mt-5 space-y-4 border-t border-slate-800 pt-5">
          {result.analysis.length > 0 && (
            <div>
              <Lbl>What they're doing</Lbl>
              <ul className="mt-1.5 space-y-1">
                {result.analysis.map((a: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-300"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400" /> {a}</li>
                ))}
              </ul>
            </div>
          )}
          {result.positioning && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-200"><span className="font-medium">How we win:</span> {result.positioning}</div>
          )}

          <div>
            <Lbl>Your stronger {format === "ad" ? "ad" : "post"} copy</Lbl>
            <div className="mt-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="whitespace-pre-wrap text-sm text-slate-100">{result.caption}</p>
              {result.hashtags.length > 0 && <p className="mt-2 text-sm text-cyan-300">{result.hashtags.join(" ")}</p>}
              {result.cta && <p className="mt-2 text-xs text-slate-500">CTA: {result.cta}</p>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => onSend(fullCopy(result.caption, result.hashtags), format)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
                {sendLabel} <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => copyText(fullCopy(result.caption, result.hashtags))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Copy</button>
            </div>
          </div>

          {result.variations.length > 0 && (
            <div>
              <Lbl>Alternatives</Lbl>
              <div className="mt-1.5 space-y-2">
                {result.variations.map((v: string, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <p className="whitespace-pre-wrap text-sm text-slate-300">{v}</p>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => onSend(v, format)} title={sendLabel} className="rounded-md border border-slate-700 p-1.5 text-slate-300 transition hover:border-cyan-500/50"><ArrowRight className="h-3.5 w-3.5" /></button>
                      <button onClick={() => copyText(v)} title="Copy" className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-[11px] text-slate-500"><Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" /> Copy quality leans on your Business Profile — keep your services, selling points, tone and offer up to date for sharper, more differentiated results.</p>
    </Panel>
  );
}

const inputCls = "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";
const Lbl = ({ children }: { children: React.ReactNode }) => <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{children}</span>;
const pill = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm transition ${active ? "bg-cyan-500 text-slate-950" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`;
