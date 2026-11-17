import { env } from "../../config/env";
import { AppsScriptProvider } from "../../infrastructure/email/appsScriptProvider";
import { SmtpProvider } from "../../infrastructure/email/smtpProvider";

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface EmailMessage {
  to: string;
  toName?: string | null;
  /** Replies go to the business, not to the platform's sending address. */
  replyTo?: string | null;
  subject: string;
  html: string;
  /** The plain-text counterpart is required (Backend Guide §22.6). */
  text: string;
  attachments?: EmailAttachment[];
}

export type EmailProviderName = "smtp" | "apps_script";

export interface EmailProvider {
  readonly name: string;
  readonly configured: boolean;
  send(message: EmailMessage): Promise<{ messageId: string | null }>;
}

/**
 * The single door for email (Backend Guide §22.7, §22.9). Requests never send
 * mail: they queue it in the outbox, and the delivery job comes through here.
 *
 * `order()` lists only CONFIGURED providers — the chosen one first, then the
 * other when EMAIL_FALLBACK is on. `send()` tries each in turn and, if all
 * fail, throws one combined error. With EMAIL_PROVIDER=none email is off and
 * queued mail waits.
 */
export class MailerService {
  static Instance = new MailerService();

  private providers: EmailProvider[];
  private primary: EmailProviderName | "none";
  private fallback: boolean;

  private constructor() {
    this.providers = [new SmtpProvider(), new AppsScriptProvider()];
    this.primary = env.email.provider;
    this.fallback = env.email.fallback;
  }

  /** Swap in one provider (used by local checks). */
  use(provider: EmailProvider): void {
    this.providers = [provider];
    this.primary = provider.name as EmailProviderName;
    this.fallback = false;
  }

  order(): EmailProvider[] {
    if (this.primary === "none") return [];
    const chosen = this.providers.find((provider) => provider.name === this.primary && provider.configured);
    const others = this.fallback
      ? this.providers.filter((provider) => provider.name !== this.primary && provider.configured)
      : [];
    return [...(chosen ? [chosen] : []), ...others];
  }

  get enabled(): boolean {
    return this.order().length > 0;
  }

  get providerName(): string {
    return this.order()
      .map((provider) => provider.name)
      .join(" → ");
  }

  /** What is set up, for diagnostics. */
  status(): { primary: string; fallback: boolean; configured: string[]; order: string[] } {
    return {
      primary: this.primary,
      fallback: this.fallback,
      configured: this.providers.filter((provider) => provider.configured).map((provider) => provider.name),
      order: this.order().map((provider) => provider.name),
    };
  }

  /** Tries each provider in order. `provider` forces exactly one, with no fallback. */
  async send(
    message: EmailMessage,
    options: { provider?: EmailProviderName } = {},
  ): Promise<{ messageId: string | null; provider: string }> {
    const candidates = options.provider
      ? this.providers.filter((provider) => provider.name === options.provider && provider.configured)
      : this.order();
    if (candidates.length === 0) throw new Error("Email is not configured");

    const failures: string[] = [];
    for (const provider of candidates) {
      try {
        const { messageId } = await provider.send(message);
        return { messageId, provider: provider.name };
      } catch (err) {
        failures.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(failures.join("; "));
  }
}
