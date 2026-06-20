import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/data/org";
import { getGoogleBusinessConfig } from "@/lib/integrations/google/config";
import { twilio, resend } from "@/lib/integrations/env";
import { listReviewRequests } from "@/lib/reviews/requests";

// Everything the "Request a review" UI needs: the review link, a server-rendered
// QR code, which delivery channels are available, and the recent request log.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const config = await getGoogleBusinessConfig(orgId);

  const reviewUri = config?.reviewUri || null;
  let qrDataUrl: string | null = null;
  if (reviewUri) {
    qrDataUrl = await QRCode.toDataURL(reviewUri, { width: 320, margin: 2 });
  }

  const requests = await listReviewRequests(orgId).catch(() => []);

  return NextResponse.json({
    connected: !!config,
    reviewUri,
    qrDataUrl,
    businessName: config?.title || null,
    sms: { enabled: twilio.configured },
    email: { enabled: resend.configured },
    requests,
  });
}
