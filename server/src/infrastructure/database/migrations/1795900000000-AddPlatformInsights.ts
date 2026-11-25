import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Growth insights, security counters and admin notes for the platform admin:
 * - platform_daily_stats: one row of platform-wide counts per UTC day, filled by the rollupPlatformStats job
 *   (its first run backfills 90 days).
 * - security_counters: refused requests per kind and address in 10-minute windows (kept 30 days).
 * - admin_notes: platform admins' notes about a business; never shown to the business.
 * - email_outbox.business_id may be NULL, for platform emails (critical alerts to platform admins).
 *
 * Constraint names are TypeORM's own (DefaultNamingStrategy), so the CI drift check stays clean.
 */
export class AddPlatformInsights1795900000000 implements MigrationInterface {
  name = "AddPlatformInsights1795900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "platform_daily_stats" ("day" date NOT NULL, "businesses_total" integer NOT NULL DEFAULT '0', "businesses_new" integer NOT NULL DEFAULT '0', "businesses_active_7d" integer NOT NULL DEFAULT '0', "people_new" integer NOT NULL DEFAULT '0', "people_active_7d" integer NOT NULL DEFAULT '0', "orders_new" integer NOT NULL DEFAULT '0', "appointments_new" integer NOT NULL DEFAULT '0', "payments_new" integer NOT NULL DEFAULT '0', "emails_sent" integer NOT NULL DEFAULT '0', "emails_failed" integer NOT NULL DEFAULT '0', "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_50563e3e45b951afa63ea2a87ff" PRIMARY KEY ("day"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "security_counters" ("window_start" TIMESTAMP WITH TIME ZONE NOT NULL, "kind" character varying(40) NOT NULL, "ip" character varying(64) NOT NULL, "count" integer NOT NULL DEFAULT '0', "last_user_id" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b0f2f833ae8916cf38d2413fe7d" PRIMARY KEY ("window_start", "kind", "ip"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "admin_notes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "author_id" uuid, "body" text NOT NULL, CONSTRAINT "PK_f725996140f2e8468c4c57c7011" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_admin_notes_business" ON "admin_notes" ("business_id", "created_at") `);
    await queryRunner.query(
      `ALTER TABLE "admin_notes" ADD CONSTRAINT "FK_40e53c8f09834f7acb1fb6c7965" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_notes" ADD CONSTRAINT "FK_2b67ef41504f9795bdc3df48806" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "email_outbox" ALTER COLUMN "business_id" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Platform emails have no business to belong to in the old schema; they cannot be kept.
    await queryRunner.query(`DELETE FROM "email_outbox" WHERE "business_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "email_outbox" ALTER COLUMN "business_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "admin_notes" DROP CONSTRAINT "FK_2b67ef41504f9795bdc3df48806"`);
    await queryRunner.query(`ALTER TABLE "admin_notes" DROP CONSTRAINT "FK_40e53c8f09834f7acb1fb6c7965"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_admin_notes_business"`);
    await queryRunner.query(`DROP TABLE "admin_notes"`);
    await queryRunner.query(`DROP TABLE "security_counters"`);
    await queryRunner.query(`DROP TABLE "platform_daily_stats"`);
  }
}
