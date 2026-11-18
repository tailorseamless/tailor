import { env } from "../../../config/env";
import {
  button,
  emailLayout,
  emailSubject,
  footnote,
  heading,
  infoBox,
  paragraph,
  textBody,
} from "../../../shared/utils/mailer";
import {
  APPOINTMENT_TYPE_LABELS,
  formatDateTime,
  formatMoney,
  formatShortDateTime,
  PAYMENT_METHOD_LABELS,
} from "../../../shared/utils/format";
import type { ReceiptDTO } from "../../payments/dto/payment.dto";
import type { EmailPayloads } from "../dto/email.dto";

/** Every template returns { subject, html, text } — pure, built only from the helpers (Backend Guide §22.3). */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const typeLabel = (type: string) => APPOINTMENT_TYPE_LABELS[type] ?? type;

/** Tone: transactional. */
export function invitationEmail(p: EmailPayloads["team.invitation"]): RenderedEmail {
  const link = `${env.appUrl}/sign-in?mode=signUp&email=${encodeURIComponent(p.email)}`;
  const intro = `${p.inviterName} has added you to ${p.businessName} on TailorFlow as ${p.role}.`;
  const how = `Create your login with this email address (${p.email}) and you will go straight to the team's workspace.`;
  return {
    subject: emailSubject(`You've been added to ${p.businessName}`),
    html: emailLayout(
      heading(`Welcome, ${p.inviteeName}`) +
        paragraph(intro) +
        paragraph(how) +
        button("Create your login", link) +
        footnote("If you were not expecting this, you can ignore this email."),
      { businessName: p.businessName, preheader: intro },
    ),
    text: textBody([`Welcome, ${p.inviteeName}`, intro, how, `Create your login: ${link}`]),
  };
}

/** Tone: transactional. */
export function appointmentReminderEmail(p: {
  businessName: string;
  businessAddress: string | null;
  businessPhone: string | null;
  customerName: string;
  type: string;
  startsAt: Date;
  durationMinutes: number;
  timeZone: string;
}): RenderedEmail {
  const when = formatShortDateTime(p.startsAt, p.timeZone);
  const rows: [string, string][] = [
    ["What", typeLabel(p.type)],
    ["When", when],
    ["How long", `${p.durationMinutes} minutes`],
  ];
  if (p.businessAddress) rows.push(["Where", p.businessAddress]);
  const change = p.businessPhone
    ? `Need to change it? Call or message us on ${p.businessPhone}.`
    : "Need to change it? Reply to this email.";
  return {
    subject: emailSubject(`Reminder: your ${typeLabel(p.type).toLowerCase()} on ${when}`, p.businessName),
    html: emailLayout(
      heading(`See you soon, ${p.customerName}`) +
        paragraph(`This is a reminder of your appointment with ${p.businessName}.`) +
        infoBox(rows) +
        paragraph(change),
      { businessName: p.businessName, preheader: `${typeLabel(p.type)} — ${when}` },
    ),
    text: textBody([
      `See you soon, ${p.customerName}`,
      `This is a reminder of your appointment with ${p.businessName}.`,
      rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
      change,
    ]),
  };
}

/** Tone: transactional. The PDF is attached by the sender. */
export function receiptEmail(receipt: ReceiptDTO): RenderedEmail {
  const money = (amount: number) => formatMoney(amount, receipt.currency);
  const isRefund = receipt.kind === "refund";
  const name = receipt.customer?.fullName ?? "there";
  const headline = isRefund ? `Refund of ${money(receipt.amount)}` : `Thank you for your payment`;
  const rows: [string, string][] = [
    ["Receipt", receipt.receiptNumber],
    ["Order", receipt.order.orderNumber],
    [isRefund ? "Refunded" : "Paid", money(receipt.amount)],
    ["Method", PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method],
    ["Date", formatDateTime(receipt.paidAt, receipt.business.timeZone)],
    // While an item has only an estimate the total is not final, so say that instead of a misleading 0.00.
    [
      "Order total",
      receipt.order.pricePending
        ? `To be confirmed${receipt.order.estimatedMaxTotal !== null ? ` (up to ${money(receipt.order.estimatedMaxTotal)})` : ""}`
        : money(receipt.order.totalAmount),
    ],
    ["Balance", receipt.order.pricePending ? "To be confirmed" : money(receipt.order.balance)],
  ];
  const intro = isRefund
    ? `Hello ${name}, we have refunded ${money(receipt.amount)} on order ${receipt.order.orderNumber}.`
    : `Hello ${name}, we have received ${money(receipt.amount)} for order ${receipt.order.orderNumber}.`;
  return {
    subject: emailSubject(`${isRefund ? "Refund receipt" : "Receipt"} ${receipt.receiptNumber}`, receipt.business.name),
    html: emailLayout(
      heading(headline) + paragraph(intro) + infoBox(rows) + footnote("Your receipt is attached as a PDF."),
      { businessName: receipt.business.name, preheader: intro },
    ),
    text: textBody([
      headline,
      intro,
      rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
      "Your receipt is attached as a PDF.",
    ]),
  };
}

/** Tone: transactional — sent to whoever asked for an appointment online. */
export function requestReceivedEmail(p: EmailPayloads["appointment.request_received"]): RenderedEmail {
  const when = formatShortDateTime(new Date(p.preferredStartsAt), p.timeZone);
  const intro = `We have your request for a ${typeLabel(p.type).toLowerCase()} around ${when}. We will confirm the time shortly.`;
  return {
    subject: emailSubject("We received your appointment request", p.businessName),
    html: emailLayout(heading(`Thank you, ${p.name}`) + paragraph(intro), {
      businessName: p.businessName,
      preheader: intro,
    }),
    text: textBody([`Thank you, ${p.name}`, intro]),
  };
}

/** Tone: transactional when accepted; kind but clear, with the next step, when declined. */
/** The email copy of an in-app notification (Backend Guide §22.10). Tone: transactional. */
export function notificationEmail(p: {
  businessName: string;
  title: string;
  body: string | null;
  linkPath: string | null;
}): RenderedEmail {
  const link = `${env.appUrl}${p.linkPath && /^\/(?![/\\])/.test(p.linkPath) ? p.linkPath : "/notifications"}`;
  const settings = "Choose which emails you receive in Settings → Notifications.";
  return {
    subject: emailSubject(p.title, p.businessName),
    html: emailLayout(
      heading(p.title) + (p.body ? paragraph(p.body) : "") + button("Open TailorFlow", link) + footnote(settings),
      { businessName: p.businessName, preheader: p.body ?? p.title },
    ),
    text: textBody([p.title, p.body, `Open TailorFlow: ${link}`, settings]),
  };
}

export function requestDecidedEmail(p: EmailPayloads["appointment.request_decided"]): RenderedEmail {
  const accepted = p.decision === "accepted";
  const when = p.startsAt ? formatShortDateTime(new Date(p.startsAt), p.timeZone) : null;
  const intro = accepted
    ? `Your ${typeLabel(p.type).toLowerCase()} is booked for ${when}.`
    : `We are sorry, we could not book the ${typeLabel(p.type).toLowerCase()} you asked for.`;
  const next = accepted
    ? null
    : p.businessPhone
      ? `Please call or message us on ${p.businessPhone} and we will find another time.`
      : "Please reply to this email and we will find another time.";
  return {
    subject: emailSubject(
      accepted ? `Appointment confirmed: ${when}` : "About your appointment request",
      p.businessName,
    ),
    html: emailLayout(
      heading(accepted ? `You're booked, ${p.name}` : `Hello ${p.name}`) +
        paragraph(intro) +
        (p.note ? paragraph(p.note) : "") +
        (next ? paragraph(next) : ""),
      { businessName: p.businessName, preheader: intro },
    ),
    text: textBody([accepted ? `You're booked, ${p.name}` : `Hello ${p.name}`, intro, p.note, next]),
  };
}

/** Tone: warm, transactional — the customer hears their clothes are ready (PRD: customer status updates). */
export function orderUpdateEmail(p: {
  businessName: string;
  businessPhone: string | null;
  businessAddress: string | null;
  customerName: string;
  orderNumber: string;
  garments: string;
  status: "fitting" | "ready" | "delivered";
  balance: number;
  currency: string;
}): RenderedEmail {
  const first = p.customerName.split(" ")[0] || p.customerName;
  const owing = p.balance > 0 ? formatMoney(p.balance, p.currency) : null;
  const call = p.businessPhone ? `call us on ${p.businessPhone}` : "reply to this email";
  const copy = {
    fitting: {
      subject: "Your order is ready for a fitting",
      headline: `Time for your fitting, ${first}`,
      intro: `Your ${p.garments} (order ${p.orderNumber}) is ready for you to try on. Please come in for a fitting, or ${call} to arrange a time.`,
      extra: null,
    },
    ready: {
      subject: "Your order is ready to collect",
      headline: `Good news, ${first}`,
      intro: `Your ${p.garments} (order ${p.orderNumber}) is ready for collection.`,
      extra: owing ? `The balance of ${owing} is due when you collect.` : null,
    },
    delivered: {
      subject: "Thank you for your order",
      headline: `Thank you, ${first}`,
      intro: `We hope you love your ${p.garments}. Order ${p.orderNumber} is now complete.`,
      extra: owing ? `There is still ${owing} to pay on this order.` : null,
    },
  }[p.status];
  const rows: [string, string][] = [
    ["Order", p.orderNumber],
    ["Items", p.garments],
    ...(owing ? ([["Balance", owing]] as [string, string][]) : []),
    ...(p.status === "ready" && p.businessAddress ? ([["Collect from", p.businessAddress]] as [string, string][]) : []),
  ];
  return {
    subject: emailSubject(copy.subject, p.businessName),
    html: emailLayout(
      heading(copy.headline) + paragraph(copy.intro) + infoBox(rows) + (copy.extra ? paragraph(copy.extra) : ""),
      { businessName: p.businessName, preheader: copy.intro },
    ),
    text: textBody([
      copy.headline,
      copy.intro,
      rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
      copy.extra,
    ]),
  };
}
