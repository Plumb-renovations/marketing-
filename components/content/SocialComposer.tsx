"use client";

import { useEffect, useState } from "react";
import { Wand2, Loader2, Send, CheckCircle2, AlertTriangle, Facebook, Instagram } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import { useData } from "@/components/DataProvider";
import { generatePost, fallbackPost } from "@/lib/ai/generators";
import { takeComposerDraft } from "@/lib/content/handoff";
import { pollJob } from "@/lib/media/pollJob";
import { POST_GOALS } from "@/lib/domain/constants";
import CreativeReviewer, { type SelectedMedia } from "@/components/ads/CreativeReviewer";

type PResult = { status: "published" | "failed" | "pending" | "processing"; id?: string; jobId?: string; error?: string; note?: string };

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "instagram", label: "Instagram", icon: Instagram },
] as const;

export default function SocialComposer() {
  const { leads } = useData();
  const [caption, setCaption] = useState("");
  // The composer's media now comes from the SAME creative reviewer used in the
  // Ad Creator (organic context) — so an organic photo/video gets a verdict too.
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [goal, setGoal] = useState(POST_GOALS[0]);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Record<string, PResult> | null>(null);
  const [error, setError] = useState("");

  // Pick up copy handed off from elsewhere (e.g. Competitor Intelligence).
  useEffect(() => {
    const draft = takeComposerDraft();
    if (draft) setCaption(draft);
  }, []);

  const togglePlatform = (id: string) =>
    setPlatforms((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // The image the caption writer looks at — the photo itself, or a video's poster.
  const photoForCaption = media?.type === "image" ? media.imageDataUrl ?? null : media?.posterDataUrl ?? null;

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const r = await generatePost({ photoDataUrl: photoForCaption, channels: platforms.length ? platforms : ["facebook"], goal, leads });
      setCaption([r.caption, r.hashtags].filter(Boolean).join("\n\n"));
    } catch {
      const r = fallbackPost({ channels: platforms, goal, leads });
      setCaption([r.caption, r.hashtags].filter(Boolean).join("\n\n"));
      setError("Live AI was unavailable — used a template you can edit.");
    } finally {
      setGenerating(false);
    }
  };

  const hasMedia = !!media;
  const igWithoutMedia = platforms.includes("instagram") && !hasMedia;

  const publish = async () => {
    setPublishing(true);
    setError("");
    setResults(null);
    try {
      let imageUrl: string | null = null;
      const videoUrl = media?.type === "video" ? media.videoUrl || null : null;

      if (media?.type === "image" && media.imageDataUrl) {
        const up = await fetch("/api/posts/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl: media.imageDataUrl }),
        });
        const ub = await up.json();
        if (!up.ok) {
          setError(ub?.message || "Image upload failed.");
          return;
        }
        imageUrl = ub.url;
      }

      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, imageUrl, videoUrl, platforms }),
      });
      const data = await res.json();
      if (res.status === 412) {
        setError(data?.message || "Meta isn't connected. Connect a Page in Settings → Integrations.");
        return;
      }
      if (!res.ok && !data?.platform_results) {
        setError(data?.message || data?.error || `Failed (${res.status})`);
        return;
      }
      const initial: Record<string, PResult> = data.platform_results || {};
      setResults(initial);

      // Video: each platform returns a job to poll until published/failed.
      for (const [platform, r] of Object.entries(initial)) {
        if (r.jobId) {
          pollJob(r.jobId, (s) => {
            setResults((prev) => ({
              ...(prev || {}),
              [platform]: {
                ...(prev?.[platform] || {}),
                status: s.state === "published" ? "published" : s.state === "failed" ? "failed" : "processing",
                id: s.resultId || prev?.[platform]?.id,
                error: s.error || undefined,
              },
            }));
          });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setPublishing(false);
    }
  };

  const fieldCls = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50";

  return (
    <div className="space-y-6">
      <SectionHeader icon={Send} title="Compose a post" desc="Write or AI-generate a caption, add a photo or video — Hazel reviews it — then publish to your connected accounts." />

      <Panel className="p-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left: caption + AI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Caption</label>
              <div className="flex items-center gap-2">
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 focus:border-cyan-500/50">
                  {POST_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <button onClick={generate} disabled={generating} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50">
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} AI generate
                </button>
              </div>
            </div>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={9} placeholder="Write your post, or hit AI generate…" className={fieldCls} />
          </div>

          {/* Right: media (reviewed) + platforms */}
          <div className="space-y-4">
            <CreativeReviewer context="organic" onMedia={setMedia} />

            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Publish to</label>
              <div className="mt-1.5 flex gap-2">
                {PLATFORMS.map((pl) => {
                  const on = platforms.includes(pl.id);
                  const Icon = pl.icon;
                  return (
                    <button key={pl.id} onClick={() => togglePlatform(pl.id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${on ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200" : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
                      <Icon className="h-4 w-4" /> {pl.label}
                    </button>
                  );
                })}
              </div>
              {igWithoutMedia && (
                <p className="mt-2 text-[11px] text-amber-300">Instagram requires a photo or video — add one above before publishing.</p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {results && (
          <div className="mt-4 space-y-2">
            {Object.entries(results).map(([platform, r]) => (
              <div key={platform} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${r.status === "published" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : r.status === "processing" || r.status === "pending" ? "border-amber-500/30 bg-amber-500/5 text-amber-200" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
                {r.status === "published" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : r.status === "processing" ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span className="capitalize">{platform}: {r.status === "published" ? `published${r.id ? ` (${r.id})` : ""}` : r.status === "processing" ? (r.note || "processing…") : r.status === "pending" ? r.note : r.error}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end border-t border-slate-800 pt-4">
          <button
            onClick={publish}
            disabled={publishing || !platforms.length || (!caption.trim() && !hasMedia)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish now
          </button>
        </div>
      </Panel>
    </div>
  );
}
