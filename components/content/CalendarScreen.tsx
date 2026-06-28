"use client";

import React, { useEffect, useState } from "react";
import {
  CalendarDays,
  X,
  ImagePlus,
  Wand2,
  Copy,
  Send,
  Trash2,
  PlugZap,
  Clock,
  Sparkles,
  Loader2,
  Plus,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Panel, Eyebrow, SrcChip, Chip, SectionHeader, SettingNum } from "@/components/ui/primitives";
import { SOURCES, STATUS, POST_CHANNELS, POST_GOALS, POST_STATUS, WEEKDAYS } from "@/lib/domain/constants";
import { uid, defaultSchedule, fmtWhen } from "@/lib/domain/format";
import { downscaleImage, generatePost, generateIdeas, generateContentPlan, fallbackPost, FALLBACK_IDEAS, type PlannedPost } from "@/lib/ai/generators";
import { useData } from "@/components/DataProvider";
import type { Post } from "@/lib/domain/types";

const CATEGORY_CHIP: Record<string, string> = {
  "before/after": "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  "finished job": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  tip: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  trust: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  seasonal: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  "behind the scenes": "bg-slate-700/40 text-slate-300 border-slate-600/50",
};

/* --- AI month planner: Hazel plans + writes a month of posts, done-for-you --- */
function MonthPlanner({ leads, onClose, onAdd }: { leads: any[]; onClose: () => void; onAdd: (posts: Post[]) => void }) {
  const [days, setDays] = useState(30);
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<{ cadence: string; posts: PlannedPost[] } | null>(null);

  const run = async () => {
    setLoading(true); setError(""); setPlan(null);
    try {
      const r = await generateContentPlan({ planDays: days, postsPerWeek: 3, startDate: start, leads });
      if (!r.posts.length) setError("Hazel couldn't draft a plan just now — try again.");
      else setPlan(r);
    } catch (e) {
      setError((e as Error).message || "Couldn't build a plan.");
    }
    setLoading(false);
  };

  const addAll = () => {
    if (!plan) return;
    const drafts: Post[] = plan.posts.map((pp) => ({
      id: uid(),
      photo: null,
      caption: pp.caption || "",
      hashtags: Array.isArray(pp.hashtags) ? pp.hashtags.join(" ") : "",
      channels: (pp.channels || ["facebook", "instagram"]).filter((c) => POST_CHANNELS.includes(c)),
      scheduledAt: `${pp.date}T${(pp.time || "18:00").slice(0, 5)}`,
      status: "draft",
      reach: null,
      engagement: null,
      why: pp.why || "",
      planCategory: pp.category || null,
      autoPublish: false,
    }));
    onAdd(drafts);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div><Eyebrow icon={Sparkles}>Plan my content with Hazel</Eyebrow><p className="mt-1 text-xs text-slate-500">Hazel decides what to post, writes it in your voice, and lays it on the calendar. You review, tweak and approve.</p></div>
          <button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!plan && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Plan length</p>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                    {[{ d: 14, l: "Fortnight" }, { d: 30, l: "Month" }].map((o) => (
                      <button key={o.d} onClick={() => setDays(o.d)} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${days === o.d ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Start from</p>
                  <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-xs text-slate-200 focus:border-cyan-500/50" />
                </div>
              </div>
              <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-[11px] text-slate-400">Hazel posts about <span className="text-slate-200">3×/week</span> — enough to stay visible without overwhelming your audience — mixing before/afters, finished jobs, tips, trust and seasonal posts. You don't need to plan any of it.</p>
              {error && <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-200">{error}</p>}
              <button onClick={run} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Hazel is planning + writing your posts…</> : <><Sparkles className="h-4 w-4" /> Plan {days === 14 ? "a fortnight" : "a month"} of posts</>}</button>
            </>
          )}
          {plan && (
            <>
              <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100"><Sparkles className="mr-1.5 inline h-3.5 w-3.5" />{plan.cadence}</p>
              <div className="space-y-2">
                {plan.posts.map((pp, i) => (
                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${CATEGORY_CHIP[pp.category] || CATEGORY_CHIP["behind the scenes"]}`}>{pp.category}</span>
                      {(pp.channels || []).map((c) => <SrcChip key={c} source={c} />)}
                      <span className="font-data text-[11px] text-slate-500">{pp.date} {(pp.time || "").slice(0, 5)}</span>
                      {pp.photoNeeded && <span className="text-[10px] text-amber-300">· add a photo</span>}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-300">{pp.caption}</p>
                    {pp.hashtags?.length > 0 && <p className="mt-1 font-data text-[10px] text-cyan-300/80">{pp.hashtags.join(" ")}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        {plan && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-5 py-4">
            <button onClick={() => setPlan(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800">Re-plan</button>
            <button onClick={addAll} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> Add {plan.posts.length} posts to calendar</button>
          </div>
        )}
      </div>
    </div>
  );
}

const ChannelPicker = ({ value, onToggle }: { value: string[]; onToggle: (c: string) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {POST_CHANNELS.map((c) => { const on = value.includes(c); return (
      <button key={c} onClick={() => onToggle(c)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${on ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}>{SOURCES[c].short}</button>
    ); })}
  </div>
);

/* --- Post editor --- */
function PostEditor({ post, onSave, onDelete, onClose }: { post: Post; onSave: (p: Post) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const [p, setP] = useState<Post>(post);
  const set = (k: keyof Post, v: any) => setP((s) => ({ ...s, [k]: v }));
  const toggleCh = (c: string) => setP((s) => ({ ...s, channels: s.channels.includes(c) ? s.channels.filter((x) => x !== c) : [...s.channels, c] }));
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files && e.target.files[0]; if (f) { try { set("photo", await downscaleImage(f)); } catch {} } };
  const copy = () => { try { navigator.clipboard.writeText((p.caption || "") + (p.hashtags ? "\n\n" + p.hashtags : "")); } catch {} };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><Eyebrow icon={CalendarDays}>Post</Eyebrow><button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Photo</p>
            {p.photo ? (
              <div className="relative"><img src={p.photo} alt="" className="max-h-48 w-full rounded-lg object-cover" /><button onClick={() => set("photo", null)} className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1 text-slate-300 hover:text-red-300"><X className="h-3.5 w-3.5" /></button></div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 py-6 text-sm text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"><ImagePlus className="h-4 w-4" /> Upload photo<input type="file" accept="image/*" onChange={pick} className="hidden" /></label>
            )}
          </div>
          <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Caption</p><textarea rows={4} value={p.caption} onChange={(e) => set("caption", e.target.value)} placeholder="Write the caption…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" /></div>
          <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Hashtags</p><input value={p.hashtags} onChange={(e) => set("hashtags", e.target.value)} placeholder="#goldcoastbathrooms #fixedprice" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50" /></div>
          <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Channels</p><ChannelPicker value={p.channels} onToggle={toggleCh} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Scheduled</p><input type="datetime-local" value={p.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-data text-xs text-slate-200 focus:border-cyan-500/50" /></div>
            <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Status</p>
              <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">{Object.keys(POST_STATUS).map((s) => <button key={s} onClick={() => set("status", s)} className={`flex-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition ${p.status === s ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}>{POST_STATUS[s].label}</button>)}</div>
            </div>
          </div>
          {p.status === "posted" && (
            <div className="grid grid-cols-2 gap-3">
              <SettingNum label="Reach" value={p.reach || 0} onChange={(v) => set("reach", v)} />
              <SettingNum label="Engagements" value={p.engagement || 0} onChange={(v) => set("engagement", v)} />
            </div>
          )}
          {p.planCategory && <p className="text-[11px] text-slate-500">Hazel's plan slot: <span className="text-slate-300">{p.planCategory}</span></p>}
          {p.why && <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-xs text-slate-400"><span className="text-cyan-300">Why this should perform:</span> {p.why}</p>}

          {/* Approve → auto-publish on schedule (cron + the organic publish path). */}
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
            <input type="checkbox" checked={!!p.autoPublish} onChange={(e) => set("autoPublish", e.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-500" />
            <span className="text-[11px] text-slate-400"><span className="text-slate-200">Auto-publish on schedule</span> — when this is on and the status is <span className="text-cyan-300">Scheduled</span>, Hazel posts it to your connected Facebook/Instagram at the time above. Needs Meta connected (and approved messaging/posting access); Instagram needs a photo.</span>
          </label>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-5 py-4">
          <button onClick={() => onDelete(p.id)} className="rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
          <div className="flex gap-2">
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Copy caption</button>
            <button onClick={() => { onSave(p); onClose(); }} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Send className="h-4 w-4" /> Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- AI post studio (photo -> post) --- */
function AiStudio({ leads, onClose, onSaveDraft }: { leads: any[]; onClose: () => void; onSaveDraft: (p: Post) => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>(["instagram"]);
  const [goal, setGoal] = useState<string>(POST_GOALS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [offline, setOffline] = useState(false);
  const toggleCh = (c: string) => setChannels((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files && e.target.files[0]; if (f) { try { setPhoto(await downscaleImage(f)); } catch {} } };
  const run = async () => {
    setLoading(true); setOffline(false);
    try { setResult(await generatePost({ photoDataUrl: photo, channels, goal, leads })); }
    catch { setResult(fallbackPost({ channels, goal, leads })); setOffline(true); }
    setLoading(false);
  };
  const copy = () => { try { navigator.clipboard.writeText((result.caption || "") + (result.hashtags ? "\n\n" + result.hashtags : "")); } catch {} };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><Eyebrow icon={Wand2}>AI post studio</Eyebrow><p className="mt-1 text-xs text-slate-500">Upload a finished photo → get caption, hashtags, CTA and a suggested time. </p></div><button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-4 md:grid-cols-2">
          <div className="space-y-4">
            {photo ? (
              <div className="relative"><img src={photo} alt="" className="max-h-56 w-full rounded-lg object-cover" /><button onClick={() => setPhoto(null)} className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1 text-slate-300 hover:text-red-300"><X className="h-3.5 w-3.5" /></button></div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-10 text-sm text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"><ImagePlus className="h-5 w-5" /> Upload a finished-bathroom photo<span className="text-[11px] text-slate-600">It writes the copy — it doesn't make the image</span><input type="file" accept="image/*" onChange={pick} className="hidden" /></label>
            )}
            <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Channels</p><ChannelPicker value={channels} onToggle={toggleCh} /></div>
            <div><p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Goal</p><select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50">{POST_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            <button onClick={run} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Wand2 className="h-4 w-4" /> {result ? "Regenerate" : "Generate post"}</>}</button>
          </div>
          <div className="space-y-3">
            {!result && !loading && <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-600">Your generated post will appear here.</div>}
            {result && (
              <>
                {offline && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">Offline template — open this file inside Claude for live, photo-specific copy.</p>}
                <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Caption</p><p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200">{result.caption}</p></div>
                {result.hashtags && <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Hashtags</p><p className="mt-1 rounded-lg border border-slate-800 bg-slate-950/40 p-3 font-data text-xs text-cyan-200">{result.hashtags}</p></div>}
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Call to action</p><p className="mt-1 text-sm text-slate-300">{result.cta}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Suggested time</p><p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-300"><Clock className="h-3.5 w-3.5 text-cyan-400" />{result.suggestedTime}</p></div>
                </div>
                {result.why && <p className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5 text-xs text-slate-400"><span className="text-cyan-300">Why:</span> {result.why}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /> Copy</button>
                  <button onClick={() => onSaveDraft({ id: uid(), photo, caption: result.caption || "", hashtags: result.hashtags || "", channels, scheduledAt: defaultSchedule(), status: "draft", reach: null, engagement: null, why: result.why || "" })} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> Save as draft</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Idea starters --- */
function IdeaStarters({ leads, onClose, onUseIdea }: { leads: any[]; onClose: () => void; onUseIdea: (idea: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await generateIdeas({ leads }); if (alive) setIdeas(r.length ? r : FALLBACK_IDEAS); }
      catch { if (alive) { setIdeas(FALLBACK_IDEAS); setOffline(true); } }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><Eyebrow icon={Sparkles}>Idea starters</Eyebrow><button onClick={onClose} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {loading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Thinking up ideas…</div>}
          {!loading && offline && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">Offline suggestions — open inside Claude for fresh, data-specific ideas.</p>}
          {!loading && ideas.map((idea, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-sm font-medium text-slate-200">{idea.title}</p>
              {idea.why && <p className="mt-0.5 text-xs text-slate-500">{idea.why}</p>}
              <button onClick={() => onUseIdea(idea)} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-2.5 py-1 text-xs font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-3 w-3" /> Draft this</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --- Calendar view --- */
function PostChip({ post, onClick }: { post: Post; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const c = post.channels[0] || "instagram";
  return <button onClick={onClick} className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] ${SOURCES[c]?.chip || "bg-slate-700/40 text-slate-300 border-slate-600/50"} border`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS[POST_STATUS[post.status].c].dot}`} /><span className="truncate">{post.caption || "Untitled"}</span></button>;
}

export default function CalendarScreen() {
  const { posts, setPosts, leads } = useData();
  const [tab, setTab] = useState("calendar");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editing, setEditing] = useState<Post | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const addPlanned = (drafts: Post[]) => { setPosts((prev) => [...prev, ...drafts]); setPlannerOpen(false); };
  const savePost = (np: Post) => setPosts((prev) => prev.some((x) => x.id === np.id) ? prev.map((x) => x.id === np.id ? np : x) : [...prev, np]);
  const delPost = (id: string) => { setPosts((prev) => prev.filter((p) => p.id !== id)); setEditing(null); };
  const newPost = (date?: string) => setEditing({ id: uid(), photo: null, caption: "", hashtags: "", channels: ["instagram"], scheduledAt: (date || new Date().toISOString().slice(0, 10)) + "T18:00", status: "draft", reach: null, engagement: null, why: "" });
  const useIdea = (idea: any) => { setIdeasOpen(false); setEditing({ id: uid(), photo: null, caption: idea.title || "", hashtags: "", channels: ["instagram"], scheduledAt: defaultSchedule(), status: "draft", reach: null, engagement: null, why: "" }); };

  const y = cursor.getFullYear(), m = cursor.getMonth();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = []; for (let i = 0; i < startDow; i++) cells.push(null); for (let d = 1; d <= daysIn; d++) cells.push(d);
  const dayISO = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const postsByDay = (d: number) => posts.filter((p) => (p.scheduledAt || "").slice(0, 10) === dayISO(d));
  const todayISO = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().toISOString().slice(0, 16);
  const upcoming = posts.filter((p) => p.status === "scheduled" && (p.scheduledAt || "") >= nowMin).sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || "")).slice(0, 4);
  const sortedList = posts.slice().sort((a, b) => (b.scheduledAt || "").localeCompare(a.scheduledAt || ""));

  return (
    <div className="space-y-6">
      <SectionHeader icon={CalendarDays} title="Content Calendar" desc="Plan, draft and schedule your organic posts. Publish manually for now and mark them posted." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
          <button onClick={() => setTab("calendar")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === "calendar" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}><CalendarDays className="h-3.5 w-3.5" /> Calendar</button>
          <button onClick={() => setTab("list")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === "list" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}><List className="h-3.5 w-3.5" /> List</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPlannerOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Sparkles className="h-4 w-4" /> Plan my content with Hazel</button>
          <button onClick={() => setIdeasOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"><Sparkles className="h-4 w-4 text-cyan-400" /> Idea starters</button>
          <button onClick={() => setAiOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-500/20"><Wand2 className="h-4 w-4" /> Create with AI</button>
          <button onClick={() => newPost(todayISO)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"><Plus className="h-4 w-4" /> New post</button>
        </div>
      </div>

      {upcoming.length > 0 && (
        <Panel className="p-4">
          <Eyebrow icon={Clock}>Upcoming scheduled</Eyebrow>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map((p) => (
              <button key={p.id} onClick={() => setEditing(p)} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left transition hover:border-cyan-500/40">
                <div className="flex items-center gap-1.5">{p.channels.map((c) => <SrcChip key={c} source={c} />)}</div>
                <p className="mt-1.5 line-clamp-2 text-xs text-slate-300">{p.caption || "Untitled"}</p>
                <p className="mt-1 font-data text-[11px] text-cyan-300">{fmtWhen(p.scheduledAt)}</p>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {tab === "calendar" ? (
        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-100">{cursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setCursor(new Date(y, m - 1, 1))} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-md border border-slate-700 px-2 py-1.5 text-[11px] text-slate-400 transition hover:bg-slate-800">Today</button>
              <button onClick={() => setCursor(new Date(y, m + 1, 1))} className="rounded-md border border-slate-700 p-1.5 text-slate-400 transition hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => <div key={w} className="px-1 py-1 text-center text-[10px] uppercase tracking-wider text-slate-500 font-display">{w}</div>)}
            {cells.map((d, i) => {
              if (d === null) return <div key={"e" + i} className="min-h-[84px] rounded-lg" />;
              const dp = postsByDay(d); const isToday = dayISO(d) === todayISO;
              return (
                <div key={d} onClick={() => newPost(dayISO(d))} className={`min-h-[84px] cursor-pointer rounded-lg border p-1 transition hover:border-cyan-500/40 ${isToday ? "border-cyan-500/40 bg-cyan-500/5" : "border-slate-800 bg-slate-950/40"}`}>
                  <div className={`px-1 text-[11px] font-data ${isToday ? "text-cyan-300" : "text-slate-500"}`}>{d}</div>
                  <div className="mt-0.5 space-y-0.5">
                    {dp.slice(0, 3).map((p) => <PostChip key={p.id} post={p} onClick={(e) => { e.stopPropagation(); setEditing(p); }} />)}
                    {dp.length > 3 && <p className="px-1 text-[10px] text-slate-500">+{dp.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <div className="space-y-2">
          {sortedList.length === 0 && <Panel className="p-6 text-center text-sm text-slate-500">No posts yet — create one, or generate with AI.</Panel>}
          {sortedList.map((p) => (
            <Panel key={p.id} className="p-3">
              <button onClick={() => setEditing(p)} className="flex w-full items-center gap-3 text-left">
                {p.photo ? <img src={p.photo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-600"><ImagePlus className="h-4 w-4" /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">{p.channels.map((c) => <SrcChip key={c} source={c} />)}<Chip status={POST_STATUS[p.status].c}>{POST_STATUS[p.status].label}</Chip></div>
                  <p className="mt-1 truncate text-sm text-slate-200">{p.caption || "Untitled"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-data text-[11px] text-slate-400">{fmtWhen(p.scheduledAt)}</p>
                  {p.status === "posted" && (p.reach || p.engagement) ? <p className="font-data text-[11px] text-emerald-300">{p.reach || 0} reach · {p.engagement || 0} eng</p> : null}
                </div>
              </button>
            </Panel>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-[11px] text-slate-500"><PlugZap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />Hazel can plan + write your month, then auto-publish approved posts to your connected Facebook Page & Instagram on schedule. Turn on "Auto-publish on schedule" on a Scheduled post. (Instagram needs a photo; needs Meta connected.)</div>

      {plannerOpen && <MonthPlanner leads={leads} onClose={() => setPlannerOpen(false)} onAdd={addPlanned} />}
      {editing && <PostEditor post={editing} onSave={savePost} onDelete={delPost} onClose={() => setEditing(null)} />}
      {aiOpen && <AiStudio leads={leads} onClose={() => setAiOpen(false)} onSaveDraft={(p) => { savePost(p); setAiOpen(false); }} />}
      {ideasOpen && <IdeaStarters leads={leads} onClose={() => setIdeasOpen(false)} onUseIdea={useIdea} />}
    </div>
  );
}
