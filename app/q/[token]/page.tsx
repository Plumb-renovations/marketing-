import type { Metadata } from "next";
import { fetchPublicQuote } from "@/lib/quotes/publicServer";
import QuotePublicView from "@/components/quotes/QuotePublicView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const bundle = await fetchPublicQuote(token);
  if (!bundle) return { title: "Quote" };
  const biz = bundle.businessName || "Quote";
  return {
    title: `Quote${bundle.quote.quoteNumber ? ` ${bundle.quote.quoteNumber}` : ""} — ${biz}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const bundle = await fetchPublicQuote(token);

  if (!bundle) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#EBE7DF", padding: 24, fontFamily: "var(--font-body), Inter, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, textAlign: "center", color: "#3a342c" }}>
          <h1 style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontSize: 28, margin: "0 0 8px", color: "#242220" }}>Quote not found</h1>
          <p style={{ fontSize: 14, color: "#6b6358" }}>This link may have expired or been entered incorrectly. Please contact the business that sent it to you.</p>
        </div>
      </div>
    );
  }

  return <QuotePublicView quote={bundle.quote} brand={bundle.brand} businessName={bundle.businessName} token={token} />;
}
