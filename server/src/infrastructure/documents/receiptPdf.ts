import PDFDocument from "pdfkit";
import { formatDateTime, formatMoney, PAYMENT_METHOD_LABELS } from "../../shared/utils/format";
import type { ReceiptDTO } from "../../modules/payments/dto/payment.dto";

const INK = "#2b2427";
const MUTED = "#7d7376";
const BRAND = "#8a3b5c";

/** A printable A5 receipt (PRD US-036). Built in memory; nothing is written to disk. */
export function renderReceiptPdf(receipt: ReceiptDTO): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A5",
      margin: 36,
      info: { Title: `Receipt ${receipt.receiptNumber}`, Author: receipt.business.name },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - 72;
    const money = (amount: number) => formatMoney(amount, receipt.currency);

    // Business
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(16).text(receipt.business.name, { width });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9);
    for (const line of [receipt.business.address, receipt.business.phone, receipt.business.email]) {
      if (line) doc.text(line, { width });
    }

    // Title
    doc.moveDown(1.2);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(13);
    doc.text(receipt.kind === "refund" ? "REFUND RECEIPT" : "PAYMENT RECEIPT", { width });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    doc.text(`${receipt.receiptNumber}  ·  ${formatDateTime(receipt.paidAt, receipt.business.timeZone)}`, { width });

    // Lines
    const row = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(MUTED)
        .text(label, 36, y, { width: width * 0.45 });
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(INK)
        .text(value, 36 + width * 0.45, y, { width: width * 0.55, align: "right" });
      doc.moveDown(0.4);
    };
    const rule = () => {
      doc.moveDown(0.3);
      doc
        .moveTo(36, doc.y)
        .lineTo(36 + width, doc.y)
        .strokeColor("#e6dfe1")
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.6);
    };

    doc.moveDown(1);
    rule();
    if (receipt.customer) row("Customer", receipt.customer.fullName);
    row("Order", receipt.order.orderNumber);
    row("Method", PAYMENT_METHOD_LABELS[receipt.method] ?? receipt.method);
    if (receipt.reference) row("Reference", receipt.reference);
    rule();
    row(receipt.kind === "refund" ? "Amount refunded" : "Amount paid", money(receipt.amount), true);
    rule();
    // While an item has only an estimate the total is not final, so say that instead of a misleading 0.00.
    const pending = receipt.order.pricePending;
    const estimate = receipt.order.estimatedMaxTotal;
    row(
      "Order total",
      pending
        ? `To be confirmed${estimate !== null ? ` (up to ${money(estimate)})` : ""}`
        : money(receipt.order.totalAmount),
    );
    row("Paid so far", money(receipt.order.amountPaid));
    row("Balance", pending ? "To be confirmed" : money(receipt.order.balance), true);

    if (receipt.note) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(receipt.note, 36, doc.y, { width });
    }

    if (receipt.voided) {
      doc.save();
      doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc
        .font("Helvetica-Bold")
        .fontSize(64)
        .fillColor("#c0392b")
        .opacity(0.18)
        .text("VOID", 0, doc.page.height / 2 - 40, { width: doc.page.width, align: "center" });
      doc.restore();
    }

    doc
      .opacity(1)
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text("Thank you for your business.", 36, doc.page.height - 60, { width, align: "center" });
    doc.end();
  });
}
