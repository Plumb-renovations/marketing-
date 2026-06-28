import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessProfile } from "@/lib/business/profile";
import { runGenerator } from "@/lib/ai/server";
import type { EngagementItem } from "./store";

// Draft a brand-voice reply for one item (or FLAG it for the owner's personal
// attention when sensitive), and persist the result. Reuses the Anthropic
// pipeline + adPersona brand voice. Never auto-posts — this only writes a draft.
export async function draftReplyForItem(
  db: SupabaseClient,
  orgId: string,
  profile: BusinessProfile,
  item: EngagementItem,
): Promise<{ action: "reply" | "flag"; reply: string; reason: string; sentiment: string | null } | null> {
  const ai: any = await runGenerator(
    "comment-reply",
    { engageItem: { channel: item.channel, kind: item.kind, text: item.text, rating: item.rating, author: item.author } },
    profile,
  );
  if (!ai) return null;
  const action: "reply" | "flag" = ai.action === "flag" ? "flag" : "reply";
  const reply = String(ai.reply || "");
  const reason = String(ai.reason || "");
  const sentiment = ["positive", "neutral", "negative"].includes(ai.sentiment) ? ai.sentiment : null;

  await db
    .from("engagement_items")
    .update({
      draft_reply: reply,
      sentiment,
      flagged: action === "flag",
      flag_reason: action === "flag" ? reason : null,
      status: action === "flag" ? "flagged" : "drafted",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", item.id);

  return { action, reply, reason, sentiment };
}
