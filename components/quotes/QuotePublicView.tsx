"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Loader2, CheckCircle2 } from "lucide-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import { money, computeTotals, buildItemsForTier, tierTotals, pcTierTotals, pcAllowanceItems, TIERS, tierName, pcTierName, type Quote, type TierKey } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";

// The public, mobile-friendly view of a sent quote. Renders the branded
// document, logs the open once (tracking beacon), offers a print → PDF, and
// lets the client accept online (which records the win + emails the deposit).
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

  // Two parallel choices the client configures: a construction tier + a PC
  // (fixtures & tiles) tier. The live total = chosen construction (build-only) +
  // chosen PC allowance, updating instantly as either selection changes.
  const tiers = tierTotals(quote.items, brand.gstRegistered, quote.gstInclusive);
  const pcTiers = pcTierTotals(quote.items, brand.gstRegistered, quote.gstInclusive);
  const tiered = !!quote.tiered;
  const hasAllowance = quote.items.some((i) => i.allowance);
  const pcTiered = !!quote.pcTiered && hasAllowance;
  // A configurator (live total + selection) only makes sense when at least one
  // axis is a choice; otherwise it's a plain single-price accept.
  const isConfigurable = tiered || pcTiered;

  // Current selection (pre-set to the middle option so a total always shows; the
  // client changes it freely and watches the price move).
  const [cTier, setCTier] = useState<TierKey>(quote.acceptedTier ?? "better");
  const [pcChoice, setPcChoice] = useState<TierKey>(quote.acceptedPcTier ?? "better");

  // Live amounts. Construction (build-only) drives the deposit; PC is the
  // fixtures/tiles allowance. Flat (non-tiered) axes use their fixed total.
  const constructionFlat = computeTotals(buildItemsForTier(quote.items, null), brand.gstRegistered, quote.gstInclusive).total;
  const allowanceFlat = computeTotals(pcAllowanceItems(quote.items, null), brand.gstRegistered, quote.gstInclusive).total;
  const cTotal = tiered ? tiers[cTier].total : constructionFlat;
  const pTotal = pcTiered ? pcTiers[pcChoice].total : allowanceFlat;
  const grandTotal = cTotal + pTotal;
  const depositPct = brand.depositPercent || 5;
  const deposit = Math.round((cTotal * depositPct) / 100 * 100) / 100;
  const cLabel = tiered ? tierName(quote.tierNames, cTier) : "Construction";
  const pcLabel = pcTiered ? pcTierName(quote.pcTierNames, pcChoice) : hasAllowance ? "Fixtures & tiles" : "";

  const accept = async () => {
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

  // First line of the configurator intro shows as a heading, the rest as body.
  const introRaw = (quote.configuratorIntro || "").trim();
  const introLines = introRaw ? introRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const introHeading = introLines[0] || "";
  const introBody = introLines.slice(1);

  // Trade/first-line summary of what a given tier ADDS (its extras), for the
  // option cards — reassures without exposing per-item prices.
  const firstLines = (items: Quote["items"]) => items.map((it) => (it.description || "").split(/\r?\n/)[0].trim()).filter(Boolean);
  const cExtras = (key: TierKey) => firstLines(quote.items.filter((i) => !i.allowance && i.tier === key));
  const pcCovered = (key: TierKey) => firstLines(pcAllowanceItems(quote.items, key));

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
          fontFamily: "var(--font-body), Inter, system-ui, sans-serif",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: "#242220" }}>{businessName || "Your quote"}</span>
        <button
          onClick={() => window.print()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: accent,
            color: "#fff",
            border: 0,
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Printer style={{ width: 15, height: 15 }} /> Download PDF
        </button>
      </div>

      <div className="quote-print-root" style={{ padding: "24px 0 24px" }}>
        {/* acceptBlockPrintOnly: hide the document's decorative accept block on
            screen (the wired Accept action is below) but keep it on the PDF. */}
        <QuoteDocument quote={quote} brand={brand} businessName={businessName} acceptBlockPrintOnly />
      </div>

      {/* ============ ACCEPTED — confirmation ============ */}
      {accepted ? (
        <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 64px", fontFamily: BODY }}>
          <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: `1px solid ${accent}55`, textAlign: "center" }}>
            <CheckCircle2 style={{ width: 30, height: 30, color: "#3aa757", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>
              {isConfigurable ? `${cLabel}${pcTiered ? ` + ${pcLabel}` : ""} accepted — thank you!` : "Quote accepted — thank you!"}
            </div>
            <p style={{ fontSize: 14, color: "#6b6358", marginTop: 6, lineHeight: 1.6 }}>
              {businessName || "We"} will be in touch to confirm your start date. A {depositPct}% deposit invoice
              {" "}({money(deposit, ccy)} of your construction total) is on its way to your email to lock it in.
            </p>
            <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: "#242220" }}>Your total: {money(grandTotal, ccy)}{brand.gstRegistered ? " inc GST" : ""}</div>
          </div>
        </div>
      ) : isConfigurable ? (
        /* ============ INTERACTIVE CONFIGURATOR ============ */
        <>
          {/* extra bottom padding so the sticky total bar never covers content */}
          <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 24px", fontFamily: BODY }}>
            <div style={{ borderRadius: 14, background: "#fff", border: "1px solid #DBD2C4", overflow: "hidden" }}>
              {/* Intro framing — "Your quote, your way." */}
              {introHeading && (
                <div style={{ padding: "20px 22px", borderBottom: "1px solid #EFE9DF", background: `${accent}0a` }}>
                  <div style={{ fontFamily: DISP, fontSize: 23, fontWeight: 700, color: "#242220", lineHeight: 1.15 }}>{introHeading}</div>
                  {introBody.map((p, i) => (
                    <p key={i} style={{ fontSize: 14, color: "#6b6358", lineHeight: 1.6, margin: i === 0 ? "8px 0 0" : "6px 0 0" }}>{p}</p>
                  ))}
                </div>
              )}

              <div style={{ padding: "18px 22px" }}>
                {/* Construction level selector */}
                {tiered && (
                  <div style={{ marginBottom: pcTiered ? 22 : 4 }}>
                    <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 700, color: "#242220" }}>{pcTiered ? "1. " : ""}Choose your construction level</div>
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      {TIERS.map((t) => {
                        const on = cTier === t.key;
                        const extras = cExtras(t.key);
                        return (
                          <button key={t.key} type="button" onClick={() => setCTier(t.key)} aria-pressed={on}
                            style={{ textAlign: "left", cursor: "pointer", width: "100%", padding: "13px 15px", borderRadius: 11, border: `1.5px solid ${on ? accent : "#E3DCCF"}`, background: on ? `${accent}12` : "#fff", transition: "border-color .12s, background .12s" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15.5, fontWeight: 700, color: "#242220" }}>
                                <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? accent : "#C9C0B0"}`, background: on ? accent : "transparent", boxShadow: on ? `inset 0 0 0 3px #fff` : "none", flexShrink: 0 }} />
                                {tierName(quote.tierNames, t.key)}{t.key === "better" ? <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>Most popular</span> : null}
                              </span>
                              <span style={{ fontSize: 18, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{money(tiers[t.key].total, ccy)}</span>
                            </div>
                            <div style={{ fontSize: 12.5, color: "#6b6358", marginTop: 6, paddingLeft: 27 }}>{extras.length > 0 ? <>Adds: {extras.join(" · ")}</> : "The base build."}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PC items & tiles selector */}
                {pcTiered && (
                  <div>
                    <div style={{ fontFamily: DISP, fontSize: 18, fontWeight: 700, color: "#242220" }}>{tiered ? "2. " : ""}Choose your fixtures &amp; tiles</div>
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                      {TIERS.map((t) => {
                        const on = pcChoice === t.key;
                        const covered = pcCovered(t.key);
                        return (
                          <button key={t.key} type="button" onClick={() => setPcChoice(t.key)} aria-pressed={on}
                            style={{ textAlign: "left", cursor: "pointer", width: "100%", padding: "13px 15px", borderRadius: 11, border: `1.5px solid ${on ? accent : "#E3DCCF"}`, background: on ? `${accent}12` : "#fff", transition: "border-color .12s, background .12s" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15.5, fontWeight: 700, color: "#242220" }}>
                                <span style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? accent : "#C9C0B0"}`, background: on ? accent : "transparent", boxShadow: on ? `inset 0 0 0 3px #fff` : "none", flexShrink: 0 }} />
                                {pcTierName(quote.pcTierNames, t.key)}{t.key === "better" ? <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>Most popular</span> : null}
                              </span>
                              <span style={{ fontSize: 18, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{money(pcTiers[t.key].total, ccy)}</span>
                            </div>
                            {covered.length > 0 && <div style={{ fontSize: 12.5, color: "#6b6358", marginTop: 6, paddingLeft: 27 }}>Covered: {covered.join(" · ")}</div>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Name + reassurance */}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name (so we know who's accepting)"
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DBD2C4", borderRadius: 9, padding: "11px 12px", fontSize: 14, color: "#242220", background: "#FCFAF5", marginTop: 18 }}
                />
                <p style={{ marginTop: 10, fontSize: 11.5, color: "#9e978b", lineHeight: 1.55 }}>
                  Change your selections as often as you like — your price updates instantly below. Accepting confirms the scope, pricing and payment schedule for your chosen combination.
                </p>
                {error && <p style={{ marginTop: 8, fontSize: 13, color: "#c0392b" }}>{error}</p>}
              </div>
            </div>
          </div>

          {/* Sticky LIVE TOTAL + accept — pinned so the price is always in view as
              the client taps options (tight pick → see total → adjust loop). */}
          <div className="no-print" style={{ position: "sticky", bottom: 0, zIndex: 9, background: "rgba(252,250,245,.97)", backdropFilter: "blur(8px)", borderTop: `1px solid ${accent}44`, boxShadow: "0 -8px 24px rgba(36,24,16,.12)", fontFamily: BODY }}>
            <div style={{ maxWidth: 820, margin: "0 auto", padding: "12px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <div style={{ flex: "1 1 180px", minWidth: 150 }}>
                <div style={{ fontSize: 10.5, color: "#9e978b", textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700 }}>Your selection</div>
                <div style={{ fontSize: 14.5, color: "#242220", fontWeight: 700, marginTop: 1 }}>{cLabel}{pcTiered ? ` + ${pcLabel}` : ""}</div>
                <div style={{ fontSize: 11.5, color: "#9e978b", marginTop: 1 }}>incl. {depositPct}% deposit {money(deposit, ccy)} to lock in your date</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#9e978b" }}>Total{brand.gstRegistered ? " inc GST" : ""}</div>
                <div style={{ fontFamily: DISP, fontSize: 30, fontWeight: 800, color: accent, fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>{money(grandTotal, ccy)}</div>
              </div>
              <button onClick={accept} disabled={busy}
                style={{ flex: "1 1 100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: accent, color: "#fff", border: 0, borderRadius: 10, padding: "13px 22px", fontSize: 15.5, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                {busy ? <Loader2 style={{ width: 17, height: 17 }} className="animate-spin" /> : null} Accept my selection &amp; secure my date
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ============ SINGLE-PRICE accept (no choices) ============ */
        <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 64px", fontFamily: BODY }}>
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
        </div>
      )}
    </div>
  );
}
