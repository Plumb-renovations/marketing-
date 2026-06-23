import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { smsConfigured } from "@/lib/sms/clicksend";
import { emailConfigured } from "@/lib/email/send";

// Which delivery channels are available (server env), for the Settings UI to
// show a clear "connect SMS" state. No secrets returned.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ sms: smsConfigured(), email: emailConfigured() });
}
