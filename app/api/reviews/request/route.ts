import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getGoogleBusinessConfig } from "@/lib/integrations/google/config";
import { sendSms } from "@/lib/sms/twilio";
import { sendEmail } from "@/lib/email/resend";
import { logReviewRequest, reviewRequestMessage } from "@/lib/reviews/requests";

// Sends a review-request link to a customer by SMS or email, and logs it.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const channel = body?.channel === "email" ? "email" : "sms";
  const name = (body?.name || "").toString().trim();
  const destination = (body?.destination || "").toString().trim();
  if (!destination) return NextResponse.json({ error: "destination required" }, { status: 400 });

  const orgId = await getOrgId(supabase);
  const config = await getGoogleBusinessConfig(orgId);
  if (!config?.reviewUri) {
    return NextResponse.json(
      { error: "no_review_link", message: "No Google review link is available for the connected location." },
      { status: 412 },
    );
  }

  const message = reviewRequestMessage(config.title || "", config.reviewUri, channel);

  try {
    if (channel === "sms") {
      await sendSms(destination, message);
    } else {
      await sendEmail(destination, "We'd love your feedback", message);
    }
    await logReviewRequest(orgId, { customerName: name, channel, destination, status: "sent" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = (e as Error).message;
    await logReviewRequest(orgId, { customerName: name, channel, destination, status: "failed", error: msg }).catch(() => {});
    return NextResponse.json({ error: "send_failed", message: msg }, { status: 502 });
  }
}
