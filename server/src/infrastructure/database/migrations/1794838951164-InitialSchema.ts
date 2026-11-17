import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794838951164 implements MigrationInterface {
  name = "InitialSchema1794838951164";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "actor_id" uuid, "action" character varying(100) NOT NULL, "entity_type" character varying(50) NOT NULL, "entity_id" uuid, "payload" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_15ee921c3d009b72ce35cba1b6" ON "audit_logs" ("business_id", "created_at") `);
    await queryRunner.query(`CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "name" character varying(150) NOT NULL, "email" character varying(150), "phone" character varying(30), "address" text, "currency" character varying(3) NOT NULL DEFAULT 'NGN', "time_zone" character varying(64) NOT NULL DEFAULT 'Africa/Lagos', "measurement_unit" character varying(2) NOT NULL DEFAULT 'in', "status" character varying(20) NOT NULL DEFAULT 'active', CONSTRAINT "CHK_8e0dcfab3720389ba89cf7d86c" CHECK ("measurement_unit" IN ('in','cm')), CONSTRAINT "CHK_ecc8f8a488f688c5e54a92879c" CHECK ("status" IN ('active','suspended')), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "business_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', CONSTRAINT "CHK_10ca899fc39cab1423f072ed32" CHECK ("status" IN ('active','suspended')), CONSTRAINT "CHK_3df209eca515e745382e38b799" CHECK ("role" IN ('owner','manager','tailor','receptionist','accountant','apprentice')), CONSTRAINT "PK_0665f675783d42efe8fb5e5697c" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_7a8eebc9f4792ffdc2d350643f" ON "business_members" ("user_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_7cc6b07f2f5ab581faba92c069" ON "business_members" ("business_id", "status") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_business_members_live" ON "business_members" ("business_id", "user_id") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "full_name" character varying(150) NOT NULL, "phone" character varying(30) NOT NULL, "email" character varying(150), "address" text, "gender" character varying(10), "notes" text, "created_by" uuid, CONSTRAINT "CHK_048ca946034c7a00b1d811b394" CHECK ("gender" IS NULL OR "gender" IN ('female','male','other')), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_af93d923de1e8b9e89dfffe8ee" ON "customers" ("business_id", "phone") `);
    await queryRunner.query(`CREATE INDEX "IDX_55122ba9bf60c0723536530bc4" ON "customers" ("business_id", "full_name") `);
    await queryRunner.query(`CREATE INDEX "IDX_e614f84fa140659985f6a920db" ON "customers" ("business_id", "created_at") `);
    await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "firebase_uid" character varying(128), "email" character varying(150) NOT NULL, "full_name" character varying(150) NOT NULL, "phone" character varying(30), "platform_role" character varying(20) NOT NULL DEFAULT 'user', "status" character varying(20) NOT NULL DEFAULT 'active', "time_zone" character varying(64) NOT NULL DEFAULT 'Africa/Lagos', CONSTRAINT "CHK_dedc3bed9b77016699fcae3545" CHECK ("status" IN ('active','disabled')), CONSTRAINT "CHK_9c380de61e61e18783a2f106be" CHECK ("platform_role" IN ('user','super_admin')), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_cde4b2aabca86cfabdc78b537f" ON "users" ("business_id") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_firebase_uid" ON "users" ("firebase_uid") WHERE "firebase_uid" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email_live" ON "users" ("email") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_0d8f60e55e907cb87edc9f38a9b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_members" ADD CONSTRAINT "FK_123f737f36b33e71fe0b3028fdc" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "business_members" ADD CONSTRAINT "FK_7a8eebc9f4792ffdc2d350643fe" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "FK_c04b1ab3076e753f96c64318286" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "FK_8f138f284609b045dc64c91757a" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_cde4b2aabca86cfabdc78b537f0" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_cde4b2aabca86cfabdc78b537f0"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_8f138f284609b045dc64c91757a"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_c04b1ab3076e753f96c64318286"`);
    await queryRunner.query(`ALTER TABLE "business_members" DROP CONSTRAINT "FK_7a8eebc9f4792ffdc2d350643fe"`);
    await queryRunner.query(`ALTER TABLE "business_members" DROP CONSTRAINT "FK_123f737f36b33e71fe0b3028fdc"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_0d8f60e55e907cb87edc9f38a9b"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email_live"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_firebase_uid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cde4b2aabca86cfabdc78b537f"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e614f84fa140659985f6a920db"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_55122ba9bf60c0723536530bc4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_af93d923de1e8b9e89dfffe8ee"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_business_members_live"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7cc6b07f2f5ab581faba92c069"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7a8eebc9f4792ffdc2d350643f"`);
    await queryRunner.query(`DROP TABLE "business_members"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_15ee921c3d009b72ce35cba1b6"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
