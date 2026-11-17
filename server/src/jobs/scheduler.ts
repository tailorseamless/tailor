import { JOBS } from "../config/constants";
import { logger } from "../infrastructure/logger/logger";
import { runTick } from "./jobs";

/** The in-process scheduler, started by server.ts when JOBS_IN_PROCESS is on. */
let first: NodeJS.Timeout | undefined;
let interval: NodeJS.Timeout | undefined;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // the previous tick is still going
  running = true;
  try {
    await runTick();
  } catch (err) {
    logger.error({ err }, "job tick failed");
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (first || interval) return;
  first = setTimeout(() => void tick(), JOBS.firstRunMs);
  interval = setInterval(() => void tick(), JOBS.tickMs);
  first.unref();
  interval.unref();
  logger.info(`job scheduler started (every ${JOBS.tickMs / 1000}s)`);
}

export function stopScheduler(): void {
  if (first) clearTimeout(first);
  if (interval) clearInterval(interval);
  first = interval = undefined;
}
