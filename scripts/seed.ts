/**
 * Seeds the org with the real tracker data (leads, quotes, posts, settings).
 * Works against local (`supabase start`) or a hosted project — whichever
 * .env.local points at. Uses the service-role key (bypasses RLS).
 *
 *   npm run db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { SEED_LEADS, SEED_POSTS, DEFAULT_SETTINGS, DEFAULT_METRICS, ORG_ID } from "../lib/domain/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  // Ensure the org + settings row exist (migration already creates them; this
  // makes the script safe to run against any database).
  await supabase.from("orgs").upsert({ id: ORG_ID, name: "Plumb Renovations" });

  // Clean slate for this org's leads (cascades to quotes + line items).
  await supabase.from("leads").delete().eq("org_id", ORG_ID);

  const leadRows = SEED_LEADS.map((l) => ({
    id: l.id,
    org_id: ORG_ID,
    name: l.name,
    suburb: l.suburb,
    source: l.source,
    project: l.project,
    stage: l.stage,
    lead_date: l.date,
    lost_reason: l.lostReason ?? null,
    won_quote_id: l.wonQuoteId ?? null,
    tradify: l.tradify ?? null,
    start_date: l.startDate ?? null,
    duration_weeks: l.durationWeeks ?? null,
    job_status: l.jobStatus ?? null,
  }));
  const quoteRows = SEED_LEADS.flatMap((l) =>
    l.quotes.map((q, i) => ({ id: q.id, org_id: ORG_ID, lead_id: l.id, status: q.status, created_at: q.createdAt, position: i })),
  );
  const itemRows = SEED_LEADS.flatMap((l) =>
    l.quotes.flatMap((q) =>
      q.lineItems.map((li, i) => ({ id: li.id, quote_id: q.id, description: li.desc, qty: li.qty, unit_price: li.unitPrice, position: i })),
    ),
  );
  const postRows = SEED_POSTS.map((p) => ({
    id: p.id,
    org_id: ORG_ID,
    photo: p.photo,
    caption: p.caption,
    hashtags: p.hashtags,
    cta: p.cta ?? "",
    channels: p.channels,
    scheduled_at: p.scheduledAt,
    status: p.status,
    reach: p.reach,
    engagement: p.engagement,
    why: p.why,
  }));

  const steps: [string, any][] = [
    ["leads", await supabase.from("leads").insert(leadRows)],
    ["quotes", await supabase.from("quotes").insert(quoteRows)],
    ["quote_line_items", await supabase.from("quote_line_items").insert(itemRows)],
    ["posts", await supabase.from("posts").upsert(postRows)],
    [
      "app_settings",
      await supabase.from("app_settings").upsert({
        org_id: ORG_ID,
        jobs_target: DEFAULT_SETTINGS.jobsTarget,
        revenue_target: DEFAULT_SETTINGS.revenueTarget,
        lead_time_weeks: DEFAULT_SETTINGS.leadTimeWeeks,
        cost_per_lead: DEFAULT_SETTINGS.costPerLead,
        lead_to_won_rate: DEFAULT_SETTINGS.leadToWonRate,
        metrics: DEFAULT_METRICS,
      }),
    ],
  ];

  for (const [name, res] of steps) {
    if (res.error) {
      console.error(`Failed seeding ${name}:`, res.error.message);
      process.exit(1);
    }
  }

  console.log(`Seeded ${leadRows.length} leads, ${quoteRows.length} quotes, ${postRows.length} posts, settings.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
