"use client";

import { money, consolidateByTrade, type Quote } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";

// The PREMIUM client-facing quote — a faithful reproduction of the "Cream &
// Copper" design: warm cream paper, soft charcoal ink, script wordmark + ribbon
// motif, staged scope, totals, payment-schedule band, notes + dark accept block
// and a footer with bank details. LIGHT / print-friendly. Everything except the
// fixed layout is driven by the Branding & Quotes settings + the quote itself.
// NEVER renders internal unit cost / margin.

// ---- small colour helpers (theme the copper accents from the brand colour) --
function clamp(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function parseHex(hex: string): [number, number, number] | null {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function shade(hex: string, amt: number, fallback: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return fallback;
  const [r, g, b] = rgb;
  // amt > 0 lightens toward white, amt < 0 darkens toward black
  const mix = (c: number) => (amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `#${[mix(r), mix(g), mix(b)].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}

const SCRIPT = "var(--font-script), 'Pinyon Script', cursive";
const DISP = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
const BODY = "var(--font-body), Inter, system-ui, sans-serif";

export default function PremiumQuoteTemplate({
  quote,
  brand,
  businessName,
}: {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
}) {
  // Brand-driven palette
  const copper = brand.brandColor || "#A86A45";
  const copperSoft = shade(copper, 0.22, "#C28A6A");
  const ink = brand.brandColor2 || "#242220";
  const ccy = brand.currency || "AUD";

  // Fixed warm-paper layout tokens (not brand-driven by design)
  const paper = "#FCFAF5";
  const bg = "#EBE7DF";
  const muted = "#6B655C";
  const faint = "#9E978B";
  const hair = "#E9E2D6";
  const hairStrong = "#DBD2C4";
  const bandBg = "#FAF4EC";

  const date = (d: string) =>
    d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const qty = (it: Quote["items"][number]) =>
    it.unit && it.unit !== "ea" ? `${it.qty} ${it.unit}` : `${it.qty}`;
  const amount = (it: Quote["items"][number]) => (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);

  // Group line items into the staged scope sections (numbered), with an unnamed
  // leading group for any items not assigned to a section.
  const groups: { name: string | null; items: Quote["items"] }[] = [];
  const loose = quote.items.filter((i) => !i.sectionId);
  if (loose.length) groups.push({ name: null, items: loose });
  for (const s of quote.sections) {
    const items = quote.items.filter((i) => i.sectionId === s.id);
    if (items.length) groups.push({ name: s.name || "Section", items });
  }
  let stageNo = 0;

  // Quote-by-trade: when any line carries a trade, the client sees ONE
  // consolidated line per trade (name + optional combined description + combined
  // total) — never the individual components, quantities or per-unit rates.
  // Quotes with no trades fall back to the existing section view, unchanged.
  const tradeLines = consolidateByTrade(quote.items);
  const hasTrades = quote.items.some((i) => (i.trade || "").trim());

  // Wordmark fallback (no uploaded logo): business name → first word in script,
  // the remaining words as a spaced sub-label (matches the reference lockup).
  const words = (businessName || "").trim().split(/\s+/).filter(Boolean);
  const scriptWord = words[0] || "Your Business";
  const subLabel = words.slice(1).join(" ");

  const bankLines = (brand.bankDetails || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const incl = (quote.inclusions || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const excl = (quote.exclusions || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const notes = [...incl, ...excl];

  const gstNote = brand.gstRegistered
    ? `All amounts in ${ccy}, inclusive of GST`
    : `All amounts in ${ccy}`;

  return (
    <div style={{ background: bg, color: ink, fontFamily: BODY, lineHeight: 1.6 }}>
      <div
        className="quote-page"
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: paper,
          boxShadow: "0 1px 2px rgba(0,0,0,.05), 0 24px 60px rgba(36,24,16,.16)",
          padding: "54px 60px 46px",
        }}
      >
        {/* ===================== MASTHEAD ===================== */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 30,
            padding: "6px 0 28px",
            borderBottom: `1px solid ${hairStrong}`,
            overflow: "hidden",
          }}
        >
          {brand.showRibbon && (
            <svg
              viewBox="0 0 760 200"
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{ position: "absolute", top: -14, right: -30, width: "62%", height: 150, opacity: 0.55, pointerEvents: "none", zIndex: 0 }}
            >
              <path d="M-20,150 C190,52 380,182 800,46" fill="none" stroke={copper} strokeWidth="1.4" />
              <path d="M-20,170 C210,86 400,194 800,78" fill="none" stroke={copperSoft} strokeWidth="1.2" />
              <path d="M-20,126 C170,34 420,158 800,24" fill="none" stroke={copper} strokeWidth="1" />
            </svg>
          )}

          {/* Brand */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={businessName} style={{ maxHeight: 72, maxWidth: 260, objectFit: "contain" }} />
            ) : (
              <>
                <div style={{ fontFamily: SCRIPT, fontSize: 58, color: ink, lineHeight: 0.86, letterSpacing: ".01em" }}>{scriptWord}</div>
                {subLabel && (
                  <div style={{ fontFamily: DISP, fontWeight: 600, letterSpacing: ".36em", fontSize: 13, color: ink, marginTop: 4, paddingLeft: 7 }}>
                    {subLabel.toUpperCase()}
                  </div>
                )}
              </>
            )}
            <div style={{ width: 48, height: 2, background: copper, margin: "15px 0 13px" }} />
            <div style={{ fontSize: 12, color: muted, lineHeight: 1.75 }}>
              {brand.tagline && <>{brand.tagline}<br /></>}
              {brand.regionLine && <>{brand.regionLine}<br /></>}
              {(brand.contactPhone || brand.contactEmail) && (
                <>{[brand.contactPhone, brand.contactEmail].filter(Boolean).join("  ·  ")}<br /></>
              )}
              {[brand.licenceNo, brand.abn ? `ABN ${brand.abn}` : ""].filter(Boolean).join("  ·  ")}
            </div>
          </div>

          {/* Quote title + meta */}
          <div style={{ position: "relative", zIndex: 1, textAlign: "right", minWidth: 206 }}>
            <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 38, letterSpacing: ".06em", color: ink, lineHeight: 1 }}>
              QU<span style={{ color: copper }}>O</span>TE
            </div>
            <div style={{ marginTop: 13, fontSize: 12.5, color: muted }}>
              <div><b style={{ color: ink, fontWeight: 600 }}>Quote No.</b> &nbsp; {quote.quoteNumber || "—"}</div>
              <div style={{ marginTop: 3 }}><b style={{ color: ink, fontWeight: 600 }}>Date</b> &nbsp; {date(quote.quoteDate)}</div>
              <div style={{ marginTop: 3 }}><b style={{ color: ink, fontWeight: 600 }}>Valid until</b> &nbsp; {date(quote.validUntil)}</div>
              {quote.reference && <div style={{ marginTop: 3 }}><b style={{ color: ink, fontWeight: 600 }}>Ref</b> &nbsp; {quote.reference}</div>}
            </div>
          </div>
        </div>

        {/* ===================== PARTIES ===================== */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30, marginTop: 28 }}>
          <div>
            <div style={partyH(copper)}>Prepared for</div>
            <div style={{ fontSize: 13.5, color: ink, lineHeight: 1.7 }}>
              <span style={{ fontWeight: 600 }}>{quote.clientName || "—"}</span>
              {quote.clientAddress && <><br />{quote.clientAddress}</>}
              {quote.clientPhone && <><br />{quote.clientPhone}</>}
              {quote.clientEmail && <><br />{quote.clientEmail}</>}
            </div>
          </div>
          <div>
            <div style={partyH(copper)}>Project</div>
            <div style={{ fontSize: 13.5, color: ink, lineHeight: 1.7 }}>
              <span style={{ fontWeight: 600 }}>{quote.projectName || "—"}</span>
              {quote.siteAddress && <><br />Site: {quote.siteAddress}</>}
            </div>
          </div>
        </div>

        {quote.introNote && (
          <p style={{ margin: "30px 0 4px", fontSize: 14, color: muted, maxWidth: "62ch" }}>{quote.introNote}</p>
        )}

        {/* ===================== SCOPE — BY TRADE ===================== */}
        {hasTrades ? (
          <div style={{ marginTop: 30 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, paddingBottom: 9, borderBottom: `1px solid ${hair}` }}>
              <span style={{ fontFamily: DISP, fontWeight: 600, fontSize: 20, letterSpacing: ".005em" }}>Scope of works</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: faint }}>by trade</span>
            </div>
            {tradeLines.map((t, i) => (
              <div key={t.key} style={{ padding: "16px 0", borderBottom: i === tradeLines.length - 1 ? "0" : `1px solid ${hair}` }}>
                {/* trade heading + ONE combined total */}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ fontFamily: DISP, fontWeight: 600, fontSize: 16, color: ink }}>{t.label}</span>
                  <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: ink }}>{money(t.total, ccy)}</span>
                </div>
                {/* FULL scope — every component's dot points, never truncated */}
                {t.bullets.length > 0 && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18, listStyle: "disc", color: muted }}>
                    {t.bullets.map((b, bi) => (
                      <li key={bi} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 3, whiteSpace: "pre-wrap" }}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : groups.map((g, gi) => {
          const sub = g.items.reduce((s, it) => s + amount(it), 0);
          const no = g.name ? ++stageNo : null;
          return (
            <div key={gi} style={{ marginTop: 30 }}>
              {g.name && (
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, paddingBottom: 9, borderBottom: `1px solid ${hair}` }}>
                  <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 17, color: copper, minWidth: 26 }}>
                    {String(no).padStart(2, "0")}
                  </span>
                  <span style={{ fontFamily: DISP, fontWeight: 600, fontSize: 20, letterSpacing: ".005em" }}>{g.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 13, color: muted, fontVariantNumeric: "tabular-nums" }}>{money(sub, ccy)}</span>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {g.items.map((it, ii) => (
                    <tr key={it.id}>
                      <td style={{ padding: "11px 0", fontSize: 13.5, verticalAlign: "top", borderBottom: ii === g.items.length - 1 ? "0" : `1px solid ${hair}`, color: ink }}>
                        {it.description}
                        {it.detail && <small style={{ display: "block", color: faint, fontSize: 12, marginTop: 2 }}>{it.detail}</small>}
                      </td>
                      <td style={{ padding: "11px 0", fontSize: 13.5, verticalAlign: "top", borderBottom: ii === g.items.length - 1 ? "0" : `1px solid ${hair}`, textAlign: "right", color: muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", width: 90 }}>
                        {qty(it)}
                      </td>
                      <td style={{ padding: "11px 0", fontSize: 13.5, verticalAlign: "top", borderBottom: ii === g.items.length - 1 ? "0" : `1px solid ${hair}`, textAlign: "right", fontWeight: 600, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", width: 110 }}>
                        {money(amount(it), ccy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* ===================== TOTALS ===================== */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 26 }}>
          <div style={{ width: 322 }}>
            <div style={totalRow(muted)}><span>Subtotal{brand.gstRegistered ? " (ex GST)" : ""}</span><b style={{ color: ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(quote.subtotal, ccy)}</b></div>
            {brand.gstRegistered && (
              <div style={totalRow(muted)}><span>GST 10%{quote.gstInclusive ? " (incl.)" : ""}</span><b style={{ color: ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(quote.gstAmount, ccy)}</b></div>
            )}
            <div style={{ borderTop: `2px solid ${ink}`, marginTop: 6, paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: DISP, fontWeight: 600, fontSize: 19 }}>Total{brand.gstRegistered ? " (inc GST)" : ""}</span>
              <span style={{ fontFamily: DISP, fontWeight: 600, fontSize: 30, fontVariantNumeric: "tabular-nums", color: ink }}>{money(quote.total, ccy)}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: 11.5, color: faint, marginTop: 4 }}>{gstNote}</div>
          </div>
        </div>

        {/* ===================== PAYMENT SCHEDULE ===================== */}
        {quote.stages.length > 0 && (
          <div style={{ position: "relative", marginTop: 38, background: bandBg, border: `1px solid ${hairStrong}`, borderRadius: 4, padding: "26px 28px", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(${copper}, ${copperSoft})` }} />
            <h3 style={{ fontFamily: DISP, fontWeight: 600, fontSize: 20, margin: "0 0 4px" }}>Payment schedule</h3>
            <p style={{ fontSize: 12.5, color: muted, margin: "0 0 16px" }}>
              Progress claims drawn against the quoted total. Each stage is invoiced on completion.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={schedTh(faint, hairStrong, "left")}>Stage</th>
                  <th style={schedTh(faint, hairStrong, "right")}>%</th>
                  <th style={schedTh(faint, hairStrong, "right")}>Amount{brand.gstRegistered ? " (inc GST)" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {quote.stages.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ padding: "12px 0", fontSize: 13.5, borderBottom: i === quote.stages.length - 1 ? "0" : `1px solid ${hair}`, verticalAlign: "top", fontWeight: 600, color: ink }}>
                      {s.label}
                      {s.milestoneNote && <small style={{ display: "block", fontWeight: 400, color: muted, fontSize: 12, marginTop: 1 }}>{s.milestoneNote}</small>}
                    </td>
                    <td style={{ padding: "12px 0", fontSize: 13.5, borderBottom: i === quote.stages.length - 1 ? "0" : `1px solid ${hair}`, textAlign: "right", color: copper, fontWeight: 700, fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>
                      {s.percent != null ? `${s.percent}%` : ""}
                    </td>
                    <td style={{ padding: "12px 0", fontSize: 13.5, borderBottom: i === quote.stages.length - 1 ? "0" : `1px solid ${hair}`, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", verticalAlign: "top" }}>
                      {money(s.amount, ccy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: `2px solid ${ink}`, fontSize: 14 }}>
              <span>Total</span><b style={{ fontVariantNumeric: "tabular-nums" }}>{money(quote.total, ccy)}</b>
            </div>
          </div>
        )}

        {/* ===================== NOTES + ACCEPT ===================== */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 34, marginTop: 38 }}>
          <div>
            {notes.length > 0 && (
              <>
                <div style={partyH(copper)}>Inclusions &amp; exclusions</div>
                <ul style={{ fontSize: 12.5, color: muted, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
                  {notes.map((n, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{n}</li>
                  ))}
                </ul>
              </>
            )}
            {quote.terms && (
              <p style={{ fontSize: 11.5, color: faint, lineHeight: 1.7, marginTop: notes.length ? 18 : 0 }}>{quote.terms}</p>
            )}
          </div>

          <div style={{ background: ink, color: "#F4EFE6", borderRadius: 4, padding: "24px 26px" }}>
            <p style={{ fontFamily: DISP, fontWeight: 600, fontSize: 21, margin: "0 0 6px", color: "#fff" }}>Ready to go ahead?</p>
            <p style={{ fontSize: 12.5, color: "#CFC6B8", margin: "0 0 18px" }}>
              Accept online and we&apos;ll secure your preferred start date — a deposit locks it in and we&apos;ll send the
              invoice straight away.
              {(brand.contactName || brand.contactPhone) && (
                <> Want to run through anything first? Call {brand.contactName || "us"}{brand.contactPhone ? ` on ${brand.contactPhone}` : ""}.</>
              )}
            </p>
            <div style={{ display: "block", textAlign: "center", background: copper, color: "#fff", fontWeight: 700, fontSize: 14, padding: 13, borderRadius: 3, letterSpacing: ".02em" }}>
              Accept &amp; secure my date
            </div>
            <div style={{ marginTop: 11, textAlign: "center", fontSize: 10.5, color: "#A59C8D", letterSpacing: ".02em", lineHeight: 1.5 }}>
              {brand.licenceNo ? `Fully licensed (${brand.licenceNo}) & insured · ` : ""}fixed price, no surprises
            </div>
            <div style={{ marginTop: 20, borderTop: "1px solid #3c362d", paddingTop: 14, fontSize: 11, color: "#a59c8d" }}>
              Or sign to accept:
              <div style={{ height: 30, borderBottom: "1px solid #5c5447", marginTop: 14 }} />
              <div style={{ marginTop: 8 }}>Signature &amp; date</div>
            </div>
          </div>
        </div>

        {/* ===================== FOOTER ===================== */}
        <div style={{ marginTop: 42, paddingTop: 20, borderTop: `1px solid ${hairStrong}`, display: "flex", justifyContent: "space-between", gap: 24, fontSize: 11.5, color: muted }}>
          <div style={{ fontFamily: DISP, fontStyle: "italic", fontSize: 17, color: ink }}>
            Thank you — we&apos;d love to build this for you.
          </div>
          <div style={{ textAlign: "right" }}>
            <b style={{ color: ink }}>Deposit payable to</b><br />
            {businessName || "Your Business"}<br />
            {bankLines.length > 0 ? (
              bankLines.map((l, i) => <span key={i}>{l}<br /></span>)
            ) : (
              <span style={{ color: faint }}>Bank details to follow<br /></span>
            )}
            {quote.quoteNumber && <>Ref: {quote.quoteNumber}</>}
          </div>
        </div>
      </div>
    </div>
  );
}

function partyH(copper: string): React.CSSProperties {
  return { fontSize: 11, color: copper, fontWeight: 700, letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 8 };
}
function totalRow(muted: string): React.CSSProperties {
  return { display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, color: muted };
}
function schedTh(faint: string, hairStrong: string, align: "left" | "right"): React.CSSProperties {
  return { textAlign: align, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: faint, fontWeight: 700, paddingBottom: 10, borderBottom: `1px solid ${hairStrong}` };
}
