"use client";

import { useEffect, useState } from "react";
import {
  ImagePlus, Film, X, Loader2, Crown, Check, AlertTriangle, Wrench,
  Sparkles, RefreshCw, BarChart3, Eye,
} from "lucide-react";
import { Chip } from "@/components/ui/primitives";
import { downscaleImage } from "@/lib/ai/generators";
import { sampleVideoFrames } from "@/lib/ai/videoFrames";
import {
  reviewCreatives, reviewVideoCreative, refreshCreativePerformance,
  type CreativeReview, type CreativeVerdictImage, type ReviewContext,
} from "@/lib/ai/creativeReview";

const MAX = 4;

// Strong/OK/Weak — colour is shared; wording flexes for paid vs organic context.
function verdictMeta(verdict: string, organic: boolean): { status: string; label: string } {
  if (verdict === "strong") return { status: "emerald", label: organic ? "Strong — feed-stopping" : "Strong scroll-stopper" };
  if (verdict === "weak") return { status: "red", label: organic ? "Weak — gets scrolled past" : "Weak — likely scrolled past" };
  return { status: "amber", label: "OK — won't stand out" };
}

export interface SelectedMedia {
  type: "image" | "video";
  imageDataUrl?: string | null;
  videoUrl?: string; // public URL (video, after upload)
  posterDataUrl?: string; // first frame — ad/Reel thumbnail + copy reference
  durationSec?: number;
  description?: string; // what the reviewer saw — fed to the Ad Creator
  keyPoints?: string[]; // selling points to lead with — fed to the Ad Creator
}

interface VideoState {
  previewUrl: string;
  poster: string;
  frames: string[];
  times: number[];
  durationSec: number;
  videoUrl: string | null;
  uploading: boolean;
  uploadError: string;
}

// Hazel's AI creative director: judges the actual ad photo(s) OR a video BEFORE
// spend, and learns which styles really perform for this account. The chosen
// media is handed back to the studio via onMedia.
export default function CreativeReviewer({ onMedia, context = "paid" }: { onMedia: (m: SelectedMedia | null) => void; context?: ReviewContext }) {
  const organic = context === "organic";
  const [candidates, setCandidates] = useState<string[]>([]); // image data URLs
  const [video, setVideo] = useState<VideoState | null>(null);
  const [review, setReview] = useState<CreativeReview | null>(null);
  const [leadIndex, setLeadIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Keep the studio's media in sync with the selection — including the reviewer's
  // description + key points for the chosen item, so the Ad Creator writes copy
  // about the real creative.
  useEffect(() => {
    const extras = (i: number) => {
      const v = review?.images.find((im) => im.index === i);
      return v ? { description: v.description, keyPoints: v.keyPoints } : {};
    };
    if (video) {
      onMedia(video.videoUrl ? { type: "video", videoUrl: video.videoUrl, posterDataUrl: video.poster, durationSec: video.durationSec, ...extras(0) } : null);
      return;
    }
    const idx = leadIndex != null ? leadIndex : candidates.length === 1 ? 0 : null;
    const url = idx != null ? candidates[idx] : null;
    onMedia(url ? { type: "image", imageDataUrl: url, ...extras(idx as number) } : null);
  }, [candidates, leadIndex, video, review, onMedia]);

  const reset = () => { setReview(null); setLeadIndex(null); setError(""); setSyncMsg(""); };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const vid = files.find((f) => f.type.startsWith("video/"));
    if (vid) { await handleVideo(vid); return; }
    // images
    const room = MAX - candidates.length;
    const next: string[] = [];
    for (const f of files.filter((f) => f.type.startsWith("image/")).slice(0, room)) {
      try { next.push(await downscaleImage(f)); } catch {}
    }
    if (next.length) { setVideo(null); setCandidates((p) => [...p, ...next]); reset(); }
  };

  const handleVideo = async (file: File) => {
    reset();
    setCandidates([]);
    setVideo(null);
    let sampled;
    try {
      sampled = await sampleVideoFrames(file);
    } catch (err) {
      setError((err as Error).message || "Couldn't read that video.");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setVideo({ previewUrl, poster: sampled.poster, frames: sampled.frames, times: sampled.times, durationSec: sampled.durationSec, videoUrl: null, uploading: true, uploadError: "" });
    // Upload the raw file → public URL (needed for publishing; reuses post-media).
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/posts/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Upload failed");
      setVideo((v) => (v ? { ...v, videoUrl: data.url, uploading: false } : v));
    } catch (err) {
      setVideo((v) => (v ? { ...v, uploading: false, uploadError: (err as Error).message || "Upload failed" } : v));
    }
  };

  const removeImage = (i: number) => { setCandidates((p) => p.filter((_, idx) => idx !== i)); reset(); };
  const removeVideo = () => { if (video) URL.revokeObjectURL(video.previewUrl); setVideo(null); reset(); };

  const run = async () => {
    setLoading(true); setError(""); setSyncMsg("");
    try {
      if (video) {
        const r = await reviewVideoCreative(video.frames, video.times, video.durationSec, context);
        setReview(r);
        setLeadIndex(0);
      } else if (candidates.length) {
        const r = await reviewCreatives(candidates, context);
        setReview(r);
        setLeadIndex(Math.min(Math.max(0, r.leadWith?.index ?? 0), candidates.length - 1));
      }
    } catch (e) {
      setError((e as Error).message || "Creative review failed");
    }
    setLoading(false);
  };

  const sync = async () => {
    setSyncing(true); setSyncMsg("");
    try {
      const res = await refreshCreativePerformance();
      if (res.ok && res.updated > 0) {
        setSyncMsg(`Pulled real results for ${res.updated} item${res.updated !== 1 ? "s" : ""}.`);
        await run();
      } else {
        const reasons: Record<string, string> = {
          meta_not_connected: "Connect Meta in Settings → Integrations first.",
          no_published_ads: "No ads have been launched from Hazel yet.",
          no_results_yet: "Launched ads haven't gathered results yet.",
          no_image_ads: "No launched ads have media to match.",
        };
        setSyncMsg(reasons[res.reason || ""] || "No new results yet.");
      }
    } catch {
      setSyncMsg("Couldn't refresh results.");
    }
    setSyncing(false);
  };

  const byIndex = (i: number): CreativeVerdictImage | undefined => review?.images.find((im) => im.index === i);
  const thumbFor = (i: number) => (video ? video.poster : candidates[i]);
  const order = video ? [0] : review?.ranking?.length ? review.ranking.filter((i) => i < candidates.length) : candidates.map((_, i) => i);
  const hasMedia = !!video || candidates.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">Ad media</p>

        {/* Video preview */}
        {video && (
          <div className="mb-3 space-y-2">
            <div className="relative overflow-hidden rounded-lg border border-slate-700">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={video.previewUrl} poster={video.poster} controls className="max-h-56 w-full bg-black object-contain" />
              <button onClick={removeVideo} className="absolute right-2 top-2 rounded-md bg-slate-950/80 p-1 text-slate-300 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-[11px] text-slate-500">
              {video.uploading ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Uploading video…</span>
                : video.uploadError ? <span className="text-red-300">Upload failed: {video.uploadError}</span>
                : <span className="text-emerald-300">Video ready · {video.durationSec || "?"}s</span>}
            </p>
          </div>
        )}

        {/* Image candidate thumbnails */}
        {!video && candidates.length > 0 && (
          <div className="mb-3 grid grid-cols-4 gap-2">
            {candidates.map((url, i) => {
              const v = byIndex(i);
              const isLead = leadIndex === i;
              return (
                <button key={i} type="button" onClick={() => setLeadIndex(i)} className={`group relative overflow-hidden rounded-lg border ${isLead ? "border-cyan-400 ring-1 ring-cyan-400/40" : "border-slate-700"}`} title={candidates.length > 1 ? "Use as the ad's lead image" : undefined}>
                  <img src={url} alt="" className="aspect-square w-full object-cover" />
                  {v && <span className={`absolute left-1 top-1 h-2.5 w-2.5 rounded-full ${v.verdict === "strong" ? "bg-emerald-400" : v.verdict === "ok" ? "bg-amber-400" : "bg-red-400"}`} />}
                  {isLead && <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-cyan-500 px-1 text-[9px] font-semibold text-slate-950"><Crown className="h-2.5 w-2.5" /> Lead</span>}
                  <span onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute right-1 top-1 rounded bg-slate-950/80 p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-300"><X className="h-3 w-3" /></span>
                </button>
              );
            })}
          </div>
        )}

        {/* Uploader */}
        {!video && candidates.length < MAX && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 px-3 py-6 text-sm text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300">
            <span className="flex items-center gap-2"><ImagePlus className="h-5 w-5" /> / <Film className="h-5 w-5" /></span>
            {candidates.length ? "Add another photo to compare" : "Upload photo(s) or a video"}
            <span className="text-[11px] text-slate-600">{organic ? "Hazel judges how it'll land on your feed/profile" : "Hazel judges scroll-stopping power before you spend"} · photos up to {MAX}, or one MP4/MOV</span>
            <input type="file" accept="image/*,video/mp4,video/quicktime" multiple onChange={pick} className="hidden" />
          </label>
        )}
      </div>

      {hasMedia && (
        <button onClick={run} disabled={loading || (!!video && !video.videoUrl && video.uploading)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Hazel is judging your {video ? "video" : candidates.length > 1 ? "photos" : "photo"}…</>
            : <><Eye className="h-4 w-4" /> {review ? "Re-review" : video ? "Review video with AI" : `Review ${candidates.length > 1 ? "& rank " : ""}with AI`}</>}
        </button>
      )}

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-200">{error}</p>}

      {review?.learned && (
        <p className="flex items-start gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-100">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" /><span><span className="font-semibold">What works for you:</span> {review.learned}</span>
        </p>
      )}

      {review && !video && candidates.length > 1 && review.leadWith?.why && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">
          <Crown className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><span><span className="font-semibold">Lead with image {(review.leadWith.index ?? 0) + 1}.</span> {review.leadWith.why}</span>
        </p>
      )}

      {/* Verdict cards */}
      {review && order.map((i, rank) => {
        const v = byIndex(i);
        if (!v) return null;
        const meta = verdictMeta(v.verdict, organic);
        const actual = review.actuals[i];
        return (
          <div key={i} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-center gap-3">
              <img src={thumbFor(i)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {!video && candidates.length > 1 && <span className="text-[11px] text-slate-500">#{rank + 1}</span>}
                  {video && <Chip status="indigo">Video</Chip>}
                  <Chip status={meta.status}>{meta.label}</Chip>
                  <span className="font-data text-xs text-slate-400">{v.score}/100</span>
                  <Chip status="slate">{v.style}</Chip>
                  <Chip status="slate">{v.confidence} confidence</Chip>
                </div>
                <p className="mt-1 text-sm text-slate-200">{v.gut}</p>
              </div>
            </div>

            {v.reasons?.length > 0 && (
              <div className="space-y-1">
                {v.reasons.map((r, ri) => (
                  <div key={ri} className="flex items-start gap-2 text-xs">
                    {r.rating === "good" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    <span className="text-slate-300"><span className="text-slate-400">{r.factor}:</span> {r.note}</span>
                  </div>
                ))}
              </div>
            )}

            {v.fixes?.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-display"><Wrench className="h-3 w-3" /> Make it stronger</p>
                <ul className="space-y-1">{v.fixes.map((f, fi) => <li key={fi} className="text-xs text-slate-200">• {f}</li>)}</ul>
                {v.wow && <p className="mt-1.5 text-[11px] text-cyan-200">Biggest lift: {v.wow}</p>}
              </div>
            )}

            {actual && (
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
                <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-cyan-300 font-display"><BarChart3 className="h-3 w-3" /> Predicted vs actual</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-300">
                  <span>Real CTR: <span className="font-data text-slate-100">{actual.ctr}%</span></span>
                  {actual.costPerLead != null && <span>Cost/lead: <span className="font-data text-slate-100">${actual.costPerLead}</span></span>}
                  <span>Leads: <span className="font-data text-slate-100">{actual.leads}</span></span>
                  <span className="text-slate-500">across {actual.adsCount} ad{actual.adsCount !== 1 ? "s" : ""}</span>
                </div>
                {actual.predictedVerdict && <p className="mt-0.5 text-[10px] text-slate-500">Hazel predicted: {actual.predictedVerdict} ({actual.predictedScore}/100)</p>}
              </div>
            )}
          </div>
        );
      })}

      {review && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800 disabled:opacity-50">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Update from real results
          </button>
          {syncMsg && <span className="text-[11px] text-slate-500">{syncMsg}</span>}
        </div>
      )}

      {review?.note && <p className="text-[10px] text-slate-600">{review.note}</p>}
    </div>
  );
}
