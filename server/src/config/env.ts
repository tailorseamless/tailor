import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

/**
 * The ONLY reader of process.env (Backend Guide §1.1, §29.1).
 * Validates the environment at boot and exits with a list of every bad variable.
 */
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const flag = (fallback: boolean) =>
  z
    .enum(["true", "false"])
    .default(fallback ? "true" : "false")
    .transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PREFIX: z.string().startsWith("/").default("/api/v1"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  // Who is a platform admin: email addresses, separated by commas. Each person needs an account here and a VERIFIED email.
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),

  DATABASE_URL: z.string({ required_error: "DATABASE_URL is required" }).min(1),
  DATABASE_SSL: flag(false),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  FIREBASE_PROJECT_ID: z.string({ required_error: "FIREBASE_PROJECT_ID is required" }).min(1),
  FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),

  JOBS_IN_PROCESS: z.enum(["true", "false"]).optional(),

  // Hosted Postgres CA (Aiven, Render…): PEM, PEM with \n escapes, or base64 of the PEM.
  DATABASE_CA_CERT: z.string().optional(),

  // Error monitoring. Optional: without a DSN nothing is sent anywhere.
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  // Web push (FCM). Needs FIREBASE_SERVICE_ACCOUNT_BASE64; false switches it off without removing that.
  PUSH_ENABLED: flag(true),

  // Files (Cloudinary). Optional: without them uploads answer 503 and the app still runs.
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER_ROOT: z.string().optional(),

  // Email. Optional: with EMAIL_PROVIDER=none (the default) emails wait in the outbox, unsent.
  EMAIL_PROVIDER: z.enum(["none", "smtp", "apps_script"]).default("none"),
  /** When the chosen provider fails, try the other one (if it is configured). */
  EMAIL_FALLBACK: flag(true),
  /** The Apps Script web app's /exec URL. Treat it as a secret. */
  EMAIL_APPS_SCRIPT_URL: z.string().url().optional(),
  /** Must equal the script's MAIL_TOKEN property. */
  EMAIL_APPS_SCRIPT_TOKEN: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: flag(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("TailorFlow"),
  EMAIL_FROM_ADDRESS: z.string().email("must be an email address, like you@example.com").optional(),
  EMAIL_REPLY_TO: z.string().email("must be an email address, like you@example.com").optional(),
});

/** cloudinary://<api_key>:<api_secret>@<cloud_name>. The separate variables win when both are set. */
function cloudinaryConfig(raw: z.infer<typeof schema>) {
  let fromUrl: { cloudName: string; apiKey: string; apiSecret: string } | null = null;
  if (raw.CLOUDINARY_URL) {
    const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw.CLOUDINARY_URL);
    if (match) fromUrl = { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
    else console.warn("CLOUDINARY_URL is not in the form cloudinary://<key>:<secret>@<cloud>; ignoring it");
  }
  const cloudName = raw.CLOUDINARY_CLOUD_NAME ?? fromUrl?.cloudName ?? null;
  const apiKey = raw.CLOUDINARY_API_KEY ?? fromUrl?.apiKey ?? null;
  const apiSecret = raw.CLOUDINARY_API_SECRET ?? fromUrl?.apiSecret ?? null;
  const configured = Boolean(cloudName && apiKey && apiSecret);
  const env = raw.NODE_ENV === "production" ? "prod" : raw.NODE_ENV === "test" ? "test" : "dev";
  return { configured, cloudName, apiKey, apiSecret, folderRoot: raw.CLOUDINARY_FOLDER_ROOT ?? `tailorflow/${env}` };
}

/**
 * Two providers (Backend Guide §22.7, §22.9): SMTP through Nodemailer, or a
 * Google Apps Script web app. A misconfigured one is a warning, not a boot failure.
 */
function emailConfig(raw: z.infer<typeof schema>) {
  const fromAddress = raw.EMAIL_FROM_ADDRESS ?? (raw.SMTP_USER?.includes("@") ? raw.SMTP_USER : null);
  const smtpConfigured = Boolean(raw.SMTP_HOST) && Boolean(fromAddress);
  const appsScriptConfigured = Boolean(raw.EMAIL_APPS_SCRIPT_URL);
  if (raw.EMAIL_PROVIDER === "smtp" && !smtpConfigured) {
    console.warn("EMAIL_PROVIDER=smtp needs SMTP_HOST and EMAIL_FROM_ADDRESS");
  }
  if (raw.EMAIL_PROVIDER === "apps_script" && !appsScriptConfigured) {
    console.warn("EMAIL_PROVIDER=apps_script needs EMAIL_APPS_SCRIPT_URL");
  }
  if (raw.EMAIL_APPS_SCRIPT_URL && !/\/exec(\?|$)/.test(raw.EMAIL_APPS_SCRIPT_URL)) {
    console.warn("EMAIL_APPS_SCRIPT_URL should be the deployment's /exec URL, not /dev");
  }
  return {
    provider: raw.EMAIL_PROVIDER,
    fallback: raw.EMAIL_FALLBACK,
    smtpConfigured,
    appsScript: {
      configured: appsScriptConfigured,
      url: raw.EMAIL_APPS_SCRIPT_URL ?? null,
      token: raw.EMAIL_APPS_SCRIPT_TOKEN ?? null,
    },
    smtp: {
      host: raw.SMTP_HOST ?? null,
      port: raw.SMTP_PORT,
      secure: raw.SMTP_SECURE,
      user: raw.SMTP_USER ?? null,
      password: raw.SMTP_PASSWORD ?? null,
    },
    fromName: raw.EMAIL_FROM_NAME,
    fromAddress,
    replyTo: raw.EMAIL_REPLY_TO ?? null,
  };
}

/** `PLATFORM_ADMIN_EMAILS=a@x.com, b@y.com` becomes a lower-case set. Anything that isn't an address is warned about and dropped. */
function platformAdminEmails(value: string | undefined): ReadonlySet<string> {
  const emails = new Set<string>();
  for (const entry of (value ?? "").split(/[\s,;]+/)) {
    const email = entry.trim().toLowerCase();
    if (!email) continue;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.add(email);
    else console.warn(`PLATFORM_ADMIN_EMAILS: "${entry}" is not an email address and was ignored`);
  }
  return emails;
}

/** Accepts a pasted PEM, a PEM with literal \n escapes, or base64 of the PEM. */
function caCertificate(value: string | undefined): string | null {
  if (!value) return null;
  if (value.includes("BEGIN CERTIFICATE")) return value.replace(/\\n/g, "\n");
  const decoded = Buffer.from(value, "base64").toString("utf8");
  return decoded.includes("BEGIN CERTIFICATE") ? decoded : null;
}

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function fail(problems: string[]): never {
  console.error("Invalid environment configuration:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

/** Blank values (`KEY=`) count as "not set". */
function definedEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value.trim() !== "") out[key] = value.trim();
  }
  return withMailboxParts(withDatabaseParts(out));
}

/** "Tailor Seamless <me@gmail.com>" → the bare address and the name. null when there is no <address> part. */
function splitMailbox(value: string): { name: string; address: string } | null {
  const match = /^(.*?)\s*<([^<>\s]+)>$/.exec(value);
  if (!match) return null;
  return { name: match[1].replace(/^["']|["']$/g, "").trim(), address: match[2] };
}

/**
 * Sender settings may be written the usual way, `Name <address>`. The address goes where an address is
 * expected; a name given in EMAIL_FROM_ADDRESS is the one people will see, so it replaces EMAIL_FROM_NAME.
 */
function withMailboxParts(vars: Record<string, string>): Record<string, string> {
  const from = vars.EMAIL_FROM_ADDRESS ? splitMailbox(vars.EMAIL_FROM_ADDRESS) : null;
  if (from) {
    vars.EMAIL_FROM_ADDRESS = from.address;
    if (from.name) vars.EMAIL_FROM_NAME = from.name;
  }
  const reply = vars.EMAIL_REPLY_TO ? splitMailbox(vars.EMAIL_REPLY_TO) : null;
  if (reply) vars.EMAIL_REPLY_TO = reply.address;
  return vars;
}

/**
 * Hosts like Aiven show the connection as separate fields. When DATABASE_URL is absent, build it from
 * DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (credentials URL-encoded); DB_SSL stands in for DATABASE_SSL.
 */
function withDatabaseParts(vars: Record<string, string>): Record<string, string> {
  const { DB_HOST: host, DB_PORT: port, DB_USER: user, DB_PASSWORD: password, DB_NAME: name, DB_SSL: ssl } = vars;
  if (!vars.DATABASE_URL && host && user && name) {
    const auth = `${encodeURIComponent(user)}${password ? `:${encodeURIComponent(password)}` : ""}`;
    vars.DATABASE_URL = `postgres://${auth}@${host}${port ? `:${port}` : ""}/${encodeURIComponent(name)}`;
  }
  if (!vars.DATABASE_SSL && ssl) vars.DATABASE_SSL = ssl.toLowerCase();
  return vars;
}

function parseServiceAccount(base64: string | undefined, problems: string[]): ServiceAccount | null {
  if (!base64) return null;
  try {
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as Record<string, unknown>;
    const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = json;
    if (typeof projectId !== "string" || typeof clientEmail !== "string" || typeof privateKey !== "string") {
      throw new Error("missing fields");
    }
    return { projectId, clientEmail, privateKey };
  } catch {
    problems.push("FIREBASE_SERVICE_ACCOUNT_BASE64: must be the base64 of a service-account JSON file");
    return null;
  }
}

function load() {
  const parsed = schema.safeParse(definedEnv());
  if (!parsed.success) {
    fail(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  const raw = parsed.data;
  const problems: string[] = [];
  const serviceAccount = parseServiceAccount(raw.FIREBASE_SERVICE_ACCOUNT_BASE64, problems);
  const isProduction = raw.NODE_ENV === "production";

  if (isProduction && !serviceAccount) {
    problems.push("FIREBASE_SERVICE_ACCOUNT_BASE64: required in production");
  }
  if (isProduction && raw.FIREBASE_AUTH_EMULATOR_HOST) {
    problems.push("FIREBASE_AUTH_EMULATOR_HOST: must be empty in production");
  }
  if (serviceAccount && serviceAccount.projectId !== raw.FIREBASE_PROJECT_ID) {
    problems.push("FIREBASE_PROJECT_ID: does not match the project of the service account");
  }
  if (problems.length > 0) fail(problems);
  if (isProduction && !cloudinaryConfig(raw).configured) console.warn("Cloudinary is not configured: uploads are off");
  const mail = emailConfig(raw);
  if (isProduction && (raw.EMAIL_PROVIDER === "none" || (!mail.smtpConfigured && !mail.appsScript.configured))) {
    console.warn("Email is not configured: emails are queued, not sent");
  }

  return {
    nodeEnv: raw.NODE_ENV,
    isProduction,
    isTest: raw.NODE_ENV === "test",
    isDevelopment: raw.NODE_ENV === "development",
    port: raw.PORT,
    apiPrefix: raw.API_PREFIX.replace(/\/+$/, "") || "/",
    appUrl: raw.APP_URL.replace(/\/+$/, ""),
    platformAdmins: platformAdminEmails(raw.PLATFORM_ADMIN_EMAILS),
    // A browser's Origin never ends in "/", so an address pasted with one (https://site.netlify.app/) would never match.
    corsOrigins: raw.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
    logLevel: raw.LOG_LEVEL ?? (raw.NODE_ENV === "test" ? "silent" : isProduction ? "info" : "debug"),
    database: {
      url: raw.DATABASE_URL,
      ssl: raw.DATABASE_SSL,
      poolMax: raw.DB_POOL_MAX,
      caCert: caCertificate(raw.DATABASE_CA_CERT),
    },
    firebase: {
      projectId: raw.FIREBASE_PROJECT_ID,
      serviceAccount,
      authEmulatorHost: raw.FIREBASE_AUTH_EMULATOR_HOST ?? null,
    },
    cloudinary: cloudinaryConfig(raw),
    email: emailConfig(raw),
    monitoring: {
      sentryDsn: raw.SENTRY_DSN ?? null,
      environment: raw.SENTRY_ENVIRONMENT ?? raw.NODE_ENV,
    },
    push: {
      /** FCM needs the service account (an ID-token-only setup cannot send). */
      enabled: raw.PUSH_ENABLED && serviceAccount !== null,
    },
    jobs: {
      /** Run the job scheduler inside the API process. On by default, except in tests. */
      inProcess: raw.JOBS_IN_PROCESS ? raw.JOBS_IN_PROCESS === "true" : raw.NODE_ENV !== "test",
    },
  } as const;
}

export const env = load();
export type Env = typeof env;
