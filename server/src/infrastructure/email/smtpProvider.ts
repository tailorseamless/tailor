import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import type { EmailMessage, EmailProvider } from "../../shared/services/mailer.service";

const TIMEOUT_MS = 20_000;

/** Nodemailer over SMTP — the only place it is imported (Backend Guide §22.9). */
export class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  readonly configured = env.email.smtpConfigured;
  private transport: Transporter | undefined;

  private transporter(): Transporter {
    const { smtp } = env.email;
    this.transport ??= nodemailer.createTransport({
      host: smtp.host ?? undefined,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.password ?? "" } } : {}),
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
    return this.transport;
  }

  async send(message: EmailMessage): Promise<{ messageId: string | null }> {
    const info = await this.transporter().sendMail({
      from: { name: env.email.fromName, address: env.email.fromAddress ?? "" },
      to: message.toName ? { name: message.toName, address: message.to } : message.to,
      ...(message.replyTo || env.email.replyTo ? { replyTo: message.replyTo ?? env.email.replyTo ?? undefined } : {}),
      subject: message.subject,
      html: message.html,
      text: message.text,
      attachments: message.attachments?.map((file) => ({
        filename: file.filename,
        content: file.content,
        contentType: file.contentType,
      })),
    });
    return { messageId: typeof info.messageId === "string" ? info.messageId : null };
  }
}
