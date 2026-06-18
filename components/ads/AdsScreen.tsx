"use client";

import { useState } from "react";
import { X, ImagePlus, Wand2, Copy, Plus, Facebook, Search, Loader2, Trash2, Megaphone, PlugZap, Rocket } from "lucide-react";
import { Panel, Eyebrow, Chip, SectionHeader, CharCount, copyText } from "@/components/ui/primitives";
import { POST_GOALS, AD_STATUS } from "@/lib/domain/constants";
import { uid, today } from "@/lib/domain/format";
import { downscaleImage, generateMetaAd, generateGoogleAd, fallbackMetaAd, fallbackGoogleAd } from "@/lib/ai/generators";
import { useData } from "@/components/DataProvider";
import LaunchAdModal from "@/components/ads/LaunchAdModal";
import type { Ad } from "@/lib/domain/types";

/* --- Meta paid ad studio --- */
function MetaAdStudio({
  leads,
  onClose,
  onSave,
}: {
  leads: any[];
  onClose: () => void;
  onSave: (a: Ad) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [goal, setGoal] = useState(POST_GOALS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [offline, setOffline] = useState(false);
  const [aiError, setAiError] = useState("");
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files && e.target.files[0]; if (f) { try { setPhoto(await downscaleImage(f)); } catch {} } };
  const run = async () => { setLoading(true); setOffline(false); setAiError(""); try { setResult(await generateMetaAd({ photoDataUrl: photo, goal, leads })); } catch (e) { setResult(fallbackMetaAd({ goal, leads })); setOffline(true); setAiError((e as Error).message || "AI request failed"); } setLoading(false); };
  const vText = (v: any) => `${v.primaryText}\n\nHeadline: ${v.headline}\nDescription: ${v.description}\nCTA: ${v.cta}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/80" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><Eyebrow icon={Facebook}>Meta paid ad</Eyebrow><p className="mt-1 text-xs text-slate-500">Facebook / Instagram. Upload a photo + pick a goal → ad copy with 2–3 test variations. </p></div><button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 md:grid-cols-2">
          <div className="space-y-4">
            {photo ? <div className="relative"><img src={photo} alt="" className="max-h-56 w-full rounded-lg object-cover" /><button onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1 text-slate-300 hover:text-red-300"><X className="h-3.5 w-3.5" /></button></div>
              : <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-10 text-sm text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"><ImagePlus className="h-5 w-5" /> Upload the ad image<span className="text-[11px] text-slate-600">Writes copy for your image — doesn't make it</span><input type="file" accept="image/*" onChange={pick} className="hidden" /></label>}
            <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Goal</p><select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50">{POST_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            <button onClick={run} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="h-4 w-4" /> {result ? "Regenerate" : "Generate ad"}</>}</button>
            <p className="text-[11px] text-slate-500">Lengths follow Meta's recommendations: primary text ≤125, headline ≤40, link description ≤30.</p>
          </div>
          <div className="space-y-3">
            {!result && !loading && <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-600">Your ad variations will appear here.</div>}
            {offline && result && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">Showing a template — live AI was unavailable{aiError ? `: ${aiError}` : ""}.</p>}
            {result && result.variations.map((v: any, i: number) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Variation {i + 1}</span><button onClick={() => copyText(vText(v))} className="rounded-md border border-slate-700 p-1 text-slate-400 transition hover:text-cyan-300"><Copy className="h-3 w-3" /></button></div>
                <div><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-slate-500">Primary text</p><CharCount s={v.primaryText} max={125} /></div><p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-200">{v.primaryText}</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-slate-500">Headline</p><CharCount s={v.headline} max={40} /></div><p className="mt-0.5 text-sm text-slate-200">{v.headline}</p></div>
                  <div><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-slate-500">Description</p><CharCount s={v.description} max={30} /></div><p className="mt-0.5 text-sm text-slate-200">{v.description}</p></div>
                </div>
                <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-slate-500">Button</span><Chip status="cyan">{v.cta}</Chip></div>
              </div>
            ))}
            {result && <button onClick={() => onSave({ id: uid(), type: "meta", goal, photo, status: "draft", createdAt: today(), content: { variations: result.variations } })} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> Save as draft</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Google ads studio --- */
function GoogleAdStudio({
  leads,
  onClose,
  onSave,
}: {
  leads: any[];
  onClose: () => void;
  onSave: (a: Ad) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [goal, setGoal] = useState(POST_GOALS[0]);
  const [loading, setLoading] = useState(false);
  const [r, setR] = useState<any>(null);
  const [offline, setOffline] = useState(false);
  const [aiError, setAiError] = useState("");
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files && e.target.files[0]; if (f) { try { setPhoto(await downscaleImage(f)); } catch {} } };
  const run = async () => { setLoading(true); setOffline(false); setAiError(""); try { setR(await generateGoogleAd({ photoDataUrl: photo, goal, leads })); } catch (e) { setR(fallbackGoogleAd({ photoDataUrl: photo })); setOffline(true); setAiError((e as Error).message || "AI request failed"); } setLoading(false); };
  const allText = (g: any) => [
    "HEADLINES:", ...g.headlines.map((h: string) => "• " + h), "", "DESCRIPTIONS:", ...g.descriptions.map((d: string) => "• " + d), "",
    "Keywords: " + g.keywords.join(", "), "Negative keywords: " + g.negatives.join(", "), "Callouts: " + g.callouts.join(", "),
    "Sitelinks:", ...g.sitelinks.map((s: any) => "• " + s.text + (s.description ? " — " + s.description : "")),
    ...(g.pmax ? ["", "PERFORMANCE MAX:", "Short headlines: " + g.pmax.shortHeadlines.join(" | "), "Long headline: " + g.pmax.longHeadline, "Descriptions:", ...g.pmax.descriptions.map((d: string) => "• " + d)] : []),
  ].join("\n");
  const okH = r ? r.headlines.filter((h: string) => h.length <= 30).length : 0;
  const okD = r ? r.descriptions.filter((d: string) => d.length <= 90).length : 0;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/80" />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><Eyebrow icon={Search}>Google Ads</Eyebrow><p className="mt-1 text-xs text-slate-500">Responsive Search Ad + keywords, negatives and extensions. Add a photo for Performance Max assets. </p></div><button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Goal</p><select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50">{POST_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            {photo ? <div className="relative"><img src={photo} alt="" className="max-h-40 w-full rounded-lg object-cover" /><button onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1 text-slate-300 hover:text-red-300"><X className="h-3.5 w-3.5" /></button></div>
              : <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 px-3 py-6 text-xs text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"><ImagePlus className="h-4 w-4" /> Optional: photo for PMax assets<input type="file" accept="image/*" onChange={pick} className="hidden" /></label>}
            <button onClick={run} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="h-4 w-4" /> {r ? "Regenerate" : "Generate ad"}</>}</button>
            <p className="text-[11px] text-slate-500">Hard limits enforced: headlines ≤30 chars, descriptions ≤90 chars. Over-limit items are flagged red.</p>
          </div>
          <div className="space-y-4">
            {!r && !loading && <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-600">Your RSA, keywords and extensions will appear here.</div>}
            {offline && r && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">Showing a template — live AI was unavailable{aiError ? `: ${aiError}` : ""}.</p>}
            {r && (
              <>
                <div>
                  <div className="flex items-center justify-between"><Eyebrow>Headlines</Eyebrow><span className="font-data text-[10px] text-slate-500">{okH}/{r.headlines.length} ≤30</span></div>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">{r.headlines.map((h: string, i: number) => <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1"><span className="truncate text-xs text-slate-200">{h}</span><CharCount s={h} max={30} /></div>)}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between"><Eyebrow>Descriptions</Eyebrow><span className="font-data text-[10px] text-slate-500">{okD}/{r.descriptions.length} ≤90</span></div>
                  <div className="mt-2 space-y-1">{r.descriptions.map((d: string, i: number) => <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1"><span className="text-xs text-slate-200">{d}</span><CharCount s={d} max={90} /></div>)}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Eyebrow>Keywords</Eyebrow><div className="mt-2 flex flex-wrap gap-1.5">{r.keywords.map((k: string, i: number) => <span key={i} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[11px] text-emerald-200">{k}</span>)}</div></div>
                  <div><Eyebrow>Negatives</Eyebrow><div className="mt-2 flex flex-wrap gap-1.5">{r.negatives.map((k: string, i: number) => <span key={i} className="rounded-md border border-red-500/20 bg-red-500/5 px-2 py-0.5 text-[11px] text-red-200">{k}</span>)}</div></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Eyebrow>Callouts</Eyebrow><div className="mt-2 flex flex-wrap gap-1.5">{r.callouts.map((c: string, i: number) => <span key={i} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">{c}</span>)}</div></div>
                  <div><Eyebrow>Sitelinks</Eyebrow><ul className="mt-2 space-y-1">{r.sitelinks.map((s: any, i: number) => <li key={i} className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-300"><span className="text-slate-100">{s.text}</span>{s.description ? <span className="text-slate-500"> — {s.description}</span> : null}</li>)}</ul></div>
                </div>
                {r.pmax && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <Eyebrow icon={ImagePlus}>Performance Max / Display assets</Eyebrow>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Short headlines (≤30)</p><div className="mt-1 space-y-1">{r.pmax.shortHeadlines.map((h: string, i: number) => <div key={i} className="flex items-center justify-between"><span className="truncate text-xs text-slate-200">{h}</span><CharCount s={h} max={30} /></div>)}</div></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Long headline (≤90)</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-slate-200">{r.pmax.longHeadline}</span><CharCount s={r.pmax.longHeadline} max={90} /></div><p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Descriptions (≤90)</p><div className="mt-1 space-y-1">{r.pmax.descriptions.map((d: string, i: number) => <div key={i} className="flex items-center justify-between"><span className="text-xs text-slate-200">{d}</span><CharCount s={d} max={90} /></div>)}</div></div>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => copyText(allText(r))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Copy all</button>
                  <button onClick={() => onSave({ id: uid(), type: "google", goal, photo, status: "draft", createdAt: today(), content: r })} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> Save as draft</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Saved ad viewer --- */
function AdViewer({
  ad,
  onClose,
  onStatus,
  onDelete,
  onLaunch,
}: {
  ad: Ad;
  onClose: () => void;
  onStatus: (id: string, s: string) => void;
  onDelete: (id: string) => void;
  onLaunch: (ad: Ad) => void;
}) {
  const g = ad.content;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/80" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2"><Chip status={ad.type === "meta" ? "indigo" : "sky"}>{ad.type === "meta" ? "Meta" : "Google"}</Chip><span className="text-xs text-slate-500">{ad.goal} · {ad.createdAt}</span></div>
          <button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {ad.photo && <img src={ad.photo} alt="" className="max-h-48 w-full rounded-lg object-cover" />}
          {ad.type === "meta" ? g.variations.map((v: any, i: number) => (
            <div key={i} className="space-y-1 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Variation {i + 1}</span><button onClick={() => copyText(`${v.primaryText}\n\nHeadline: ${v.headline}\nDescription: ${v.description}\nCTA: ${v.cta}`)} className="rounded-md border border-slate-700 p-1 text-slate-400 transition hover:text-cyan-300"><Copy className="h-3 w-3" /></button></div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{v.primaryText}</p>
              <p className="text-xs text-slate-400">{v.headline} · {v.description} · <span className="text-cyan-300">{v.cta}</span></p>
            </div>
          )) : (
            <div className="space-y-3">
              <div><Eyebrow>Headlines</Eyebrow><div className="mt-1 flex flex-wrap gap-1.5">{g.headlines.map((h: string, i: number) => <span key={i} className="rounded-md border border-slate-800 bg-slate-950/40 px-2 py-0.5 text-xs text-slate-200">{h}</span>)}</div></div>
              <div><Eyebrow>Descriptions</Eyebrow><ul className="mt-1 space-y-1">{g.descriptions.map((d: string, i: number) => <li key={i} className="text-xs text-slate-300">• {d}</li>)}</ul></div>
              <div className="grid gap-2 sm:grid-cols-2 text-xs text-slate-400"><div><span className="text-slate-500">Keywords:</span> {g.keywords.join(", ")}</div><div><span className="text-slate-500">Negatives:</span> {g.negatives.join(", ")}</div></div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4">
          <button onClick={() => onDelete(ad.id)} className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">{Object.keys(AD_STATUS).map((s) => <button key={s} onClick={() => onStatus(ad.id, s)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition ${ad.status === s ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{AD_STATUS[s].label}</button>)}</div>
            {ad.type === "meta" && <button onClick={() => onLaunch(ad)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-medium text-slate-950 transition hover:bg-cyan-400"><Rocket className="h-3.5 w-3.5" /> Launch</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Ad Creator view --- */
export default function AdsScreen() {
  const { ads, setAds, leads } = useData();
  const [studio, setStudio] = useState<"meta" | "google" | null>(null);
  const [viewing, setViewing] = useState<Ad | null>(null);
  const [launching, setLaunching] = useState<Ad | null>(null);
  const saveAd = (a: Ad) => { setAds((prev) => [a, ...prev]); setStudio(null); };
  const setStatus = (id: string, s: string) => setAds((prev) => prev.map((a) => a.id === id ? { ...a, status: s } : a));
  const delAd = (id: string) => { setAds((prev) => prev.filter((a) => a.id !== id)); setViewing(null); };
  const preview = (a: Ad) => a.type === "meta" ? (a.content.variations[0]?.headline || a.content.variations[0]?.primaryText || "Meta ad") : (a.content.headlines[0] || "Search ad");

  return (
    <div className="space-y-6">
      <SectionHeader icon={Megaphone} title="Ad Creator" desc="Generate ready-to-use paid ad copy, built to turn clicks into enquiries. Save drafts, then paste into Meta or Google." />
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setStudio("meta")} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-500/20"><Facebook className="h-4 w-4" /> Create Meta ad</button>
        <button onClick={() => setStudio("google")} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-500/20"><Search className="h-4 w-4" /> Create Google ad</button>
      </div>

      <div>
        <Eyebrow icon={Wand2}>Ad drafts</Eyebrow>
        <div className="mt-3 space-y-2">
          {ads.length === 0 && <Panel className="p-6 text-center text-sm text-slate-500">No ad drafts yet — create a Meta or Google ad above.</Panel>}
          {ads.map((a) => (
            <Panel key={a.id} className="p-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewing(a)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {a.photo ? <img src={a.photo} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-600">{a.type === "meta" ? <Facebook className="h-4 w-4" /> : <Search className="h-4 w-4" />}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><Chip status={a.type === "meta" ? "indigo" : "sky"}>{a.type === "meta" ? "Meta" : "Google"}</Chip><span className="text-[11px] text-slate-500">{a.goal}</span></div>
                    <p className="mt-1 truncate text-sm text-slate-200">{preview(a)}</p>
                  </div>
                </button>
                <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className="shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500/50">{Object.keys(AD_STATUS).map((s) => <option key={s} value={s}>{AD_STATUS[s].label}</option>)}</select>
              </div>
            </Panel>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-500"><PlugZap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />Generating the copy works now — paste it into Meta Ads Manager or Google Ads. Later (in Claude Code): push campaigns and pull performance via the Meta Marketing and Google Ads APIs.</div>

      {studio === "meta" && <MetaAdStudio leads={leads} onClose={() => setStudio(null)} onSave={saveAd} />}
      {studio === "google" && <GoogleAdStudio leads={leads} onClose={() => setStudio(null)} onSave={saveAd} />}
      {viewing && <AdViewer ad={viewing} onClose={() => setViewing(null)} onStatus={setStatus} onDelete={delAd} onLaunch={(a) => { setViewing(null); setLaunching(a); }} />}
      {launching && <LaunchAdModal ad={launching} onClose={() => setLaunching(null)} />}
    </div>
  );
}
