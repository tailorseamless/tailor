import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPushPreferencesDeletion1794853408398 implements MigrationInterface {
  name = "AddPushPreferencesDeletion1794853408398";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "device_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "business_id" uuid NOT NULL, "token" character varying(512) NOT NULL, "user_agent" character varying(300), "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_e74bf3adff79e094bd230d9f2b" ON "device_tokens" ("last_seen_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_825e46654efced771b174a1ee3" ON "device_tokens" ("user_id", "last_seen_at") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_device_tokens_token" ON "device_tokens" ("token") `);
    await queryRunner.query(`CREATE TABLE "notification_preferences" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "type" character varying(50) NOT NULL, "in_app" boolean NOT NULL DEFAULT true, "email" boolean NOT NULL DEFAULT false, "push" boolean NOT NULL DEFAULT true, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_notification_preferences_user_type" ON "notification_preferences" ("user_id", "type") `);
    await queryRunner.query(`CREATE TABLE "push_deliveries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "notification_id" uuid NOT NULL, "user_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "next_attempt_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_error" text, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_995aa0161bdb46f6b56ade2c40" CHECK ("status" IN ('pending','sent','failed','cancelled')), CONSTRAINT "PK_5ce22daf7289b2e540fbe06f38e" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_push_deliveries_notification" ON "push_deliveries" ("notification_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_push_deliveries_due" ON "push_deliveries" ("next_attempt_at") WHERE "status" = 'pending'`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD "deletion_scheduled_for" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "users" ADD "deletion_scheduled_for" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX "IDX_businesses_deletion_due" ON "businesses" ("deletion_scheduled_for") WHERE "deletion_scheduled_for" IS NOT NULL AND "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_users_deletion_due" ON "users" ("deletion_scheduled_for") WHERE "deletion_scheduled_for" IS NOT NULL AND "deleted_at" IS NULL`);
    await queryRunner.query(`ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_641011a87c8bd01845887b19cf1" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_64c90edc7310c6be7c10c96f675" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "push_deliveries" ADD CONSTRAINT "FK_f3d2045af28957113a714e49f94" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "push_deliveries" ADD CONSTRAINT "FK_43155f860140c479ce7997e5c5f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "push_deliveries" DROP CONSTRAINT "FK_43155f860140c479ce7997e5c5f"`);
    await queryRunner.query(`ALTER TABLE "push_deliveries" DROP CONSTRAINT "FK_f3d2045af28957113a714e49f94"`);
    await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_64c90edc7310c6be7c10c96f675"`);
    await queryRunner.query(`ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_641011a87c8bd01845887b19cf1"`);
    await queryRunner.query(`ALTER TABLE "device_tokens" DROP CONSTRAINT "FK_17e1f528b993c6d55def4cf5bea"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_deletion_due"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_businesses_deletion_due"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletion_scheduled_for"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "deletion_scheduled_for"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_push_deliveries_due"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_push_deliveries_notification"`);
    await queryRunner.query(`DROP TABLE "push_deliveries"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_notification_preferences_user_type"`);
    await queryRunner.query(`DROP TABLE "notification_preferences"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_device_tokens_token"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_825e46654efced771b174a1ee3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e74bf3adff79e094bd230d9f2b"`);
    await queryRunner.query(`DROP TABLE "device_tokens"`);
  }
}
