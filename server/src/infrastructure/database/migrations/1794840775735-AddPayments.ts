import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayments1794840775735 implements MigrationInterface {
  name = "AddPayments1794840775735";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "key" character varying(100) NOT NULL, "request_hash" character varying(64) NOT NULL, "status_code" integer, "response" jsonb, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_e5fc0731b6752a8e9194fa265e" ON "idempotency_keys" ("expires_at") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_idempotency_keys_user_key" ON "idempotency_keys" ("user_id", "key") `);
    await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "order_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "kind" character varying(10) NOT NULL, "amount" numeric(14,2) NOT NULL, "method" character varying(20) NOT NULL, "reference" character varying(100), "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL, "note" text, "receipt_number" character varying(30), "reverses_payment_id" uuid, "recorded_by" uuid, CONSTRAINT "CHK_f24d2d5299d964791cccefd835" CHECK (("kind" = 'void') = ("reverses_payment_id" IS NOT NULL)), CONSTRAINT "CHK_74f1d9367b587c6ebcf04ed4da" CHECK ("amount" > 0), CONSTRAINT "CHK_c316ba7ab52bc6fde03fbe0b92" CHECK ("method" IN ('cash','bank_transfer','pos','other')), CONSTRAINT "CHK_dae6b9ee9464d2b398f1177d28" CHECK ("kind" IN ('payment','refund','void')), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payments_reverses" ON "payments" ("reverses_payment_id") WHERE "reverses_payment_id" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_payments_receipt" ON "payments" ("business_id", "receipt_number") WHERE "receipt_number" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_4bd5c2c015476fc3643af3b7f2" ON "payments" ("business_id", "customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_589e7130fe992e5b62d2d5bf2f" ON "payments" ("business_id", "paid_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_e9a7d9567320bc4fa02ef9b0bf" ON "payments" ("order_id", "created_at") `);
    await queryRunner.query(`ALTER TABLE "businesses" ADD "receipt_seq" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "idempotency_keys" ADD CONSTRAINT "FK_4d2181624ba2d61e76a07175198" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_07889d42d0b29705cf4a649576b" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b2f7b823a21562eeca20e72b006" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_d0b02233df1c52323107fe7b4d7" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_4e117c295f4eaa8a76c4915f201" FOREIGN KEY ("reverses_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b8128ab843771cf6d42ab3ca188" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b8128ab843771cf6d42ab3ca188"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_4e117c295f4eaa8a76c4915f201"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_d0b02233df1c52323107fe7b4d7"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b2f7b823a21562eeca20e72b006"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_07889d42d0b29705cf4a649576b"`);
    await queryRunner.query(`ALTER TABLE "idempotency_keys" DROP CONSTRAINT "FK_4d2181624ba2d61e76a07175198"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "receipt_seq"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e9a7d9567320bc4fa02ef9b0bf"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_589e7130fe992e5b62d2d5bf2f"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4bd5c2c015476fc3643af3b7f2"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_payments_receipt"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_payments_reverses"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_idempotency_keys_user_key"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e5fc0731b6752a8e9194fa265e"`);
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
