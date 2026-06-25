// Client helper: poll an async media (video) publish job until it finishes.
// Each GET nudges the server state machine (poll Meta → publish when ready).

export interface JobState {
  id: string;
  kind: string;
  state: "processing" | "published" | "failed";
  resultId?: string | null;
  error?: string | null;
}

export async function pollJob(
  jobId: string,
  onUpdate: (s: JobState) => void,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<JobState> {
  const interval = opts?.intervalMs ?? 4000;
  const timeout = opts?.timeoutMs ?? 6 * 60 * 1000;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let s: JobState;
    try {
      const res = await fetch(`/api/media-jobs/${jobId}`, { cache: "no-store" });
      s = await res.json();
    } catch {
      s = { id: jobId, kind: "", state: "processing" };
    }
    onUpdate(s);
    if (s.state === "published" || s.state === "failed") return s;
    if (Date.now() - start > timeout) return s;
    await new Promise((r) => setTimeout(r, interval));
  }
}
