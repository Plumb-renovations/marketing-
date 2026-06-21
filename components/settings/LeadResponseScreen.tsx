"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap, Loader2, Save, CheckCircle2, MessageSquare, Mail, BellRing, Phone, AlertTriangle } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";
import { fetchLeadResponseSettings, saveLeadResponseSettings } from "@/lib/data/leadResponse";
import { DEFAULT_RESPONSE_SETTINGS, type LeadResponseSettings } from "@/lib/leads/responseSettings";

export default function LeadResponseScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [s, setS] = useState<LeadResponseSettings>(DEFAULT_RESPONSE_SETTINGS);
  const [config, setConfig] = useState<{ sms: boolean; email: boolean }>({ sms: false, email: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [settings, cfg] = await Promise.all([
          fetchLeadResponseSettings(supabase),
          fetch("/api/leads/response-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ sms: false, email: false })),
        ]);
        setS(settings);
        setConfig({ sms: !!cfg.sms, email: !!cfg.email });
      } catch {
        setError("Couldn't load lead-response settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const set = <K extends keyof LeadResponseSettings>(k: K, v: LeadResponseSettings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await saveLeadResponseSettings(supabase, s);
      setSaved(true);
    } catch {
      setError("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader icon={Zap} title="Speed to Lead" desc="Respond to every new lead instantly so none go cold." />

      {/* Channel availability */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChannelState ok={config.sms} icon={MessageSquare} label="SMS (Twilio)" hint="Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM to enable texts." />
        <ChannelState ok={config.email} icon={Mail} label="Email (Resend)" hint="Set RESEND_API_KEY (and LEAD_FROM_EMAIL) to enable emails." />
      </div>

      <Panel className="p-5 space-y-5">
        <p className="text-sm font-medium text-slate-200">Auto-reply to the lead</p>
        <div className="flex flex-wrap gap-4">
          <Toggle label="Send SMS" checked={s.replySmsEnabled} onChange={(v) => set("replySmsEnabled", v)} />
          <Toggle label="Send email" checked={s.replyEmailEnabled} onChange={(v) => set("replyEmailEnabled", v)} />
        </div>
        <Area
          label="Message"
          hint="Use {name} and {business}. Business name comes from your Business Profile."
          value={s.replyMessage}
          onChange={(v) => set("replyMessage", v)}
          placeholder={"Hi {name}, thanks for contacting {business}! When's a good time to call you back — morning, afternoon or evening? (or reply with a time that suits)"}
        />
        <p className="-mt-2 text-[11px] text-slate-500">Leave blank to use the default above. An opt-out line is always appended.</p>
      </Panel>

      <Panel className="p-5 space-y-5">
        <p className="text-sm font-medium text-slate-200">Staff &ldquo;call now&rdquo; alert</p>
        <div className="flex flex-wrap gap-4">
          <Toggle label="Alert by SMS" checked={s.alertSmsEnabled} onChange={(v) => set("alertSmsEnabled", v)} />
          <Toggle label="Alert by email" checked={s.alertEmailEnabled} onChange={(v) => set("alertEmailEnabled", v)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Text icon={Phone} label="Alert phone (SMS)" value={s.staffAlertPhone} onChange={(v) => set("staffAlertPhone", v)} placeholder="+61412345678" />
          <Text icon={BellRing} label="Alert email" value={s.staffAlertEmail} onChange={(v) => set("staffAlertEmail", v)} placeholder="owner@yourbusiness.com" />
        </div>
      </Panel>

      <Panel className="p-5 space-y-5">
        <p className="text-sm font-medium text-slate-200">Missed-call text-back &amp; inbound SMS</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Text label="Twilio number (receives replies)" value={s.twilioNumber} onChange={(v) => set("twilioNumber", v)} placeholder="+61480000000" />
          <Text label="Business forwarding number" value={s.forwardingNumber} onChange={(v) => set("forwardingNumber", v)} placeholder="+61755000000" />
        </div>
        <p className="-mt-2 text-[11px] text-slate-500">Point your Twilio number's SMS &amp; Voice webhooks at Hazel to capture replies and text back missed calls.</p>
      </Panel>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

function ChannelState({ ok, icon: Icon, label, hint }: { ok: boolean; icon: any; label: string; hint: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
      <div>
        <div className="flex items-center gap-1.5 font-medium text-slate-200"><Icon className="h-3.5 w-3.5" /> {label} — {ok ? "connected" : "not connected"}</div>
        {!ok && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-cyan-500" />
      {label}
    </label>
  );
}

function Text({ label, value, onChange, placeholder, icon: Icon }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: any }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500 font-display">{Icon && <Icon className="h-3 w-3" />}{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
      />
    </label>
  );
}

function Area({ label, hint, value, onChange, placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500 font-display">{label}</span>
      {hint && <span className="ml-2 text-[11px] text-slate-600">{hint}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50"
      />
    </label>
  );
}
