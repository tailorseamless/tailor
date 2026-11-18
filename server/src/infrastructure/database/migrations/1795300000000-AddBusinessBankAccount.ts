import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Where a business wants customers to pay: bank, account number and the name on the account. Shown on the public
 * page so a customer can send a deposit without asking.
 *
 * Additive: all three columns are nullable, so existing businesses (and the previous version of the API) are
 * unaffected. The three are only ever set together; that rule lives in the service, not as a constraint, so a
 * half-filled form is refused with a clear message instead of a database error.
 */
export class AddBusinessBankAccount1795300000000 implements MigrationInterface {
  name = "AddBusinessBankAccount1795300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" ADD "bank_name" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD "account_number" character varying(34)`);
    await queryRunner.query(`ALTER TABLE "businesses" ADD "account_name" character varying(150)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "account_name"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "account_number"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "bank_name"`);
  }
}
