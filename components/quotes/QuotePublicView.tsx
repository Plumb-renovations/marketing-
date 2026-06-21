"use client";

import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import QuoteDocument from "@/components/quotes/QuoteDocument";
import type { Quote } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";

// The public, mobile-friendly view of a sent quote. Renders the branded
// document, logs the open once (tracking beacon), and offers a print → PDF.
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
  }, [token]);

  const accent = brand.brandColor || "#A86A45";

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

      <div className="quote-print-root" style={{ padding: "24px 0 56px" }}>
        <QuoteDocument quote={quote} brand={brand} businessName={businessName} />
      </div>
    </div>
  );
}
