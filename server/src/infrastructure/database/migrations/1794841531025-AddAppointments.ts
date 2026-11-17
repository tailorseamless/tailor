import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAppointments1794841531025 implements MigrationInterface {
  name = "AddAppointments1794841531025";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "order_id" uuid, "type" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'scheduled', "starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_minutes" integer NOT NULL DEFAULT '30', "notes" text, "change_note" text, "created_by" uuid, CONSTRAINT "CHK_2af69a39e55df46f5fec4f340d" CHECK ("duration_minutes" > 0), CONSTRAINT "CHK_ac40244af5dcf0a9b2736a6291" CHECK ("status" IN ('scheduled','completed','cancelled','no_show')), CONSTRAINT "CHK_c82e4ff00aebc1e1a1e12d3ae2" CHECK ("type" IN ('measurement','consultation','fitting','alteration','collection')), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_d3bc1ff11187717888e693d6de" ON "appointments" ("order_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_79890b335aa003b21c7b763686" ON "appointments" ("business_id", "customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_6add489d47158a835107c0566a" ON "appointments" ("business_id", "starts_at") `);
    await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_1496c752231bd35c97041862bd4" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_2be3c78815aba227af1c3e8e413" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_d3bc1ff11187717888e693d6de1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_d7ca5e722b384f282042d92f4c1" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_d7ca5e722b384f282042d92f4c1"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_d3bc1ff11187717888e693d6de1"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_2be3c78815aba227af1c3e8e413"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_1496c752231bd35c97041862bd4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6add489d47158a835107c0566a"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_79890b335aa003b21c7b763686"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d3bc1ff11187717888e693d6de"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
  }
}
