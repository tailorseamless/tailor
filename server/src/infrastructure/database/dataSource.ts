import "reflect-metadata";
import path from "node:path";
import { types } from "pg";
import { DataSource } from "typeorm";
import { env } from "../../config/env";
import { ENTITIES } from "./entities";
import { resilientStream } from "./resilientDns";

/**
 * A `date` column is a calendar day, not an instant. Left alone, the pg driver
 * turns it into a JS Date at local midnight, which shifts the day once it is
 * serialised in UTC. Keep it as the `YYYY-MM-DD` string it is.
 */
types.setTypeParser(types.builtins.DATE, (value: string) => value);

/** Migration files are picked up by glob (`.ts` under tsx, `.js` from dist). */
const migrationsGlob = path.join(__dirname, "migrations", "*{.ts,.js}").replace(/\\/g, "/");

export const AppDataSource = new DataSource({
  type: "postgres",
  url: env.database.url,
  // Verified TLS; a hosted database's own CA (Aiven) is trusted when DATABASE_CA_CERT is given.
  ssl: env.database.ssl
    ? { rejectUnauthorized: true, ...(env.database.caCert ? { ca: env.database.caCert } : {}) }
    : false,
  entities: ENTITIES,
  migrations: [migrationsGlob],
  migrationsTransactionMode: "each",
  // The schema only ever changes through migrations (Backend Guide §9.6).
  synchronize: false,
  migrationsRun: false,
  // gen_random_uuid() is built into PostgreSQL 13+; no extension to install.
  uuidExtension: "pgcrypto",
  installExtensions: false,
  logging: false,
  // Fail a connection that cannot be made rather than hang the request that asked for it.
  connectTimeoutMS: 20_000,
  extra: {
    max: env.database.poolMax,
    // Retry a short DNS failure instead of turning it into a 500 (see resilientDns.ts).
    stream: resilientStream,
    // Lets a dead connection be noticed instead of handed out.
    keepAlive: true,
    // A new connection to a hosted database costs 1 to 3 seconds (look-up, TLS, login). The default drops an idle
    // one after 10 s, so the first request after a quiet spell paid that. Keep them for 5 minutes instead.
    idleTimeoutMillis: 300_000,
  },
});
