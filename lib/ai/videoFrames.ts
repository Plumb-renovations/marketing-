// Client-side video frame sampling for the AI creative reviewer. We can't send
// full motion to the vision model, so we sample a handful of frames (weighted to
// the opening seconds, where a feed video lives or dies) + a poster/first frame
// and let Hazel judge those. Honest by construction: it's sampled frames, not
// full playback.

export interface VideoFrames {
  frames: string[]; // base64 JPEG data URLs, in time order
  times: number[]; // the timestamps (seconds) each frame was taken at
  poster: string; // first usable frame (also the ad/Reel thumbnail)
  durationSec: number;
}

function drawFrame(video: HTMLVideoElement, maxDim = 1024, quality = 0.7): string {
  let w = video.videoWidth || 720;
  let h = video.videoHeight || 1280;
  if (Math.max(w, h) > maxDim) {
    const r = maxDim / Math.max(w, h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

const seekTo = (video: HTMLVideoElement, t: number) =>
  new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = t;
  });

export function sampleVideoFrames(file: File, maxFrames = 5): Promise<VideoFrames> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onerror = () => {
      cleanup();
      reject(new Error("Couldn't read that video. Use an MP4 or MOV file."));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        // Weight toward the opening seconds (the hook), then spread across.
        const candidates = [0.2, 1, 2, 3, 5, 8].filter((t) => duration === 0 || t < duration);
        const times = (candidates.length ? candidates : [0]).slice(0, maxFrames);

        const frames: string[] = [];
        for (const t of times) {
          await seekTo(video, t);
          frames.push(drawFrame(video));
        }
        cleanup();
        if (!frames.length) return reject(new Error("Couldn't read any frames from that video."));
        resolve({ frames, times, poster: frames[0], durationSec: Math.round(duration) });
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error("Video frame sampling failed."));
      }
    };
  });
}
