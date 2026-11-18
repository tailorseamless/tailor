import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Order items can carry an estimate range (a quote before the final price is agreed) and a discount.
 * Everything is additive: new nullable columns and one defaulted column, so the previous version of the
 * API keeps working against the new schema.
 */
export class AddItemEstimatesAndDiscounts1794994426354 implements MigrationInterface {
  name = "AddItemEstimatesAndDiscounts1794994426354";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" ADD "estimate_min" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "estimate_max" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "discount_type" character varying(10)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "discount_value" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD "discount_amount" numeric(14,2) NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "estimated_max_total" numeric(14,2)`);
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_0ae28d793a1d369f66b21f3f7f" CHECK (("estimate_min" IS NULL) = ("estimate_max" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_7de13e9b6c53819f23fdb5ec8a" CHECK ("estimate_min" IS NULL OR ("estimate_min" >= 0 AND "estimate_min" <= "estimate_max"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_7664adcc1680f3db2e1178cfc5" CHECK ("discount_type" IS NULL OR "discount_type" IN ('amount','percent'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_91ca2d304e5c0e9bcbbdee530f" CHECK (("discount_type" IS NULL) = ("discount_value" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_b5db2abd931ff6056abba2808f" CHECK ("discount_value" IS NULL OR "discount_value" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_043083fac33dfb7de03d1844a7" CHECK ("discount_type" IS DISTINCT FROM 'percent' OR "discount_value" <= 100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "CHK_bb6e95a0b8b0ac8bcf67c95024" CHECK ("discount_amount" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "CHK_33cd87ab7bb5cb907d05a43598" CHECK ("estimated_max_total" IS NULL OR "estimated_max_total" >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_33cd87ab7bb5cb907d05a43598"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_bb6e95a0b8b0ac8bcf67c95024"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_043083fac33dfb7de03d1844a7"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_b5db2abd931ff6056abba2808f"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_91ca2d304e5c0e9bcbbdee530f"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_7664adcc1680f3db2e1178cfc5"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_7de13e9b6c53819f23fdb5ec8a"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_0ae28d793a1d369f66b21f3f7f"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "estimated_max_total"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "discount_amount"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "discount_value"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "discount_type"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "estimate_max"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "estimate_min"`);
  }
}
