import { env } from "../../config/env";
import type { EmailMessage, EmailProvider } from "../../shared/services/mailer.service";

const TIMEOUT_MS = 20_000;

/**
 * A Google Apps Script web app that sends with MailApp (Backend Guide §22.9).
 * The script always answers HTTP 200 — success or failure is in the JSON body.
 * Mail is sent FROM the Google account that owns the script; only the display
 * name can be chosen. The script itself is in server/docs/apps-script-mailer.gs.
 */
export class AppsScriptProvider implements EmailProvider {
  readonly name = "apps_script";
  readonly configured = env.email.appsScript.configured;

  async send(message: EmailMessage): Promise<{ messageId: string | null }> {
    const { url, token } = env.email.appsScript;
    const response = await fetch(url ?? "", {
      method: "POST",
      // text/plain avoids a CORS preflight; Google answers the POST with a redirect to follow.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        to: message.to,
        subject: message.subject,
        htmlBody: message.html,
        body: message.text,
        name: env.email.fromName,
        ...(message.replyTo || env.email.replyTo ? { replyTo: message.replyTo ?? env.email.replyTo } : {}),
        ...(message.attachments?.length
          ? {
              attachments: message.attachments.map((file) => ({
                fileName: file.filename,
                mimeType: file.contentType,
                content: file.content.toString("base64"),
              })),
            }
          : {}),
        ...(token ? { token } : {}),
      }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Apps Script answered HTTP ${response.status}: deploy it as "Execute as: Me" and "Who has access: Anyone"`,
      );
    }
    if (!response.ok) throw new Error(`Apps Script answered HTTP ${response.status}`);

    const text = await response.text();
    let reply: { status?: string; message?: string };
    try {
      reply = JSON.parse(text) as { status?: string; message?: string };
    } catch {
      throw new Error("Apps Script did not return JSON — use the deployment's /exec URL, not /dev or a sign-in page");
    }
    // server/docs/apps-script-mailer.gs answers "ok"; common hand-written mailers answer "success". Both mean sent.
    if (reply.status !== "ok" && reply.status !== "success") {
      throw new Error(`Apps Script: ${reply.message ?? `unexpected reply ${text.slice(0, 120)}`}`);
    }
    return { messageId: null };
  }
}
