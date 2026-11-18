import type { Request, Response } from "express";
import { input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { PortalService } from "../services/portal.service";
import {
  shopPageSchema,
  bookingRequestSchema,
  portalConfirmSchema,
  portalReceiptSchema,
  portalRequestSchema,
  portalSchema,
} from "../validators/portal.schema";

/** Public: no signed-in user. The link or the page address is the only key. */
export class PortalController {
  static async view(req: Request, res: Response): Promise<void> {
    const { params } = input(req, portalSchema);
    res.set("Cache-Control", "no-store");
    res.json(ApiResponse.ok("Portal fetched", await PortalService.Instance.view(params.token)));
  }

  static async receiptPdf(req: Request, res: Response): Promise<void> {
    const { params } = input(req, portalReceiptSchema);
    const file = await PortalService.Instance.receiptPdf(params.token, params.paymentId);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    });
    res.send(file.content);
  }

  static async confirmAppointment(req: Request, res: Response): Promise<void> {
    const { params } = input(req, portalConfirmSchema);
    const result = await PortalService.Instance.confirmAppointment(params.token, params.appointmentId);
    res.json(ApiResponse.ok("Thank you, see you then", result));
  }

  static async request(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, portalRequestSchema);
    const request = await PortalService.Instance.requestFromPortal(params.token, body);
    res.status(201).json(ApiResponse.created("Request sent", { id: request.id, status: request.status }));
  }

  static async shopPage(req: Request, res: Response): Promise<void> {
    const { params } = input(req, shopPageSchema);
    res.json(ApiResponse.ok("Page fetched", await PortalService.Instance.shopPage(params.slug)));
  }

  static async bookingRequest(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, bookingRequestSchema);
    const result = await PortalService.Instance.requestFromBookingPage(params.slug, body);
    res.status(201).json(ApiResponse.created("Request sent", result));
  }
}
