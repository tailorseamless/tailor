# Deploying the TailorFlow API

The API runs on **Render** from `render.yaml`, against a hosted **PostgreSQL** (Aiven, or Render's own). It is a compiled Node app: `npm run build` emits `server/dist`, and production runs `node dist/server.js`. Migrations run before each new version starts.

## 1. The database

Create a PostgreSQL 15+ database close to the Render region in `render.yaml` (Frankfurt by default).

- **Aiven:** the blueprint asks for the fields Aiven shows (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; `DB_SSL` is already `true`), the same names as in `server/.env`. Or set one `DATABASE_URL` from the *Service URI* instead, which wins when present. Either way, download the *CA certificate*. Paste its text into `DATABASE_CA_CERT` (a pasted PEM, a PEM with `\n` escapes, or base64 of the file all work).
- **Render Postgres:** use the *Internal Database URL*. `DATABASE_SSL=true` works without a CA certificate. **Render's free database expires after a limited trial period and has no backups** — fine for trying things out, not for real customers. Aiven's free PostgreSQL plan does not expire, so it is the better free choice for live data.

The jobs take Postgres advisory locks, which need a **direct** connection: do not point `DATABASE_URL` at a PgBouncer pool in transaction mode.

## 2. Firebase

1. Firebase console → Project settings → Service accounts → **Generate new private key**.
2. Base64 it into `FIREBASE_SERVICE_ACCOUNT_BASE64` — never paste the JSON into chat or commit it:
   - macOS / Linux: `base64 -w0 service-account.json` (`base64 -i … | tr -d '\n'` on macOS)
   - Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))`
3. `FIREBASE_PROJECT_ID` must be the same project the web app signs in with. The API refuses to boot in production without the service account.

The service account also enables web push (FCM) and deleting Firebase logins when an account is deleted.

## 3. Render

1. Push the repository to GitHub.
2. Render → **New → Blueprint** → choose the repository. `render.yaml` already selects the **free** plan. Render reads `render.yaml` and asks for every value marked `sync: false`.
3. Fill in at least the database fields (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, plus `DATABASE_CA_CERT` for Aiven), `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `APP_URL` (the web app's public address — every email and portal link uses it) and `CORS_ORIGINS` (the web app's origin, exactly).
4. Deploy. The health check is `GET /api/v1/health` (200 when the database answers).

**Free plan:** the instance sleeps after about 15 minutes idle, and jobs run inside it (`JOBS_IN_PROCESS=true`), so reminders, emails and pushes only go out while it is awake. For dependable reminders, use a paid instance, or add a Render *cron job* running `npm --workspace server run jobs` every few minutes and set `JOBS_IN_PROCESS=false`.

## 4. Optional services

| Service | Settings | Without it |
|---|---|---|
| Cloudinary (pictures) | `CLOUDINARY_URL` | Uploads answer 503 "File storage is not configured" |
| Email — SMTP | `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS` | Emails wait in the outbox |
| Email — Google Apps Script | `EMAIL_PROVIDER=apps_script`, `EMAIL_APPS_SCRIPT_URL`, `EMAIL_APPS_SCRIPT_TOKEN` (setup in `apps-script-mailer.gs`) | Emails wait in the outbox |
| Error monitoring | `SENTRY_DSN` | Errors are only logged |
| Web push | the Firebase service account; `PUSH_ENABLED=true` | No pushes; in-app and email still work |

With both email providers configured and `EMAIL_FALLBACK=true`, a failed send is retried through the other one. Check the setup from a shell on the instance: `npm --workspace server run email:test -- --status`.

## 5. After the first deploy

Render's **free** web services have no Shell, so run these one-off commands **from your own computer**, pointed at the production database. Use the database's *external* connection URL (Render Postgres → *External Database URL*; Aiven → *Service URI*), and put it only in your shell for that command — never in a committed file.

- **Make yourself platform admin** (after registering your own business in the app):

  ```bash
  DATABASE_URL="<external production URL>" DATABASE_SSL=true FIREBASE_PROJECT_ID=<project> npm --workspace server run admin:grant -- --email you@example.com
  ```

  (PowerShell: set `$env:DATABASE_URL`, `$env:DATABASE_SSL` and `$env:FIREBASE_PROJECT_ID` first, then run the npm command.) Add `DATABASE_CA_CERT` too if your provider needs it (Aiven).

- **Check email** the same way, with the production email settings in your shell: `npm --workspace server run email:test -- --to you@example.com`.

On a paid instance you can run the same commands from Render → Shell instead.

## Migrations, backups, rollbacks

- Migrations run in the start command (`migration:run:prod`), one transaction each. If one fails, the deploy fails and the previous version keeps serving.
- Write every migration so the **previous** version still works against the new schema: add columns nullable or with defaults; drop columns in a later release. A Render rollback does **not** undo a migration.
- Undo the latest migration only after a backup: `npm --workspace server run migration:revert`.
- Aiven and Render Postgres both take daily backups; take a manual one before any risky migration.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: lint, format check, type-check and build, then applies every migration to a fresh PostgreSQL, checks the schema matches the entities, and reverts and re-applies the latest migration.
