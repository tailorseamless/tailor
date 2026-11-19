import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Progress through the getting-started guide (measurement templates → customers → an order → designs), kept on the
 * user so it follows them from phone to laptop.
 *
 * Additive and nullable: existing people get NULL, which the client reads as "never opened for you", so the guide
 * does not suddenly pop up for businesses already running. New owners get it set when they register.
 */
export class AddUserOnboarding1795400000000 implements MigrationInterface {
  name = "AddUserOnboarding1795400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "onboarding" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "onboarding"`);
  }
}
