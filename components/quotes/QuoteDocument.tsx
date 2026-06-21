"use client";

import { money, type Quote } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";

// The client-facing quote document — LIGHT, print-friendly, themed to the
// business's brand. Pure render from quote data + branding. NEVER renders the
// internal unit cost / margin. Self-contained inline styles so it looks the same
// in the dark-app preview and as a standalone public page (next PR).
export default function QuoteDocument({
  quote,
  brand,
  businessName,
}: {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
}) {
  const accent = brand.brandColor || "#B8763E";
  const ccy = brand.currency || "AUD";
  const ink = "#2b2620";
  const muted = "#6b6358";
  const line = "#e7e1d6";

  const grouped: { section: { id: string; name: string } | null; items: Quote["items"] }[] = [];
  const noSection = quote.items.filter((i) => !i.sectionId);
  if (noSection.length) grouped.push({ section: null, items: noSection });
  for (const s of quote.sections) {
    grouped.push({ section: { id: s.id, name: s.name }, items: quote.items.filter((i) => i.sectionId === s.id) });
  }

  const date = (d: string) => (d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "—");

  return (
    <div style={{ background: "#fbf8f3", color: ink, fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.55 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", background: "#fffdf9", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
        {/* Header */}
        <header style={{ position: "relative", overflow: "hidden", padding: "40px 48px 28px", borderBottom: `3px solid ${accent}` }}>
          {/* flowing-line motif */}
          <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ position: "absolute", right: -20, top: 10, width: 360, height: 70, opacity: 0.12 }}>
            <path d="M0,60 C80,10 160,70 240,30 C300,0 360,40 400,20" fill="none" stroke={accent} strokeWidth="3" />
          </svg>
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div>
              {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt={businessName} style={{ maxHeight: 56, maxWidth: 240, objectFit: "contain" }} />
              ) : (
                <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 34, fontWeight: 600, color: accent }}>{businessName || "Your Business"}</div>
              )}
              <div style={{ marginTop: 6, fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: muted }}>Quotation</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 13, color: muted }}>
              {quote.quoteNumber && <div style={{ fontWeight: 600, color: ink }}>{quote.quoteNumber}</div>}
              <div>Date: {date(quote.quoteDate)}</div>
              {quote.validUntil && <div>Valid until: {date(quote.validUntil)}</div>}
              {quote.reference && <div>Ref: {quote.reference}</div>}
            </div>
          </div>
        </header>

        <div style={{ padding: "28px 48px 44px" }}>
          {/* Prepared for / project */}
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap", fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: muted }}>Prepared for</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{quote.clientName || "—"}</div>
              {quote.clientAddress && <div style={{ color: muted }}>{quote.clientAddress}</div>}
              {quote.clientEmail && <div style={{ color: muted }}>{quote.clientEmail}</div>}
              {quote.clientPhone && <div style={{ color: muted }}>{quote.clientPhone}</div>}
            </div>
            {(quote.projectName || quote.siteAddress) && (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: muted }}>Project</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{quote.projectName || "—"}</div>
                {quote.siteAddress && <div style={{ color: muted }}>{quote.siteAddress}</div>}
              </div>
            )}
          </div>

          {quote.introNote && <p style={{ marginTop: 24, fontSize: 14 }}>{quote.introNote}</p>}

          {quote.scopeDescription && (
            <div style={{ marginTop: 24 }}>
              <SectionTitle accent={accent}>Scope of works</SectionTitle>
              <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, color: "#3a342c" }}>{quote.scopeDescription}</p>
            </div>
          )}

          {/* Line items */}
          <div style={{ marginTop: 28 }}>
            {grouped.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 18 }}>
                {g.section && <div style={{ fontWeight: 600, fontSize: 14, color: accent, marginBottom: 6 }}>{g.section.name || "Section"}</div>}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      <th style={{ padding: "6px 8px 6px 0" }}>Description</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", width: 60 }}>Qty</th>
                      <th style={{ padding: "6px 8px", width: 60 }}>Unit</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", width: 90 }}>Unit price</th>
                      <th style={{ padding: "6px 0 6px 8px", textAlign: "right", width: 100 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.id} style={{ borderTop: `1px solid ${line}` }}>
                        <td style={{ padding: "8px 8px 8px 0" }}>
                          <div style={{ fontWeight: 500 }}>{it.description}</div>
                          {it.detail && <div style={{ color: muted, fontSize: 12 }}>{it.detail}</div>}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{it.qty}</td>
                        <td style={{ padding: "8px", color: muted }}>{it.unit}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>{money(it.unitPrice, ccy)}</td>
                        <td style={{ padding: "8px 0 8px 8px", textAlign: "right", fontWeight: 500 }}>{money((it.qty || 0) * (it.unitPrice || 0), ccy)}</td>
                      </tr>
                    ))}
                    {!g.items.length && (
                      <tr><td colSpan={5} style={{ padding: 8, color: muted }}>—</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <table style={{ fontSize: 14, minWidth: 280 }}>
              <tbody>
                <tr><td style={{ padding: "4px 16px 4px 0", color: muted }}>Subtotal</td><td style={{ textAlign: "right" }}>{money(quote.subtotal, ccy)}</td></tr>
                {brand.gstRegistered && (
                  <tr><td style={{ padding: "4px 16px 4px 0", color: muted }}>GST (10%){quote.gstInclusive ? " incl." : ""}</td><td style={{ textAlign: "right" }}>{money(quote.gstAmount, ccy)}</td></tr>
                )}
                <tr><td style={{ padding: "8px 16px 0 0", fontWeight: 700, fontSize: 16, borderTop: `2px solid ${accent}` }}>Total</td><td style={{ textAlign: "right", fontWeight: 700, fontSize: 16, borderTop: `2px solid ${accent}`, color: accent }}>{money(quote.total, ccy)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Payment schedule */}
          {quote.stages.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <SectionTitle accent={accent}>Payment schedule</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {quote.stages.map((s) => (
                    <tr key={s.id} style={{ borderTop: `1px solid ${line}` }}>
                      <td style={{ padding: "8px 8px 8px 0", fontWeight: 500 }}>
                        {s.label}
                        {s.milestoneNote && <span style={{ color: muted, fontWeight: 400 }}> — {s.milestoneNote}</span>}
                      </td>
                      <td style={{ padding: 8, textAlign: "right", color: muted, width: 70 }}>{s.percent != null ? `${s.percent}%` : ""}</td>
                      <td style={{ padding: "8px 0 8px 8px", textAlign: "right", fontWeight: 600, width: 110 }}>{money(s.amount, ccy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Inclusions / exclusions */}
          {(quote.inclusions || quote.exclusions) && (
            <div style={{ display: "flex", gap: 32, marginTop: 28, flexWrap: "wrap" }}>
              {quote.inclusions && (
                <div style={{ flex: "1 1 260px" }}>
                  <SectionTitle accent={accent}>Inclusions</SectionTitle>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#3a342c" }}>{quote.inclusions}</p>
                </div>
              )}
              {quote.exclusions && (
                <div style={{ flex: "1 1 260px" }}>
                  <SectionTitle accent={accent}>Exclusions</SectionTitle>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#3a342c" }}>{quote.exclusions}</p>
                </div>
              )}
            </div>
          )}

          {/* Accept block */}
          <div style={{ marginTop: 32, borderRadius: 14, padding: "24px 28px", background: tint(accent), border: `1px solid ${accent}33` }}>
            <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, fontWeight: 600 }}>Ready to go ahead?</div>
            <p style={{ fontSize: 13.5, color: "#3a342c", marginTop: 4 }}>
              Accept online below and we'll lock in your spot. {brand.licenceNo ? `Fully licensed (${brand.licenceNo}) and ` : ""}backed by our workmanship guarantee — no surprises.
            </p>
            <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-block", padding: "11px 22px", borderRadius: 999, background: accent, color: "#fff", fontWeight: 600, fontSize: 14 }}>Accept this quote</span>
              {(brand.contactName || brand.contactPhone) && (
                <span style={{ fontSize: 13, color: muted }}>
                  Questions? Call {brand.contactName || "us"}{brand.contactPhone ? ` on ${brand.contactPhone}` : ""}.
                </span>
              )}
            </div>
          </div>

          {quote.terms && (
            <div style={{ marginTop: 28 }}>
              <SectionTitle accent={accent}>Terms</SectionTitle>
              <p style={{ whiteSpace: "pre-wrap", fontSize: 11.5, color: muted }}>{quote.terms}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={{ padding: "18px 48px 28px", borderTop: `1px solid ${line}`, fontSize: 11.5, color: muted, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>{businessName}{brand.address ? ` · ${brand.address}` : ""}</div>
          <div>{[brand.abn ? `ABN ${brand.abn}` : "", brand.licenceNo ? `Lic ${brand.licenceNo}` : "", brand.contactEmail].filter(Boolean).join(" · ")}</div>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: accent, fontWeight: 700, marginBottom: 6 }}>{children}</div>;
}

// A faint tint of the accent for the accept block background.
function tint(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#faf3ea";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.07)`;
}
