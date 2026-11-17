import type { Server } from "node:http";
import { createApp } from "./app";
import { SHUTDOWN_DRAIN_MS } from "./config/constants";
import { env } from "./config/env";
import { AppDataSource } from "./infrastructure/database/dataSource";
import { logger } from "./infrastructure/logger/logger";
import { captureError, flushMonitoring, initMonitoring } from "./infrastructure/monitoring/sentry";
import { startScheduler, stopScheduler } from "./jobs/scheduler";

/** Network hiccups worth retrying at boot (slow DNS, a database still waking up). Auth or TLS errors are not. */
const TRANSIENT = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]);

async function connectDatabase(attempts = 5): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await AppDataSource.initialize();
      return;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (attempt >= attempts || !code || !TRANSIENT.has(code)) throw err;
      const waitMs = attempt * 2000;
      logger.warn({ code, attempt, waitMs }, "database not reachable yet, retrying");
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

/** HTTP entrypoint: connect, listen, shut down gracefully (Backend Guide §29.2). */
async function start(): Promise<void> {
  await connectDatabase();
  if (await AppDataSource.showMigrations()) {
    logger.warn("there are pending migrations — run `npm --workspace server run migration:run`");
  }

  const server = createApp().listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}${env.apiPrefix} (${env.nodeEnv})`);
  });
  registerShutdown(server);
  if (env.jobs.inProcess) startScheduler();
}

function registerShutdown(server: Server): void {
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "shutting down");
    stopScheduler();

    // Stop accepting, drain what is in flight, then close the pool.
    const force = setTimeout(() => {
      logger.warn("drain timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_DRAIN_MS);
    force.unref();

    server.close(() => {
      AppDataSource.destroy()
        .catch((err: unknown) => logger.error({ err }, "error closing the database pool"))
        .then(() => flushMonitoring())
        .finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

initMonitoring();
start().catch(async (err: unknown) => {
  logger.fatal({ err }, "failed to start");
  captureError(err, { route: "startup" });
  await flushMonitoring();
  process.exit(1);
});
