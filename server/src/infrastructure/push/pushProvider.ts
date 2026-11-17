import { env } from "../../config/env";
import { firebaseMessaging } from "../firebase/firebaseAdmin";

/** What a push message carries. All strings: FCM data messages allow nothing else. */
export interface PushMessage {
  id: string;
  type: string;
  title: string;
  body: string;
  /** Always an in-app path. */
  link: string;
}

export interface PushResult {
  token: string;
  ok: boolean;
  /** FCM error code, e.g. messaging/registration-token-not-registered. */
  error?: string;
}

export interface PushProvider {
  readonly configured: boolean;
  send(tokens: string[], message: PushMessage): Promise<PushResult[]>;
}

/**
 * Firebase Cloud Messaging through the Admin SDK — the only place it is called
 * (Firebase Guide §6). DATA-ONLY messages: the browser's push worker decides
 * how to show them, and nothing is shown that the app did not send.
 */
export class FcmPushProvider implements PushProvider {
  readonly configured = env.push.enabled;

  async send(tokens: string[], message: PushMessage): Promise<PushResult[]> {
    const response = await firebaseMessaging().sendEachForMulticast({
      tokens,
      data: { ...message },
      webpush: { headers: { Urgency: "high", TTL: String(24 * 3600) } },
    });
    return response.responses.map((result, index) => ({
      token: tokens[index],
      ok: result.success,
      ...(result.error ? { error: result.error.code } : {}),
    }));
  }
}
