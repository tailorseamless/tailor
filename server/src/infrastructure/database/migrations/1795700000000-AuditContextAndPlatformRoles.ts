import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The audit trail becomes something a platform admin can investigate, and platform power gets a read-only tier.
 *
 * audit_logs:
 * - `business_id` may be NULL, for platform events that belong to no business (an admin granted).
 * - `actor_kind` (user, admin, system, portal, public), `outcome`, and the request it came from:
 *   `request_id`, `ip`, `user_agent` (NULL for jobs and scripts, and for every row written before this).
 * - Indexes for the platform-wide view (newest first) and for "everything this person did".
 * Existing rows get their actor kind from what is known: admin actions, the jobs that act with no person
 * (anonymising accounts), a customer's portal link, the public booking page. Their request context stays NULL.
 *
 * users: `platform_role` may also be `support` (can look at the admin area, change nothing).
 *
 * Constraint names are TypeORM's own (DefaultNamingStrategy over the entity's expression), so the
 * schema matches the entities and the CI drift check stays clean.
 */
export class AuditContextAndPlatformRoles1795700000000 implements MigrationInterface {
  name = "AuditContextAndPlatformRoles1795700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "business_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "actor_kind" character varying(20) NOT NULL DEFAULT 'user'`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "outcome" character varying(20) NOT NULL DEFAULT 'success'`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "request_id" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "ip" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD "user_agent" character varying(200)`);

    await queryRunner.query(`UPDATE "audit_logs" SET "actor_kind" = 'admin' WHERE "action" LIKE 'admin.%'`);
    await queryRunner.query(
      `UPDATE "audit_logs" SET "actor_kind" = 'portal'
        WHERE "actor_id" IS NULL AND ("action" = 'appointment.customer_confirmed'
          OR ("action" = 'appointment_request.created' AND "payload"->>'source' = 'portal'))`,
    );
    await queryRunner.query(
      `UPDATE "audit_logs" SET "actor_kind" = 'public'
        WHERE "actor_id" IS NULL AND "action" = 'appointment_request.created' AND "actor_kind" = 'user'`,
    );
    await queryRunner.query(
      `UPDATE "audit_logs" SET "actor_kind" = 'system' WHERE "actor_id" IS NULL AND "actor_kind" = 'user'`,
    );

    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "CHK_8dfac613efc64f6c868970a7f0" CHECK ("actor_kind" IN ('user','admin','system','portal','public'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "CHK_12f174b4e5daa4ec5c46b7357e" CHECK ("outcome" IN ('success','denied','failed'))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created" ON "audit_logs" ("created_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor_id", "created_at") `);

    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_9c380de61e61e18783a2f106be"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_c7cf02510faf361e3a09fc198a" CHECK ("platform_role" IN ('user','support','super_admin'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Support is not a role before this migration: those people go back to ordinary users.
    await queryRunner.query(`UPDATE "users" SET "platform_role" = 'user' WHERE "platform_role" = 'support'`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_c7cf02510faf361e3a09fc198a"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "CHK_9c380de61e61e18783a2f106be" CHECK ("platform_role" IN ('user','super_admin'))`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_created"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "CHK_12f174b4e5daa4ec5c46b7357e"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "CHK_8dfac613efc64f6c868970a7f0"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "user_agent"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "ip"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "request_id"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "outcome"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "actor_kind"`);
    // Platform events have no business to belong to in the old schema; they cannot be kept.
    await queryRunner.query(`DELETE FROM "audit_logs" WHERE "business_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "business_id" SET NOT NULL`);
  }
}
