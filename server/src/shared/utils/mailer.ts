/**
 * Email building blocks (Backend Guide §22.2–22.3). The ONLY place `<html>`,
 * `<body>` and inline styles appear. Every dynamic value goes through these
 * helpers, which escape it, so customer-typed text can never inject HTML.
 */
const BRAND = {
  dark: "#3b1f2b",
  brand: "#8a3b5c",
  text: "#4a4446",
  muted: "#8a8285",
  border: "#e6dfe1",
  surface: "#f8f5f6",
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `{purpose} — {business}`; line breaks stripped so a name can never add a header. */
export function emailSubject(purpose: string, businessName?: string): string {
  const clean = (text: string) => text.replace(/[\r\n]+/g, " ").trim();
  return businessName ? `${clean(purpose)} — ${clean(businessName)}` : `${clean(purpose)} — Tailor Seamless`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${BRAND.dark};">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string): string {
  const html = escapeHtml(text).replace(/\n/g, "<br>");
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.text};">${html}</p>`;
}

export function infoBox(rows: [label: string, value: string][]): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:${BRAND.muted};font-size:14px;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:${BRAND.dark};font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return (
    `<table role="presentation" style="width:100%;margin:0 0 18px;padding:12px 16px;background:${BRAND.surface};` +
    `border-left:3px solid ${BRAND.brand};border-radius:4px;border-collapse:separate;">${cells}</table>`
  );
}

/** Only http(s) links render — anything else becomes plain text. */
export function button(label: string, url: string): string {
  if (!/^https?:\/\//i.test(url)) return paragraph(label);
  return (
    `<p style="margin:8px 0 20px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;` +
    `background:${BRAND.brand};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">` +
    `${escapeHtml(label)}</a></p>`
  );
}

export function footnote(text: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${BRAND.muted};">${escapeHtml(text)}</p>`;
}

/** The shared wrapper: a header with the business's name, a white card, a muted footer. */
export function emailLayout(body: string, options: { businessName: string; preheader?: string }): string {
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(options.preheader)}</div>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BRAND.surface};font-family:Helvetica,Arial,sans-serif;">
${preheader}
<table role="presentation" width="100%" style="background:${BRAND.surface};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="560" style="max-width:560px;width:100%;">
<tr><td style="background:${BRAND.dark};padding:18px 24px;border-radius:8px 8px 0 0;color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(options.businessName)}</td></tr>
<tr><td style="background:#ffffff;padding:28px 24px;border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 8px 8px;">${body}</td></tr>
<tr><td style="padding:16px 24px;color:${BRAND.muted};font-size:12px;text-align:center;">Sent with Tailor Seamless</td></tr>
</table></td></tr></table>
</body></html>`;
}

/** Plain-text counterpart: lines joined, blanks between paragraphs. */
export function textBody(lines: (string | null | undefined | false)[]): string {
  return lines.filter((line): line is string => typeof line === "string").join("\n\n");
}
