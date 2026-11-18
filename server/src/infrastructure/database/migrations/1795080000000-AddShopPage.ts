import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A business's public page (its designs, price ranges and contact details) is now separate from online booking:
 * a tailor can publish the page without taking bookings. Designs get an optional price range to show on it.
 *
 * Additive, so the previous version of the API keeps working against the new schema. Pages that were already
 * public (booking switched on) stay public.
 */
export class AddShopPage1795080000000 implements MigrationInterface {
  name = "AddShopPage1795080000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD "page_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "businesses" SET "page_enabled" = true WHERE "booking_enabled" = true`);
    await queryRunner.query(`ALTER TABLE "designs" ADD "price_min" numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "designs" ADD "price_max" numeric(14,2)`);
    await queryRunner.query(
      `ALTER TABLE "designs" ADD CONSTRAINT "CHK_designs_price_range" CHECK (("price_min" IS NULL OR "price_min" >= 0) AND ("price_max" IS NULL OR "price_max" >= 0) AND ("price_min" IS NULL OR "price_max" IS NULL OR "price_min" <= "price_max"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "designs" DROP CONSTRAINT "CHK_designs_price_range"`);
    await queryRunner.query(`ALTER TABLE "designs" DROP COLUMN "price_max"`);
    await queryRunner.query(`ALTER TABLE "designs" DROP COLUMN "price_min"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "page_enabled"`);
  }
}
