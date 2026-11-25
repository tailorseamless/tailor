import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Platform announcements: messages from Tailor Seamless to every business's owners (or whole teams), delivered
 * as in-app notifications by the deliverAnnouncements job, 50 businesses a run, resuming from cursor_business_id.
 *
 * Purely additive. Constraint names are TypeORM's own (DefaultNamingStrategy), so the CI drift check stays clean.
 */
export class AddPlatformAnnouncements1796000000000 implements MigrationInterface {
  name = "AddPlatformAnnouncements1796000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "platform_announcements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "author_id" uuid, "title" character varying(120) NOT NULL, "body" text NOT NULL, "link_path" character varying(300), "audience" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'queued', "cursor_business_id" uuid, "businesses_reached" integer NOT NULL DEFAULT '0', "recipients" integer NOT NULL DEFAULT '0', "sent_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_265c49bebf0322701ce99acdc7" CHECK ("audience" IN ('owners','everyone')), CONSTRAINT "CHK_7e364100f31120184e4bcdf921" CHECK ("status" IN ('queued','sending','sent','cancelled')), CONSTRAINT "PK_359502afacefd59e6f4e6456397" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_platform_announcements_status" ON "platform_announcements" ("status", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_announcements" ADD CONSTRAINT "FK_8c353ee9eba769e68994369637e" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "platform_announcements" DROP CONSTRAINT "FK_8c353ee9eba769e68994369637e"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_platform_announcements_status"`);
    await queryRunner.query(`DROP TABLE "platform_announcements"`);
  }
}
