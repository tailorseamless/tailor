import type { Actor } from "../../../shared/services/access.service";
import { NOTIFICATION_TYPES, type NotificationType } from "../dto/notification.dto";
import { defaultChoice, NOTIFICATION_LABELS, normaliseChoice, type PreferencesDTO } from "../dto/preference.dto";
import { PreferenceRepository } from "../repositories/preference.repository";
import { PushRepository } from "../repositories/push.repository";
import { PushDeliveryService } from "./pushDelivery.service";

/** Per-person choices: In app / Email / Push for each notification type. */
export class PreferenceService {
  static Instance = new PreferenceService();

  private constructor(
    private readonly preferences = PreferenceRepository.Instance,
    private readonly push = PushRepository.Instance,
    private readonly pushSender = PushDeliveryService.Instance,
  ) {}

  /** Every type, with the saved choice or its default. */
  async mine(actor: Actor): Promise<PreferencesDTO> {
    const saved = await this.preferences.forUser(actor.id);
    return {
      preferences: NOTIFICATION_TYPES.map((type) => ({
        type,
        label: NOTIFICATION_LABELS[type],
        ...(saved.get(type) ?? defaultChoice(type)),
      })),
      pushAvailable: this.pushSender.configured,
      devices: await this.push.countForUser(actor.id),
    };
  }

  /** Saves the types given; the others keep what they had. Email and push follow in-app. */
  async update(
    actor: Actor,
    choices: { type: NotificationType; inApp: boolean; email: boolean; push: boolean }[],
  ): Promise<PreferencesDTO> {
    await this.preferences.save(
      actor.id,
      choices.map((choice) => ({ type: choice.type, ...normaliseChoice(choice) })),
    );
    return this.mine(actor);
  }

  /** A browser asks to receive push for this person. */
  async registerDevice(actor: Actor, token: string, userAgent: string | null): Promise<{ devices: number }> {
    await this.push.register(actor.id, actor.businessId, token, userAgent?.slice(0, 300) ?? null);
    return { devices: await this.push.countForUser(actor.id) };
  }

  async removeDevice(actor: Actor, token: string): Promise<{ devices: number }> {
    await this.push.unregister(actor.id, token);
    return { devices: await this.push.countForUser(actor.id) };
  }
}
