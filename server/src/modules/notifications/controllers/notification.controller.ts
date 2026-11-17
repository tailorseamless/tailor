import type { Request, Response } from "express";
import { authUser, input } from "../../../shared/http/request";
import { ApiResponse } from "../../../shared/response/apiResponse";
import { NotificationService } from "../services/notification.service";
import { EmailOutboxService } from "../services/emailOutbox.service";
import { PreferenceService } from "../services/preference.service";
import {
  deviceSchema,
  listNotificationsSchema,
  listOutboxSchema,
  notificationIdSchema,
  updatePreferencesSchema,
} from "../validators/notification.schema";

export class NotificationController {
  static async list(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listNotificationsSchema);
    const result = await NotificationService.Instance.list(authUser(req), query);
    res.json(ApiResponse.ok("Notifications fetched", result.data, result.meta));
  }

  static async unreadCount(req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("Unread count fetched", await NotificationService.Instance.unreadCount(authUser(req))));
  }

  static async markRead(req: Request, res: Response): Promise<void> {
    const { params } = input(req, notificationIdSchema);
    await NotificationService.Instance.markRead(authUser(req), params.id);
    res.json(ApiResponse.ok("Notification marked as read", null));
  }

  static async outbox(req: Request, res: Response): Promise<void> {
    const { query } = input(req, listOutboxSchema);
    const result = await EmailOutboxService.Instance.list(authUser(req), query);
    res.json({ ...ApiResponse.ok("Emails fetched", result.data, result.meta), emailEnabled: result.emailEnabled });
  }

  static async preferences(req: Request, res: Response): Promise<void> {
    res.json(ApiResponse.ok("Preferences fetched", await PreferenceService.Instance.mine(authUser(req))));
  }

  static async updatePreferences(req: Request, res: Response): Promise<void> {
    const { body } = input(req, updatePreferencesSchema);
    const result = await PreferenceService.Instance.update(authUser(req), body.preferences);
    res.json(ApiResponse.ok("Preferences saved", result));
  }

  static async registerDevice(req: Request, res: Response): Promise<void> {
    const { body } = input(req, deviceSchema);
    const result = await PreferenceService.Instance.registerDevice(
      authUser(req),
      body.token,
      req.get("user-agent") ?? null,
    );
    res.json(ApiResponse.ok("This device will get notifications", result));
  }

  static async removeDevice(req: Request, res: Response): Promise<void> {
    const { body } = input(req, deviceSchema);
    res.json(
      ApiResponse.ok(
        "This device will not get notifications",
        await PreferenceService.Instance.removeDevice(authUser(req), body.token),
      ),
    );
  }

  static async markAllRead(req: Request, res: Response): Promise<void> {
    res.json(
      ApiResponse.ok("Notifications marked as read", await NotificationService.Instance.markAllRead(authUser(req))),
    );
  }
}
