import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { PaymentService } from "../services/payment.service";
import {
  listOrderPaymentsSchema,
  listPaymentsSchema,
  emailReceiptSchema,
  paymentIdSchema,
  recordPaymentSchema,
  recordRefundSchema,
  voidPaymentSchema,
} from "../validators/payment.schema";

export class PaymentController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listPaymentsSchema);
    const result = await PaymentService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Payments fetched", result.data, result.meta));
  }

  static async listForOrder(req: Request, res: Response): Promise<void> {
    const { params, query } = input(req, listOrderPaymentsSchema);
    const result = await PaymentService.Instance.listForOrder(authUser(req), params.orderId, query);
    res.json(ApiResponse.ok("Payments fetched", result.data, result.meta));
  }

  static async record(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, recordPaymentSchema);
    const result = await PaymentService.Instance.record(authUser(req), params.orderId, body);
    res.status(201).json(ApiResponse.created("Payment recorded", result));
  }

  static async refund(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, recordRefundSchema);
    const result = await PaymentService.Instance.refund(authUser(req), params.orderId, body);
    res.status(201).json(ApiResponse.created("Refund recorded", result));
  }

  static async void(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, voidPaymentSchema);
    const result = await PaymentService.Instance.void(authUser(req), params.id, body);
    res.status(201).json(ApiResponse.created("Payment voided", result));
  }

  static async receipt(req: Request, res: Response): Promise<void> {
    const { params } = input(req, paymentIdSchema);
    const receipt = await PaymentService.Instance.receipt(authUser(req), params.id);
    res.json(ApiResponse.ok("Receipt fetched", receipt));
  }

  /** A file, not the JSON envelope. Built in full before any byte is sent, so errors stay ordinary JSON. */
  static async receiptPdf(req: Request, res: Response): Promise<void> {
    const { params } = input(req, paymentIdSchema);
    const file = await PaymentService.Instance.receiptPdf(authUser(req), params.id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    });
    res.send(file.content);
  }

  static async emailReceipt(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, emailReceiptSchema);
    const result = await PaymentService.Instance.emailReceipt(authUser(req), params.id, body.to);
    res
      .status(202)
      .json(
        ApiResponse.ok(
          result.emailEnabled ? "Receipt queued for sending" : "Receipt queued; email is not set up yet",
          result,
        ),
      );
  }
}
