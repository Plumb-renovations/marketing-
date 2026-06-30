"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Loader2, CheckCircle2 } from "lucide-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import { money, tierTotals, TIERS, tierName, computeTotals, selectedAllowanceItems, allowanceGroups, priceableItems, type Quote, type TierKey } from "@/lib/quotes/model";
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

  const [accepted, setAccepted] = useState(quote.status === "accepted");
  const [name, setName] = useState(quote.clientName || "");
  const [busy, setBusy] = useState<TierKey | "single" | null>(null);
  const [error, setError] = useState("");
  const [chosenTier, setChosenTier] = useState<TierKey | null>(quote.acceptedTier);

  // Fixture groups + the client's selection (one option per group), defaulting to
  // the build-time default. Changing a selection reprices live.
  const groups = allowanceGroups(quote.items);
  const [fixtureSel, setFixtureSel] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [g.key, g.selectedId])));
  // Apply the live selection onto the items so totals count the chosen option only.
  const itemsSel = quote.items.map((it) => {
    if (!it.allowance) return it;
    const g = groups.find((grp) => grp.options.some((o) => o.id === it.id));
    if (!g) return it;
    return { ...it, allowanceSelected: (fixtureSel[g.key] ?? g.selectedId) === it.id };
  });
  const selectedFixtureIds = groups.map((g) => fixtureSel[g.key] ?? g.selectedId);
  const tiers = tierTotals(itemsSel, brand.gstRegistered, quote.gstInclusive);
  const singleTotal = computeTotals(priceableItems(itemsSel, null), brand.gstRegistered, quote.gstInclusive).total;
  const allowanceTotal = computeTotals(selectedAllowanceItems(itemsSel), brand.gstRegistered, quote.gstInclusive).total;
  const hasChoices = groups.some((g) => g.options.length > 1);

  const accept = async (tier?: TierKey) => {
    setBusy(tier || "single");
    setError("");
    try {
      const res = await fetch("/api/quotes/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, tier, fixtures: selectedFixtureIds }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setError("Sorry — we couldn't record your acceptance. Please try again or contact us.");
        return;
      }
      if (tier) setChosenTier(tier);
      setAccepted(true);
    } catch {
      setError("Sorry — we couldn't record your acceptance. Please try again or contact us.");
    } finally {
      setBusy(null);
    }
  };

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

      {/* Choose your fixtures — one option per group; reprices live. Hidden when
          printing and once accepted. Only shown when there's a choice to make. */}
      {!accepted && hasChoices && (
        <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 16px", fontFamily: "var(--font-body), Inter, system-ui, sans-serif" }}>
          <div style={{ borderRadius: 12, padding: "20px 22px", background: "#fff", border: "1px solid #DBD2C4" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>Choose your fixtures &amp; tiles</div>
            <p style={{ fontSize: 13.5, color: "#6b6358", margin: "6px 0 14px", lineHeight: 1.6 }}>Pick one option in each group — only your selection is counted in the allowance.</p>
            {groups.map((g) => {
              const sel = fixtureSel[g.key] ?? g.selectedId;
              if (g.options.length <= 1) {
                const o = g.options[0];
                return (
                  <div key={g.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid #EFEAE0", fontSize: 14, color: "#242220" }}>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{money((Number(o.qty) || 0) * (Number(o.unitPrice) || 0), ccy)}</span>
                  </div>
                );
              }
              return (
                <div key={g.key} style={{ padding: "10px 0", borderTop: "1px solid #EFEAE0" }}>
                  <div style={{ fontWeight: 700, color: "#242220", fontSize: 14, marginBottom: 6 }}>{g.name}</div>
                  {g.options.map((o) => {
                    const on = o.id === sel;
                    return (
                      <label key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 10px", marginBottom: 6, borderRadius: 8, cursor: "pointer", border: `1px solid ${on ? accent : "#E3DCCF"}`, background: on ? `${accent}0f` : "#fff" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#242220" }}>
                          <input type="radio" name={`grp-${g.key}`} checked={on} onChange={() => setFixtureSel((p) => ({ ...p, [g.key]: o.id }))} style={{ accentColor: accent }} />
                          {(o.description || "").split(/\r?\n/)[0] || "Option"}
                        </span>
                        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#242220" }}>{money((Number(o.qty) || 0) * (Number(o.unitPrice) || 0), ccy)}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 10, borderTop: "1px solid #DBD2C4", fontSize: 14, fontWeight: 700, color: "#242220" }}>
              <span>Fixture allowance</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(allowanceTotal, ccy)} <span style={{ fontSize: 11, fontWeight: 500, color: "#9e978b" }}>{brand.gstRegistered ? "inc GST" : ""}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Functional accept (hidden when printing). The template's accept block is
          decorative; this is the real, wired action. */}
      <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 64px", fontFamily: "var(--font-body), Inter, system-ui, sans-serif" }}>
        {accepted ? (
          <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: `1px solid ${accent}55`, textAlign: "center" }}>
            <CheckCircle2 style={{ width: 30, height: 30, color: "#3aa757", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>
              {chosenTier ? `${tierName(quote.tierNames, chosenTier)} option accepted — thank you!` : "Quote accepted — thank you!"}
            </div>
            <p style={{ fontSize: 14, color: "#6b6358", marginTop: 6, lineHeight: 1.6 }}>
              {businessName || "We"} will be in touch to confirm your start date. A deposit invoice
              {brand.depositPercent ? ` (${brand.depositPercent}% of ${money(chosenTier ? tiers[chosenTier].total : singleTotal, ccy)})` : ""} is on its way to your email to lock it in.
            </p>
          </div>
        ) : quote.tiered ? (
          <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: "1px solid #DBD2C4" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>Choose your option</div>
            <p style={{ fontSize: 14, color: "#6b6358", margin: "6px 0 14px", lineHeight: 1.6 }}>
              Pick the option that suits you. We&apos;ll email a {brand.depositPercent || 5}% deposit invoice for your chosen option to lock in your start date.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DBD2C4", borderRadius: 8, padding: "11px 12px", fontSize: 14, color: "#242220", background: "#FCFAF5", marginBottom: 12 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {TIERS.map((t) => (
                <div key={t.key} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, border: `1px solid ${t.key === "better" ? accent : "#DBD2C4"}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#242220" }}>
                      {tierName(quote.tierNames, t.key)}{t.key === "better" ? <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: accent }}>Most popular</span> : null}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: accent, marginTop: 2 }}>{money(tiers[t.key].total, ccy)} <span style={{ fontSize: 11, fontWeight: 500, color: "#9e978b" }}>{brand.gstRegistered ? "inc GST" : ""}</span></div>
                  </div>
                  <button
                    onClick={() => accept(t.key)}
                    disabled={busy !== null}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: "#fff", border: 0, borderRadius: 8, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy && busy !== t.key ? 0.5 : 1 }}
                  >
                    {busy === t.key ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null} Accept {tierName(quote.tierNames, t.key)}
                  </button>
                </div>
              ))}
            </div>
            {error && <p style={{ marginTop: 10, fontSize: 13, color: "#c0392b" }}>{error}</p>}
            <p style={{ marginTop: 12, fontSize: 11.5, color: "#9e978b" }}>
              Accepting confirms agreement to the scope, pricing and payment schedule for your chosen option.
            </p>
          </div>
        ) : (
          <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: "1px solid #DBD2C4" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>Ready to go ahead?</div>
            <p style={{ fontSize: 14, color: "#6b6358", margin: "6px 0 14px", lineHeight: 1.6 }}>
              Accept online to secure your booking. We&apos;ll email you a {brand.depositPercent || 5}% deposit invoice to lock in your start date.
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
                disabled={busy !== null}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: "#fff", border: 0, borderRadius: 8, padding: "12px 22px", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
              >
                {busy === "single" ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : null} Accept &amp; secure my date
              </button>
            </div>
            {error && <p style={{ marginTop: 10, fontSize: 13, color: "#c0392b" }}>{error}</p>}
            <p style={{ marginTop: 12, fontSize: 11.5, color: "#9e978b" }}>
              Accepting confirms agreement to the scope, pricing and payment schedule above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
