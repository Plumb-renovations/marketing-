import { money } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";

// Builds the short, branded email that delivers a quote: a friendly line, the
// quote number + total, a clear "View your quote" button to the tracked link,
// and the sales contact. HTML themed to the business's brand colour, with a
// plain-text fallback. Pure — no I/O.
export function buildQuoteEmail(args: {
  businessName: string;
  brand: BrandSettings;
  clientName: string;
  quoteNumber: string;
  total: number;
  link: string;
}): { subject: string; html: string; text: string } {
  const { businessName, brand, clientName, quoteNumber, total, link } = args;
  const accent = brand.brandColor || "#A86A45";
  const ink = brand.brandColor2 || "#242220";
  const ccy = brand.currency || "AUD";
  const who = (clientName || "").trim().split(/\s+/)[0] || "there";
  const biz = businessName || "your contractor";
  const contact =
    brand.contactName || brand.contactPhone
      ? `Any questions, just reply to this email${brand.contactName ? ` or call ${brand.contactName}` : ""}${brand.contactPhone ? ` on ${brand.contactPhone}` : ""}.`
      : "Any questions, just reply to this email.";

  const subject = `Your quote from ${biz}${quoteNumber ? ` — ${quoteNumber}` : ""}`;

  const text = [
    `Hi ${who},`,
    ``,
    `Thanks for the opportunity. Your quote${quoteNumber ? ` (${quoteNumber})` : ""} from ${biz} is ready to view — total ${money(total, ccy)}.`,
    ``,
    `View your quote: ${link}`,
    ``,
    `You can read the full breakdown, download a PDF and accept online from that link.`,
    ``,
    contact,
    ``,
    biz,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;padding:0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${ink}">
        <tr><td style="height:5px;background:${accent}"></td></tr>
        <tr><td style="padding:30px 32px 8px">
          <div style="font-size:18px;font-weight:700;color:${ink}">${esc(biz)}</div>
        </td></tr>
        <tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6;color:#3a342c">
          <p style="margin:0 0 14px">Hi ${esc(who)},</p>
          <p style="margin:0 0 14px">Thanks for the opportunity. Your quote${quoteNumber ? ` <strong>${esc(quoteNumber)}</strong>` : ""} is ready to view — total <strong>${esc(money(total, ccy))}</strong>.</p>
          <p style="margin:0 0 22px">You can read the full breakdown, download a PDF and accept online from the link below.</p>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 8px">
          <a href="${esc(link)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:6px">View your quote</a>
        </td></tr>
        <tr><td style="padding:14px 32px 4px;font-size:12px;color:#8a8276;word-break:break-all">
          Or paste this link into your browser:<br><a href="${esc(link)}" style="color:${accent}">${esc(link)}</a>
        </td></tr>
        <tr><td style="padding:18px 32px 30px;font-size:13px;line-height:1.6;color:#6b6358;border-top:1px solid #eee;margin-top:10px">
          ${esc(contact)}<br><br>${esc(biz)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
