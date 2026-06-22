"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Loader2, CheckCircle2 } from "lucide-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import { money, type Quote } from "@/lib/quotes/model";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/quotes/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name }),
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
        <QuoteDocument quote={quote} brand={brand} businessName={businessName} />
      </div>

      {/* Functional accept (hidden when printing). The template's accept block is
          decorative; this is the real, wired action. */}
      <div className="no-print" style={{ maxWidth: 820, margin: "0 auto", padding: "0 16px 64px", fontFamily: "var(--font-body), Inter, system-ui, sans-serif" }}>
        {accepted ? (
          <div style={{ borderRadius: 12, padding: "22px 24px", background: "#fff", border: `1px solid ${accent}55`, textAlign: "center" }}>
            <CheckCircle2 style={{ width: 30, height: 30, color: "#3aa757", margin: "0 auto 8px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: "#242220" }}>Quote accepted — thank you!</div>
            <p style={{ fontSize: 14, color: "#6b6358", marginTop: 6, lineHeight: 1.6 }}>
              {businessName || "We"} will be in touch to confirm your start date. A deposit invoice
              {brand.depositPercent ? ` (${brand.depositPercent}% of ${money(quote.total, ccy)})` : ""} is on its way to your email to lock it in.
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
                onClick={accept}
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
    </div>
  );
}
