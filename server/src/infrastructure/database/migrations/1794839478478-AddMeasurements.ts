import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMeasurements1794839478478 implements MigrationInterface {
  name = "AddMeasurements1794839478478";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "customer_measurements" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "template_id" uuid, "template_name" character varying(100), "unit" character varying(2) NOT NULL, "measured_on" date NOT NULL, "notes" text, "entries" jsonb NOT NULL DEFAULT '[]', "recorded_by" uuid, CONSTRAINT "CHK_6ffd54492cf59b7bb097dca602" CHECK ("unit" IN ('in','cm')), CONSTRAINT "PK_04e4feaee73b9a83006d01adcd8" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_e3aaba593a141ca10e6c422662" ON "customer_measurements" ("customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_112e2718b333d0297ebabb9bbc" ON "customer_measurements" ("business_id", "customer_id", "measured_on") `);
    await queryRunner.query(`CREATE TABLE "measurement_fields" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "template_id" uuid NOT NULL, "name" character varying(80) NOT NULL, "position" integer NOT NULL DEFAULT '0', "is_required" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_2da006bd5c59b782b00ee5cc06a" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_2fa1cf933c46c7074b784dc467" ON "measurement_fields" ("template_id", "position") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_measurement_fields_name_live" ON "measurement_fields" ("template_id", "name") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE TABLE "measurement_templates" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" text, CONSTRAINT "PK_34e1ef1df57ea2491089fe3edf4" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_measurement_templates_name_live" ON "measurement_templates" ("business_id", "name") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" ADD CONSTRAINT "FK_9c990ce22beec028794d1eb70b7" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" ADD CONSTRAINT "FK_e3aaba593a141ca10e6c4226628" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" ADD CONSTRAINT "FK_995d67490515a9901c7e81ea9fb" FOREIGN KEY ("template_id") REFERENCES "measurement_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" ADD CONSTRAINT "FK_2c9ab833357a1102c47bfc63bb8" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "measurement_fields" ADD CONSTRAINT "FK_172bd13a8b4a586d5ea832d4ad8" FOREIGN KEY ("template_id") REFERENCES "measurement_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "measurement_templates" ADD CONSTRAINT "FK_ac70de20dfd2dcc08c87b8627c6" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "measurement_templates" DROP CONSTRAINT "FK_ac70de20dfd2dcc08c87b8627c6"`);
    await queryRunner.query(`ALTER TABLE "measurement_fields" DROP CONSTRAINT "FK_172bd13a8b4a586d5ea832d4ad8"`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" DROP CONSTRAINT "FK_2c9ab833357a1102c47bfc63bb8"`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" DROP CONSTRAINT "FK_995d67490515a9901c7e81ea9fb"`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" DROP CONSTRAINT "FK_e3aaba593a141ca10e6c4226628"`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" DROP CONSTRAINT "FK_9c990ce22beec028794d1eb70b7"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_measurement_templates_name_live"`);
    await queryRunner.query(`DROP TABLE "measurement_templates"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_measurement_fields_name_live"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2fa1cf933c46c7074b784dc467"`);
    await queryRunner.query(`DROP TABLE "measurement_fields"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_112e2718b333d0297ebabb9bbc"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e3aaba593a141ca10e6c422662"`);
    await queryRunner.query(`DROP TABLE "customer_measurements"`);
  }
}
