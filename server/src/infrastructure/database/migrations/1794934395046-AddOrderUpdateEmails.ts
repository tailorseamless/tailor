import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderUpdateEmails1794934395046 implements MigrationInterface {
  name = "AddOrderUpdateEmails1794934395046";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD "email_order_updates" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "email_order_updates"`);
  }
}
