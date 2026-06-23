// Domain types — the in-app (camelCase) shapes the ported UI works with.
// The data layer maps these to/from the snake_case Supabase rows.

export type Stage = "new" | "qualified" | "quote" | "won" | "lost";
export type JobStatus = "scheduled" | "in_progress" | "complete";
export type SourceKey =
  | "google_ads"
  | "meta_ads"
  | "instagram"
  | "facebook"
  | "gbp"
  | "referral"
  | "website";

export interface LineItem {
  id: string;
  desc: string;
  qty: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  status: string; // 'draft' | 'sent'
  createdAt: string; // YYYY-MM-DD
  lineItems: LineItem[];
}

export interface Lead {
  id: string;
  date: string; // YYYY-MM-DD (lead_date)
  name: string;
  suburb: string;
  source: SourceKey;
  project: string;
  stage: Stage;
  quotes: Quote[];
  wonQuoteId?: string | null;
  lostReason?: string | null;
  tradify?: string;
  startDate?: string;
  durationWeeks?: number;
  jobStatus?: JobStatus;
  jobValue?: number | null; // captured on a won job (= accepted quote total)
  archivedAt?: string | null; // soft-delete: archived (test/junk) leads, excluded from lists + metrics
  email?: string; // pulled from the lead-form submission (raw.field_data)
  phone?: string; // pulled from the lead-form submission (raw.field_data)
  formFields?: import("@/lib/leads/formData").LeadFormField[]; // every Q&A answer exactly as submitted
}

export type PostStatus = "draft" | "scheduled" | "posted";

export interface Post {
  id: string;
  photo: string | null;
  caption: string;
  hashtags: string;
  cta?: string;
  channels: string[]; // 'instagram' | 'facebook' | 'gbp'
  scheduledAt: string; // YYYY-MM-DDTHH:mm
  status: PostStatus;
  reach: number | null;
  engagement: number | null;
  why: string;
}

export type AdKind = "meta" | "google";

export interface Ad {
  id: string;
  type: AdKind;
  goal: string;
  photo: string | null;
  status: string; // 'draft' | 'live' | 'archived'
  createdAt: string;
  content: any;
}

export interface Settings {
  jobsTarget: number;
  revenueTarget: number;
  leadTimeWeeks: number;
  costPerLead: number;
  leadToWonRate: number;
}

export interface Metrics {
  spend: Record<string, number>;
  organic: {
    ig_reach: number;
    ig_eng: number;
    fb_reach: number;
    fb_eng: number;
    gbp_views: number;
    gbp_calls: number;
  };
}
