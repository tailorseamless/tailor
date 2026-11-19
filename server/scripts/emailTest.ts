/**
 * Check the email setup (Backend Guide §22.12).
 *
 *   npm --workspace server run email:test -- --status
 *   npm --workspace server run email:test -- --to you@example.com
 *   npm --workspace server run email:test -- --to you@example.com --provider apps_script
 *
 * `--provider` forces one provider with no fallback, so its own error is visible.
 */
import { MailerService, type EmailProviderName } from "../src/shared/services/mailer.service";
import { button, emailLayout, emailSubject, heading, paragraph, textBody } from "../src/shared/utils/mailer";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const mailer = MailerService.Instance;
  console.log("Email setup:", JSON.stringify(mailer.status()));
  if (process.argv.includes("--status")) return;

  const to = arg("to");
  if (!to) throw new Error("Add --to <address> to send a test email, or --status to only show the setup");
  const provider = arg("provider") as EmailProviderName | undefined;

  const intro = "If you can read this, Tailor Seamless can send email.";
  const result = await mailer.send(
    {
      to,
      subject: emailSubject("Test email"),
      html: emailLayout(
        heading("It works") + paragraph(intro) + button("Open Tailor Seamless", "https://tailorflow.app"),
        {
          businessName: "Tailor Seamless",
          preheader: intro,
        },
      ),
      text: textBody(["It works", intro]),
    },
    provider ? { provider } : {},
  );
  console.log(`Sent through ${result.provider}${result.messageId ? ` (id ${result.messageId})` : ""}.`);
}

main().catch((err: unknown) => {
  console.error("Not sent:", err instanceof Error ? err.message : err);
  process.exit(1);
});
