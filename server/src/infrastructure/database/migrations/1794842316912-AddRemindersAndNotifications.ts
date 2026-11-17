import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRemindersAndNotifications1794842316912 implements MigrationInterface {
  name = "AddRemindersAndNotifications1794842316912";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "user_id" uuid NOT NULL, "type" character varying(50) NOT NULL, "title" character varying(200) NOT NULL, "body" text, "link_path" character varying(300), "read_at" TIMESTAMP WITH TIME ZONE, "dedupe_key" character varying(200), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_notifications_dedupe" ON "notifications" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_unread" ON "notifications" ("user_id") WHERE "read_at" IS NULL AND "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_310667f935698fcd8cb319113a" ON "notifications" ("user_id", "created_at") `);
    await queryRunner.query(`ALTER TABLE "appointments" ADD "assigned_to" uuid`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD "reminder_minutes_before" integer`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD "reminder_sent_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX "IDX_appointments_reminder_due" ON "appointments" ("starts_at") WHERE "status" = 'scheduled' AND "reminder_minutes_before" IS NOT NULL AND "reminder_sent_at" IS NULL AND "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_6bea02b4a1b7dd55453d9f8df3" ON "appointments" ("business_id", "assigned_to", "starts_at") `);
    await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "CHK_0a63ce5916b91df43442b970b3" CHECK ("reminder_minutes_before" IS NULL OR "reminder_minutes_before" > 0)`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_5233c97891d437e588574ff9e4f" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_b1b5043ada10de525123ccdd40e" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
    await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_b1b5043ada10de525123ccdd40e"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_5233c97891d437e588574ff9e4f"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "CHK_0a63ce5916b91df43442b970b3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6bea02b4a1b7dd55453d9f8df3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_appointments_reminder_due"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "reminder_sent_at"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "reminder_minutes_before"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN "assigned_to"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_310667f935698fcd8cb319113a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_unread"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_notifications_dedupe"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
