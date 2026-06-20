import { createAdminClient } from "@/lib/supabase/admin";

// Per-org log of review requests sent to customers (server-side writes).
export async function logReviewRequest(
  orgId: string,
  entry: { customerName?: string; channel: string; destination?: string; status: "sent" | "failed"; error?: string },
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("review_requests").insert({
    org_id: orgId,
    customer_name: entry.customerName ?? null,
    channel: entry.channel,
    destination: entry.destination ?? null,
    status: entry.status,
    error: entry.error ?? null,
  });
}

export async function listReviewRequests(orgId: string, limit = 20): Promise<any[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("review_requests")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// The friendly message body used for SMS / email. Identifies the business,
// includes the review link, and an opt-out line.
export function reviewRequestMessage(business: string, link: string, channel: "sms" | "email"): string {
  const biz = business || "us";
  if (channel === "sms") {
    return `Hi! Thanks for choosing ${biz}. If you have a moment, we'd really appreciate a quick Google review: ${link}\nReply STOP to opt out.`;
  }
  return `Thanks for choosing ${biz}!\n\nIf you have a moment, we'd really appreciate a quick Google review — it helps other locals find us:\n${link}\n\nThank you!\n\n(You're receiving this because you were a recent customer. Reply to this email to opt out.)`;
}
