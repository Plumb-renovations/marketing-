import type { PriceItem } from "@/lib/data/priceList";

// A sensible starter rate card for a Gold Coast bathroom/kitchen renovator —
// one-tap "Load starter rates" so the price list isn't empty on day one. Every
// rate is a placeholder the user edits to their own numbers; nothing here is
// authoritative pricing. Units mirror how the trade actually charges (per m²,
// per point, fixed package, per hour).
export const STARTER_PRICE_LIST: Omit<PriceItem, "id" | "sortOrder">[] = [
  { category: "Linings", name: "Villaboard lining", unit: "m²", unitPrice: 55, notes: "Supply + fix to walls/ceiling" },
  { category: "Linings", name: "Plasterboard", unit: "m²", unitPrice: 45, notes: "Supply + fix, set ready to paint" },
  { category: "Waterproofing", name: "Waterproofing (wet area)", unit: "m²", unitPrice: 75, notes: "AS 3740 compliant membrane" },
  { category: "Tiling", name: "Wall tiling", unit: "m²", unitPrice: 90, notes: "Labour only, standard format tile" },
  { category: "Tiling", name: "Floor tiling", unit: "m²", unitPrice: 95, notes: "Labour only, incl. screed to falls" },
  { category: "Plumbing", name: "Plumbing point (rough-in + fit-off)", unit: "point", unitPrice: 350, notes: "Per fixture point" },
  { category: "Plumbing", name: "Relocate floor waste", unit: "ea", unitPrice: 450, notes: "Incl. make good" },
  { category: "Electrical", name: "Basic electrical package", unit: "fixed", unitPrice: 1800, notes: "Lights, GPOs, exhaust, IXL — standard bathroom" },
  { category: "Electrical", name: "Downlight", unit: "ea", unitPrice: 120, notes: "Supply + install LED" },
  { category: "Carpentry", name: "Demolition & strip-out", unit: "fixed", unitPrice: 1500, notes: "Standard bathroom, incl. rubbish removal" },
  { category: "Painting", name: "Painting", unit: "m²", unitPrice: 35, notes: "Prep + 2 coats" },
  { category: "Joinery", name: "Vanity install", unit: "ea", unitPrice: 280, notes: "Install only — supply by others/PC sum" },
  { category: "Labour", name: "General labour", unit: "hr", unitPrice: 85, notes: "Hourly rate" },
];
