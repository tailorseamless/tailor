import fs from "node:fs";
import path from "node:path";
import { AppDataSource } from "./dataSource";

/**
 * Migration runner (Backend Guide §9.6).
 *
 *   npm --workspace server run migration:run
 *   npm --workspace server run migration:revert
 *   npm --workspace server run migration:status
 *   npm --workspace server run migration:generate -- <Name>
 *
 * `generate` diffs the entities against the database (apply pending migrations
 * first) and writes `<timestamp>-<Name>.ts`. Review the SQL before committing.
 */
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const escapeTemplate = (sql: string) => sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

async function generate(name: string | undefined): Promise<void> {
  if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error("Give the migration a PascalCase name, e.g. `migration:generate -- AddOrders`");
  }
  if (await AppDataSource.showMigrations()) {
    throw new Error("There are pending migrations. Run `migration:run` first, then generate.");
  }

  const diff = await AppDataSource.driver.createSchemaBuilder().log();
  if (diff.upQueries.length === 0) {
    console.log("No changes: the database already matches the entities.");
    return;
  }

  const timestamp = Date.now();
  const statement = (query: { query: string }) => `    await queryRunner.query(\`${escapeTemplate(query.query)}\`);`;
  const file = [
    `import { MigrationInterface, QueryRunner } from "typeorm";`,
    ``,
    `export class ${name}${timestamp} implements MigrationInterface {`,
    `  name = "${name}${timestamp}";`,
    ``,
    `  public async up(queryRunner: QueryRunner): Promise<void> {`,
    ...diff.upQueries.map(statement),
    `  }`,
    ``,
    `  public async down(queryRunner: QueryRunner): Promise<void> {`,
    ...[...diff.downQueries].reverse().map(statement),
    `  }`,
    `}`,
    ``,
  ].join("\n");

  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  const target = path.join(MIGRATIONS_DIR, `${timestamp}-${name}.ts`);
  fs.writeFileSync(target, file, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), target)} (${diff.upQueries.length} statements). Review it.`);
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  await AppDataSource.initialize();
  try {
    switch (command) {
      case "run": {
        const ran = await AppDataSource.runMigrations({ transaction: "each" });
        console.log(
          ran.length ? `Ran ${ran.length} migration(s): ${ran.map((m) => m.name).join(", ")}` : "Nothing to run.",
        );
        break;
      }
      case "revert":
        await AppDataSource.undoLastMigration({ transaction: "each" });
        console.log("Reverted the latest migration.");
        break;
      case "status":
        console.log((await AppDataSource.showMigrations()) ? "There are pending migrations." : "Up to date.");
        break;
      case "generate":
        await generate(arg);
        break;
      default:
        throw new Error("Usage: migrate.ts <run | revert | status | generate <Name>>");
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
