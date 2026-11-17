import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { AppointmentService } from "../services/appointment.service";
import {
  appointmentIdSchema,
  closeAppointmentSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  rescheduleAppointmentSchema,
  updateAppointmentSchema,
} from "../validators/appointment.schema";

export class AppointmentController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listAppointmentsSchema);
    const result = await AppointmentService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Appointments fetched", result.data, result.meta));
  }

  static async detail(req: Request, res: Response): Promise<void> {
    const { params } = input(req, appointmentIdSchema);
    const appointment = await AppointmentService.Instance.detail(authUser(req), params.id);
    res.json(ApiResponse.ok("Appointment fetched", appointment));
  }

  static async create(req: Request, res: Response): Promise<void> {
    const { body } = input(req, createAppointmentSchema);
    const appointment = await AppointmentService.Instance.create(authUser(req), body);
    res.status(201).json(ApiResponse.created("Appointment scheduled", appointment));
  }

  static async update(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, updateAppointmentSchema);
    const appointment = await AppointmentService.Instance.update(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Appointment updated", appointment));
  }

  static async reschedule(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, rescheduleAppointmentSchema);
    const appointment = await AppointmentService.Instance.reschedule(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Appointment rescheduled", appointment));
  }

  static async close(req: Request, res: Response): Promise<void> {
    const { params, body } = input(req, closeAppointmentSchema);
    const appointment = await AppointmentService.Instance.close(authUser(req), params.id, body);
    res.json(ApiResponse.ok("Appointment updated", appointment));
  }
}
