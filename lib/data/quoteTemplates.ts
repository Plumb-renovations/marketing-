import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/data/org";
import type { QuoteItem } from "@/lib/quotes/model";

// Reusable QUOTE TEMPLATES — a saved set of line items (+ optional scope/notes)
// the user loads for a new job ("Ground floor bathroom", "Upstairs bathroom").
// Stored as jsonb so the payload stays readable by the future AI reviewer and
// survives quote-model tweaks.
//
// Multi-tenant: reads use select * + RLS (no org_id filter). Writes set org_id
// via getOrgId. Resilient to the table not existing yet (pre-0031) → empty list.

// The line-item shape we persist in a template (no ids — regenerated on load).
export type TemplateLine = Pick<QuoteItem, "description" | "detail" | "qty" | "unit" | "unitPrice" | "unitCost">;

export interface QuoteTemplateData {
  items: TemplateLine[];
  scopeDescription?: string;
  inclusions?: string;
  exclusions?: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  data: QuoteTemplateData;
  sortOrder: number;
  createdAt: string | null;
}

function mapTemplate(row: any): QuoteTemplate {
  const d = (row.data ?? {}) as any;
  return {
    id: row.id,
    name: row.name ?? "",
    data: {
      items: Array.isArray(d.items) ? d.items : [],
      scopeDescription: d.scopeDescription ?? "",
      inclusions: d.inclusions ?? "",
      exclusions: d.exclusions ?? "",
    },
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ?? null,
  };
}

export async function fetchQuoteTemplates(supabase: SupabaseClient): Promise<QuoteTemplate[]> {
  const { data, error } = await supabase.from("quote_templates").select("*").order("sort_order", { ascending: true });
  if (error) {
    console.error("[quoteTemplates] fetch:", error.message);
    return [];
  }
  return (data || []).map(mapTemplate);
}

export async function saveQuoteTemplate(supabase: SupabaseClient, tpl: { id: string; name: string; data: QuoteTemplateData; sortOrder?: number }): Promise<void> {
  const orgId = await getOrgId(supabase);
  const { error } = await supabase.from("quote_templates").upsert({
    id: tpl.id,
    org_id: orgId,
    name: tpl.name.trim() || "Untitled template",
    data: tpl.data as any,
    sort_order: tpl.sortOrder ?? 0,
  });
  if (error) throw error;
}

export async function deleteQuoteTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("quote_templates").delete().eq("id", id);
  if (error) throw error;
}
