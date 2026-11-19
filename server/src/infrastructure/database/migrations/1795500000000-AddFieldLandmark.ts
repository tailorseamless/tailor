import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A measurement template's field can now say where on the body it is taken (neck, waist, trouser length… or "none"
 * to keep it off the figure), so a new template's measurements land in the right place instead of being guessed from
 * the words in their names.
 *
 * Additive and nullable: NULL means "place it by its name", which is exactly how every existing field behaves today,
 * so nothing changes for existing templates and the previous version of the API is unaffected. The spot is also
 * copied into each recorded measurement's values (jsonb), which needs no schema change.
 */
export class AddFieldLandmark1795500000000 implements MigrationInterface {
  name = "AddFieldLandmark1795500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "measurement_fields" ADD "landmark" character varying(20)`);
    await queryRunner.query(
      `ALTER TABLE "measurement_fields" ADD CONSTRAINT "CHK_measurement_fields_landmark" CHECK ("landmark" IS NULL OR "landmark" IN ('neck','shoulder','bust','underbust','waist','hip','thigh','knee','calf','ankle','bicep','wrist','sleeve','length','trouserLength','none'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "measurement_fields" DROP CONSTRAINT "CHK_measurement_fields_landmark"`);
    await queryRunner.query(`ALTER TABLE "measurement_fields" DROP COLUMN "landmark"`);
  }
}
