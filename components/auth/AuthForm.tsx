"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogIn, UserPlus, Mail } from "lucide-react";
import { HazelLogo } from "@/components/brand/HazelLogo";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

// Email + password auth for both sign-in and sign-up. On sign-up, Supabase
// creates the auth user (the handle_new_user trigger provisions a fresh org +
// owner membership), then either signs the user straight in (if email
// confirmation is off) or emails a confirmation link to /auth/confirm.
export default function AuthForm({ mode }: { mode: Mode }) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("loading");
    setError("");
    const supabase = createClient();

    if (isSignup) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${appUrl}/auth/confirm` },
      });
      if (error) {
        setError(error.message);
        setStatus("error");
        return;
      }
      // Session present → confirmation is disabled, go straight in.
      if (data.session) {
        window.location.assign("/leads");
        return;
      }
      setStatus("sent"); // confirmation email sent
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    // Full navigation so the server picks up the new session cookie.
    window.location.assign("/leads");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <HazelLogo size={38} />
          <p className="mt-2 font-serif text-[15px] italic text-cyan-300">your best friend in marketing</p>
        </div>

        {status === "sent" ? (
          <div className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-center">
            <Mail className="mx-auto h-6 w-6 text-cyan-300" />
            <p className="mt-2 text-sm text-slate-200">Confirm your email</p>
            <p className="mt-1 text-xs text-slate-500">
              We sent a confirmation link to <span className="text-slate-300">{email}</span>. Click it to finish setting
              up your workspace.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-6 font-display text-lg font-semibold tracking-tight text-slate-100">
              {isSignup ? "Create your workspace" : "Sign in"}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {isSignup
                ? "Sign up to get your own private workspace."
                : "Welcome back. Sign in to your workspace."}
            </p>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Email</label>
                <input
                  type="email"
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-slate-500 font-display">Password</label>
                <input
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 6 characters" : "••••••••"}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
                />
              </div>
              {status === "error" && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={status === "loading" || !email.trim() || !password}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {isSignup ? "Creating…" : "Signing in…"}
                  </>
                ) : isSignup ? (
                  <>
                    <UserPlus className="h-4 w-4" /> Create workspace
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" /> Sign in
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <Link href="/login" className="text-cyan-300 transition hover:text-cyan-400">Sign in</Link>
                </>
              ) : (
                <>
                  New here?{" "}
                  <Link href="/signup" className="text-cyan-300 transition hover:text-cyan-400">Create a workspace</Link>
                </>
              )}
            </p>
          </>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-600">
          <a href="/privacy" className="transition hover:text-slate-400">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
