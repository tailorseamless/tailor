import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Day-to-day platform monitoring for the admin:
 * - users.last_seen_at: when someone last used the app (to the hour). NULL for everyone until their next visit.
 * - job_status: one row per background job, overwritten after every run (outcome, timing, last error,
 *   failures in a row). Starts empty; each job adds its row on its first run.
 * - admin_alerts: what needs a platform admin's attention, raised by the evaluateAdminAlerts job. At most one
 *   unresolved alert per condition (the partial unique index on dedupe_key).
 *
 * Purely additive. Constraint names are TypeORM's own (DefaultNamingStrategy), so the CI drift check stays clean.
 */
export class AddAdminMonitoring1795800000000 implements MigrationInterface {
  name = "AddAdminMonitoring1795800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "last_seen_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(
      `CREATE TABLE "job_status" ("name" character varying(60) NOT NULL, "last_started_at" TIMESTAMP WITH TIME ZONE, "last_finished_at" TIMESTAMP WITH TIME ZONE, "last_outcome" character varying(20), "last_succeeded_at" TIMESTAMP WITH TIME ZONE, "last_failed_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "last_result" jsonb, "last_duration_ms" integer, "consecutive_failures" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_964a96259cf022110364dcf5fc" CHECK ("last_outcome" IN ('succeeded','failed')), CONSTRAINT "PK_3a71402391db680a921acaac6c2" PRIMARY KEY ("name"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "admin_alerts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" character varying(60) NOT NULL, "severity" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'open', "title" character varying(200) NOT NULL, "detail" text, "business_id" uuid, "data" jsonb NOT NULL DEFAULT '{}', "dedupe_key" character varying(200) NOT NULL, "occurrences" integer NOT NULL DEFAULT '1', "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "acknowledged_by" uuid, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "resolved_by" uuid, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolution_note" text, CONSTRAINT "CHK_93e572d9f806a00d91ae5bda73" CHECK ("severity" IN ('critical','high','medium','low')), CONSTRAINT "CHK_66b73805bcc3e3db52a0f997af" CHECK ("status" IN ('open','acknowledged','resolved')), CONSTRAINT "PK_763b46559d47bad76edf8d8bcee" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_admin_alerts_open_dedupe" ON "admin_alerts" ("dedupe_key") WHERE "status" <> 'resolved'`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_admin_alerts_status" ON "admin_alerts" ("status", "created_at") `);
    await queryRunner.query(
      `ALTER TABLE "admin_alerts" ADD CONSTRAINT "FK_7822c556810766ec66e33273012" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_alerts" ADD CONSTRAINT "FK_e3812f2e7a24336745e94749934" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "admin_alerts" ADD CONSTRAINT "FK_7d780df89e03992709f83df1bb6" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "admin_alerts" DROP CONSTRAINT "FK_7d780df89e03992709f83df1bb6"`);
    await queryRunner.query(`ALTER TABLE "admin_alerts" DROP CONSTRAINT "FK_e3812f2e7a24336745e94749934"`);
    await queryRunner.query(`ALTER TABLE "admin_alerts" DROP CONSTRAINT "FK_7822c556810766ec66e33273012"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_admin_alerts_status"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_admin_alerts_open_dedupe"`);
    await queryRunner.query(`DROP TABLE "admin_alerts"`);
    await queryRunner.query(`DROP TABLE "job_status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_seen_at"`);
  }
}
