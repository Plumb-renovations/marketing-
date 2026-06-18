import { graphGet } from "./client";
import type { InboundLead } from "../types";

// Lead retrieval. The leadgen webhook hands us a leadgen_id; we read the full
// lead off the Graph API and normalise it to the Leads board shape.

/**
 * Flatten Meta's field_data ([{ name, values: [] }]) into a simple map,
 * keeping the first value per field name.
 */
export function parseFieldData(fd: any): Record<string, string> {
  const out: Record<string, string> = {};
  const list: any[] = Array.isArray(fd) ? fd : [];
  for (const item of list) {
    const name = item?.name;
    const value = Array.isArray(item?.values) ? item.values[0] : undefined;
    if (typeof name === "string" && value != null) {
      out[name] = String(value);
    }
  }
  return out;
}

export async function fetchLead(leadgenId: string): Promise<InboundLead> {
  const lead: any = await graphGet(`${leadgenId}`, {
    fields: "id,created_time,ad_id,form_id,field_data",
  });

  const fields = parseFieldData(lead?.field_data);

  // Case-insensitive lookup over the flattened field map.
  const find = (predicate: (key: string) => boolean): string | undefined => {
    for (const [k, v] of Object.entries(fields)) {
      if (predicate(k.toLowerCase()) && v && v.trim()) return v.trim();
    }
    return undefined;
  };

  const fullName = find((k) => k === "full_name");
  const firstName = find((k) => k === "first_name");
  const lastName = find((k) => k === "last_name");
  const name =
    fullName ||
    (firstName || lastName ? `${firstName ?? ""} ${lastName ?? ""}`.trim() : undefined) ||
    "Meta Lead";

  const suburb =
    find((k) => k === "city" || k === "suburb" || k === "town" || k === "postcode") || "—";

  const project =
    find((k) => k.includes("project") || k.includes("service") || k.includes("renovat")) ||
    "Bathroom";

  return {
    externalId: String(lead?.id ?? leadgenId),
    name,
    suburb,
    project,
    source: "meta_ads",
    raw: lead,
  };
}
