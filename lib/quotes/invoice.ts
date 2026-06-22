import { money, round2, GST_RATE } from "@/lib/quotes/model";
import type { BrandSettings } from "@/lib/business/brand";

// Deposit-invoice maths + email. Tax-invoice format (business name, ABN,
// invoice number, GST breakdown, payment details). Pure — no I/O. Designed so
// the future progress-claim invoices can reuse buildInvoiceEmail.

export interface InvoiceAmounts {
  percent: number;
  subtotal: number;
  gstAmount: number;
  total: number;
}

// Deposit = percent% of the accepted (GST-inclusive when registered) total.
// We back GST out of that amount for the breakdown.
export function computeDeposit(acceptedTotal: number, percent: number, gstRegistered: boolean): InvoiceAmounts {
  const total = round2((Number(acceptedTotal) || 0) * (Number(percent) || 0) / 100);
  if (!gstRegistered) return { percent, subtotal: total, gstAmount: 0, total };
  const subtotal = round2(total / (1 + GST_RATE));
  return { percent, subtotal, gstAmount: round2(total - subtotal), total };
}

// What's required for a compliant tax invoice — used to refuse a blank invoice.
export function missingInvoiceDetails(brand: BrandSettings): string[] {
  const missing: string[] = [];
  if (!brand.abn?.trim()) missing.push("ABN");
  if (!brand.bankDetails?.trim()) missing.push("bank / payment details");
  return missing;
}

export function buildDepositInvoiceEmail(args: {
  businessName: string;
  brand: BrandSettings;
  clientName: string;
  clientEmail: string;
  quoteNumber: string;
  invoiceNumber: string;
  amounts: InvoiceAmounts;
}): { subject: string; html: string; text: string } {
  const { businessName, brand, clientName, quoteNumber, invoiceNumber, amounts } = args;
  const accent = brand.brandColor || "#A86A45";
  const ink = brand.brandColor2 || "#242220";
  const ccy = brand.currency || "AUD";
  const biz = businessName || "Your contractor";
  const who = (clientName || "").trim().split(/\s+/)[0] || "there";
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  const desc = `Lock-in deposit — ${amounts.percent}% of accepted quote${quoteNumber ? ` ${quoteNumber}` : ""}`;
  const bankLines = (brand.bankDetails || "").split("\n").map((l) => l.trim()).filter(Boolean);

  const subject = `Deposit invoice ${invoiceNumber} — ${biz}`;

  const text = [
    `Hi ${who},`,
    ``,
    `Thanks for accepting your quote${quoteNumber ? ` (${quoteNumber})` : ""}. Here is your deposit invoice to lock in your booking.`,
    ``,
    `TAX INVOICE ${invoiceNumber}`,
    `${biz}${brand.abn ? ` · ABN ${brand.abn}` : ""}`,
    `Date: ${today}`,
    ``,
    `${desc}`,
    brand.gstRegistered ? `Subtotal (ex GST): ${money(amounts.subtotal, ccy)}` : "",
    brand.gstRegistered ? `GST 10%: ${money(amounts.gstAmount, ccy)}` : "",
    `Total due: ${money(amounts.total, ccy)}`,
    ``,
    bankLines.length ? `Payable to:\n${bankLines.join("\n")}\nRef: ${invoiceNumber}` : "",
    ``,
    biz,
  ].filter(Boolean).join("\n");

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:7px 0;color:#6b6358">${esc(label)}</td><td style="padding:7px 0;text-align:right;${strong ? `font-weight:700;color:${ink}` : "color:#3a342c"}">${esc(value)}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;padding:0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${ink}">
      <tr><td style="height:5px;background:${accent}"></td></tr>
      <tr><td style="padding:28px 32px 4px">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9e978b">Tax invoice</div>
        <div style="font-size:19px;font-weight:700;color:${ink};margin-top:2px">${esc(biz)}</div>
        <div style="font-size:12px;color:#6b6358;margin-top:2px">${brand.abn ? `ABN ${esc(brand.abn)}` : ""}${brand.licenceNo ? ` · ${esc(brand.licenceNo)}` : ""}</div>
      </td></tr>
      <tr><td style="padding:8px 32px 0;font-size:13px;color:#6b6358">
        <table role="presentation" width="100%"><tr>
          <td style="vertical-align:top"><div style="color:#9e978b;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Billed to</div><div style="color:${ink};margin-top:2px">${esc(clientName || "—")}</div></td>
          <td style="vertical-align:top;text-align:right"><div><b style="color:${ink}">Invoice</b> ${esc(invoiceNumber)}</div><div><b style="color:${ink}">Date</b> ${esc(today)}</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:18px 32px 6px">
        <table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #eee;border-bottom:1px solid #eee">
          <tr><td style="padding:12px 0;color:#3a342c">${esc(desc)}</td><td style="padding:12px 0;text-align:right;color:#3a342c">${esc(money(amounts.total, ccy))}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:4px 32px 8px">
        <table role="presentation" width="100%" style="font-size:14px">
          ${brand.gstRegistered ? row("Subtotal (ex GST)", money(amounts.subtotal, ccy)) : ""}
          ${brand.gstRegistered ? row("GST 10%", money(amounts.gstAmount, ccy)) : ""}
          <tr><td style="padding:10px 0;border-top:2px solid ${ink};font-weight:700;color:${ink}">Total due</td><td style="padding:10px 0;border-top:2px solid ${ink};text-align:right;font-weight:700;font-size:18px;color:${ink}">${esc(money(amounts.total, ccy))}</td></tr>
        </table>
        <div style="font-size:11px;color:#9e978b;text-align:right">All amounts in ${esc(ccy)}${brand.gstRegistered ? ", inclusive of GST" : ""}</div>
      </td></tr>
      <tr><td style="padding:14px 32px 30px;font-size:13px;line-height:1.7;color:#6b6358;border-top:1px solid #eee">
        <b style="color:${ink}">Payment details</b><br>${bankLines.map(esc).join("<br>")}<br>Ref: ${esc(invoiceNumber)}
        <div style="margin-top:14px">Thanks ${esc(who)} — paying this deposit secures your booking and scheduled start date.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html, text };
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
