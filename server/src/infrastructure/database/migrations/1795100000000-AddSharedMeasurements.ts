import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Customers can send measurements an earlier tailor took along with an appointment request. They wait on the
 * request until staff accept it, then become an ordinary measurement record marked as coming from the customer.
 *
 * Additive, so the previous version of the API keeps working against the new schema: every new column is
 * nullable or has a default.
 */
export class AddSharedMeasurements1795100000000 implements MigrationInterface {
  name = "AddSharedMeasurements1795100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointment_requests" ADD "measurements" jsonb`);
    await queryRunner.query(`ALTER TABLE "appointment_requests" ADD "measurement_unit" character varying(2)`);
    await queryRunner.query(
      `ALTER TABLE "appointment_requests" ADD CONSTRAINT "CHK_appointment_requests_measurement_unit" CHECK ("measurement_unit" IS NULL OR "measurement_unit" IN ('in','cm'))`,
    );
    await queryRunner.query(`ALTER TABLE "customer_measurements" ADD "source" character varying(10) NOT NULL DEFAULT 'staff'`);
    await queryRunner.query(
      `ALTER TABLE "customer_measurements" ADD CONSTRAINT "CHK_customer_measurements_source" CHECK ("source" IN ('staff','customer'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customer_measurements" DROP CONSTRAINT "CHK_customer_measurements_source"`);
    await queryRunner.query(`ALTER TABLE "customer_measurements" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "appointment_requests" DROP CONSTRAINT "CHK_appointment_requests_measurement_unit"`);
    await queryRunner.query(`ALTER TABLE "appointment_requests" DROP COLUMN "measurement_unit"`);
    await queryRunner.query(`ALTER TABLE "appointment_requests" DROP COLUMN "measurements"`);
  }
}
