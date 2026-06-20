"use client";

import { useState } from "react";
import { Workflow, Loader2, Send, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Magic-link (email OTP) sign-in for staff. Leaves a clean path to add
// Google sign-in later (a second supabase.auth.signInWithOAuth button).
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError("");
    const supabase = createClient();
    // Email links are confirmed at /auth/confirm via token_hash + verifyOtp
    // (SSR-safe; works across devices). The email template must point there.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${appUrl}/auth/confirm`,
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500 text-slate-950">
            <Workflow className="h-5 w-5" />
          </div>
          <p className="font-serif text-2xl font-semibold leading-none tracking-tight text-slate-100">Hazel</p>
        </div>

        {status === "sent" ? (
          <div className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-center">
            <Mail className="mx-auto h-6 w-6 text-cyan-300" />
            <p className="mt-2 text-sm text-slate-200">Check your inbox</p>
            <p className="mt-1 text-xs text-slate-500">
              We sent a sign-in link to <span className="text-slate-300">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="mt-6 space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Work email</label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@plumbrenovations.com.au"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
              />
            </div>
            {status === "error" && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={status === "sending" || !email.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Email me a sign-in link
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-600">No password — we email you a secure magic link.</p>
          </form>
        )}
        <p className="mt-4 text-center text-[11px] text-slate-600">
          <a href="/privacy" className="transition hover:text-slate-400">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
