import { AppDataSource } from "../infrastructure/database/dataSource";
import { logger } from "../infrastructure/logger/logger";
import { runTick } from "./jobs";

/**
 * Cron entry: one pass over the jobs, then exit.
 *   npm --workspace server run jobs            (add `-- --all` to force every job)
 */
async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const results = await runTick({ all: process.argv.includes("--all") });
    logger.info({ results }, "jobs ran");
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "jobs failed to run");
  process.exit(1);
});
