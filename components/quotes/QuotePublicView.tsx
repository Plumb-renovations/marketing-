"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Loader2, CheckCircle2 } from "lucide-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import { money, computeTotals, buildItemsForTier, tierTotals, pcTierTotals, pcAllowanceItems, tierName, pcTierName, type Quote, type TierKey } from "@/lib/quotes/model";
import type { QuoteConfiguratorConfig } from "@/components/quotes/templates/PremiumQuoteTemplate";
import type { BrandSettings } from "@/lib/business/brand";

// The public, mobile-friendly view of a sent quote. Renders the branded
// document and logs the open once (tracking beacon). The quote is a CALM,
// in-control configurator: the client reads down the document and selects their
// construction option + fixtures level INLINE on the tier cards; once BOTH are
// chosen a combined total reveals (no price chasing them down the page), with a
// gentle comfort question giving them permission to quietly adjust to budget.
export default function QuotePublicView({
  quote,
  brand,
  businessName,
  token,
}: {
  quote: Quote;
  brand: BrandSettings;
  businessName: string;
  token: string;
}) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    fetch("/api/quotes/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      keepalive: true,
    }).catch(() => {});

    // Reconcile: if the quote is already accepted, ping the (idempotent) accept
    // endpoint so a deposit invoice that was never raised (e.g. accepted before
    // the invoice table existed) gets created + emailed now. Safe — an
    // already-sent invoice is skipped, and accept fields aren't overwritten.
    if (quote.status === "accepted") {
      fetch("/api/quotes/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
  }, [token, quote.status]);

  const accent = brand.brandColor || "#A86A45";
  const ccy = brand.currency || "AUD";
  const DISP = "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif";
  const BODY = "var(--font-body), Inter, system-ui, sans-serif";

  const [accepted, setAccepted] = useState(quote.status === "accepted");
  const [name, setName] = useState(quote.clientName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Two parallel choices the client configures inline: a construction tier + a
  // PC (fixtures & tiles) tier. Selections start UNSET, so the combined total
  // only reveals once both are made (no pressure before they're ready).
  const tiers = tierTotals(quote.items, brand.gstRegistered, quote.gstInclusive);
  const pcTiers = pcTierTotals(quote.items, brand.gstRegistered, quote.gstInclusive);
  const tiered = !!quote.tiered;
  const hasAllowance = quote.items.some((i) => i.allowance);
  const pcTiered = !!quote.pcTiered && hasAllowance;
  const isConfigurable = tiered || pcTiered;

  const [cTier, setCTier] = useState<TierKey | null>(quote.acceptedTier ?? null);
  const [pcChoice, setPcChoice] = useState<TierKey | null>(quote.acceptedPcTier ?? null);

  // A choice is "satisfied" when its axis isn't a choice (flat) or one is picked.
  const cChosen = !tiered || cTier !== null;
  const pcChosen = !pcTiered || pcChoice !== null;
  const bothChosen = cChosen && pcChosen;

  // Live amounts. Construction (build-only) drives the deposit; PC is the
  // fixtures/tiles allowance. Flat (non-tiered) axes use their fixed total.
  const constructionFlat = computeTotals(buildItemsForTier(quote.items, null), brand.gstRegistered, quote.gstInclusive).total;
  const allowanceFlat = computeTotals(pcAllowanceItems(quote.items, null), brand.gstRegistered, quote.gstInclusive).total;
  const cTotal = tiered ? (cTier ? tiers[cTier].total : 0) : constructionFlat;
  const pTotal = pcTiered ? (pcChoice ? pcTiers[pcChoice].total : 0) : allowanceFlat;
  const grandTotal = cTotal + pTotal;
  const depositPct = brand.depositPercent || 5;
  const deposit = Math.round((cTotal * depositPct) / 100 * 100) / 100;
  const cLabel = tiered ? (cTier ? tierName(quote.tierNames, cTier) : "—") : "Construction";
  const pcLabel = pcTiered ? (pcChoice ? pcTierName(quote.pcTierNames, pcChoice) : "—") : hasAllowance ? "Fixtures & tiles" : "";
  const showFixturesLine = pcTiered || hasAllowance;
  const gstNote = brand.gstRegistered ? `All amounts in ${ccy}, inclusive of GST` : `All amounts in ${ccy}`;

  const accept = async () => {
    if (!bothChosen) { setError("Please choose your options above first."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/quotes/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, tier: tiered ? cTier : undefined, pcTier: pcTiered ? pcChoice : undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError("Sorry — we couldn't record your acceptance. Please try again or contact us.");
        return;
      }
      setAccepted(true);
    } catch {
      setError("Sorry — we couldn't record your acceptance. Please try again or contact us.");
    } finally {
      setBusy(false);
    }
  };

  // Configurator intro ("Your quote, your way.") — first line a heading.
  const introRaw = (quote.configuratorIntro || "").trim();
  const introLines = introRaw ? introRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const introHeading = introLines[0] || "";
  const introBody = introLines.slice(1);
  const comfort = (quote.comfortQuestion || "").trim();

  // ---- Slots injected into the document (so selection + total sit inline) ----
  const introNode = isConfigurable && introHeading ? (
    <div style={{ marginTop: 30, border: `1px solid ${accent}33`, background: `${accent}0a`, borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ fontFamily: DISP, fontSize: 23, fontWeight: 700, color: "#242220", lineHeight: 1.15 }}>{introHeading}</div>
      {introBody.map((p, i) => (
        <p key={i} style={{ fontSize: 14, color: "#5f574c", lineHeight: 1.6, margin: i === 0 ? "8px 0 0" : "6px 0 0" }}>{p}</p>
      ))}
    </div>
  ) : null;

  const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", fontSize: 14, color: "#6b6358" };

  const summaryNode = (
    <div style={{ marginTop: 30 }}>
      {accepted ? (
        <div style={{ border: `1px solid ${accent}55`, borderRadius: 12, padding: "22px 24px", background: "#fff", textAlign: "center" }}>
          <CheckCircle2 style={{ width: 30, height: 30, color: "#3aa757", margin: "0 auto 8px" }} />
          <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: "#242220" }}>
            {isConfigurable ? `${cLabel}${showFixturesLine ? ` + ${pcLabel}` : ""} — accepted, thank you!` : "Accepted — thank you!"}
          </div>
          <p style={{ fontSize: 14, color: "#6b6358", marginTop: 6, lineHeight: 1.6 }}>
            {businessName || "We"} will be in touch to confirm your start date. A {depositPct}% deposit invoice ({money(deposit, ccy)} of your construction total) is on its way to your email to lock it in.
          </p>
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: "#242220" }}>Your total: {money(grandTotal, ccy)}{brand.gstRegistered ? " inc GST" : ""}</div>
        </div>
      ) : !bothChosen ? (
        // Calm prompt — NO price until both are chosen, so nothing chases them.
        <div style={{ border: `1px dashed ${accent}66`, borderRadius: 12, padding: "22px 24px", background: `${accent}06`, textAlign: "center" }}>
          <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 700, color: "#242220" }}>Take your time</div>
          <p style={{ fontSize: 14, color: "#6b6358", lineHeight: 1.6, marginTop: 6, maxWidth: "52ch", marginLeft: "auto", marginRight: "auto" }}>
            {tiered && pcTiered
              ? "Choose your construction option and your fixtures & tiles level above"
              : tiered
              ? "Choose your construction option above"
              : "Choose your fixtures & tiles level above"}
            {" "}— your combined total will appear here once you have. No rush, and you can change your selections as often as you like.
          </p>
        </div>
      ) : (
        <div style={{ border: `1px solid ${accent}`, borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: 11, color: "#9e978b", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>Your selection</div>
            <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: "#242220", marginTop: 2 }}>{cLabel}{showFixturesLine ? ` + ${pcLabel}` : ""}</div>
            <div style={{ marginTop: 12, borderTop: "1px solid #EFE9DF" }}>
              <div style={rowStyle}><span>Construction{brand.gstRegistered ? " (inc GST)" : ""}</span><b style={{ color: "#242220", fontVariantNumeric: "tabular-nums" }}>{money(cTotal, ccy)}</b></div>
              {showFixturesLine && <div style={rowStyle}><span>Fixtures &amp; tiles{brand.gstRegistered ? " (inc GST)" : ""}</span><b style={{ color: "#242220", fontVariantNumeric: "tabular-nums" }}>{money(pTotal, ccy)}</b></div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, paddingTop: 12, borderTop: "2px solid #242220" }}>
                <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 19, color: "#242220" }}>Total{brand.gstRegistered ? " (inc GST)" : ""}</span>
                <span style={{ fontFamily: DISP, fontWeight: 800, fontSize: 30, color: accent, fontVariantNumeric: "tabular-nums" }}>{money(grandTotal, ccy)}</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#9e978b", marginTop: 8 }}>{gstNote} · a {depositPct}% deposit ({money(deposit, ccy)}, on the construction total) secures your booking.</div>
          </div>

          {/* The comfort question — gentle permission to adjust to budget. */}
          {comfort && (
            <div style={{ padding: "15px 24px", background: `${accent}0c`, borderTop: `1px solid ${accent}22` }}>
              <p style={{ fontSize: 13.5, color: "#5f574c", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>{comfort}</p>
            </div>
          )}

          {/* Accept — screen-only (kept off the printed PDF). */}
          <div className="no-print" style={{ padding: "16px 24px 20px", borderTop: "1px solid #EFE9DF" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (so we know who's accepting)"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DBD2C4", borderRadius: 9, padding: "11px 12px", fontSize: 14, color: "#242220", background: "#FCFAF5" }}
            />
            <button onClick={accept} disabled={busy}
              style={{ marginTop: 12, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: accent, color: "#fff", border: 0, borderRadius: 10, padding: "13px 22px", fontSize: 15.5, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? <Loader2 style={{ width: 17, height: 17 }} className="animate-spin" /> : null} Accept my selection &amp; secure my date
            </button>
            {error && <p style={{ marginTop: 10, fontSize: 13, color: "#c0392b" }}>{error}</p>}
            <p style={{ marginTop: 10, fontSize: 11.5, color: "#9e978b", lineHeight: 1.55 }}>
              Accepting confirms agreement to the scope, pricing and payment schedule for your chosen combination.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  const config: QuoteConfiguratorConfig | undefined = isConfigurable
    ? {
        cTier,
        pcTier: pcChoice,
        onSelectTier: accepted ? undefined : setCTier,
        onSelectPcTier: accepted ? undefined : setPcChoice,
        intro: introNode,
        summary: summaryNode,
      }
    : undefined;

  return (
    <div style={{ minHeight: "100vh", background: "#EBE7DF" }}>
      {/* slim action bar (hidden when printing) */}
      <div
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          background: "rgba(255,255,255,.86)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid #DBD2C4",
          fontFamily: BODY,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: "#242220" }}>{businessName || "Your quote"}</span>
        <button
          onClick={() => window.print()}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: accent, color: "#fff", border: 0, borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Printer style={{ width: 15, height: 15 }} /> Download PDF
        </button>
      </div>

      <div className="quote-print-root" style={{ padding: "24px 0 48px" }}>
        {/* The document carries the inline configurator (intro + selectable tier
            cards + the calm total reveal) via `config`. acceptBlockPrintOnly hides
            the decorative accept block on screen, keeping it for the PDF. */}
        <QuoteDocument quote={quote} brand={brand} businessName={businessName} acceptBlockPrintOnly config={config} />
      </div>

      {/* Non-configurable quotes (single price, no choices) keep a simple accept
          below the document. Configurable quotes accept inline (in the summary). */}
      {!isConfigurable && (
        <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 64px", fontFamily: BODY }}>
          {accepted ? (
            <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: `1px solid ${accent}55`, textAlign: "center" }}>
              <CheckCircle2 style={{ width: 30, height: 30, color: "#3aa757", margin: "0 auto 8px" }} />
              <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>Accepted — thank you!</div>
              <p style={{ fontSize: 14, color: "#6b6358", marginTop: 6, lineHeight: 1.6 }}>
                {businessName || "We"} will be in touch to confirm your start date. A {depositPct}% deposit invoice ({money(deposit, ccy)}) is on its way to your email to lock it in.
              </p>
            </div>
          ) : (
            <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: "1px solid #DBD2C4" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>Ready to go ahead?</div>
              <p style={{ fontSize: 14, color: "#6b6358", margin: "6px 0 14px", lineHeight: 1.6 }}>
                Accept online to secure your booking. We&apos;ll email you a {depositPct}% deposit invoice to lock in your start date.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={{ flex: "1 1 200px", minWidth: 0, border: "1px solid #DBD2C4", borderRadius: 8, padding: "11px 12px", fontSize: 14, color: "#242220", background: "#FCFAF5" }}
                />
                <button
                  onClick={() => accept()}
                  disabled={busy}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: "#fff", border: 0, borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null} Accept &amp; secure my date
                </button>
              </div>
              {error && <p style={{ marginTop: 10, fontSize: 13, color: "#c0392b" }}>{error}</p>}
              <p style={{ marginTop: 12, fontSize: 11.5, color: "#9e978b" }}>
                Accepting confirms agreement to the scope, pricing and payment schedule above.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
