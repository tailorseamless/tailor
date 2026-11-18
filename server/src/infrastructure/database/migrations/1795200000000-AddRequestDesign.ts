import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A request made from "Book a fitting" on a design now remembers which design, so staff see the style itself
 * (name, price range, picture) instead of only a line in the note.
 *
 * Additive: the column is nullable, so older requests and the previous version of the API are unaffected. If the
 * design is later deleted the request keeps its note and the link just clears.
 */
export class AddRequestDesign1795200000000 implements MigrationInterface {
  name = "AddRequestDesign1795200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointment_requests" ADD "design_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "appointment_requests" ADD CONSTRAINT "FK_8ab3aae10ca3412fa58a2cf0680" FOREIGN KEY ("design_id") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    // Requests made before this only have the style's name in the note ("I'd like this style: <name>"). Link those
    // that match one design of the same business exactly; anything unclear is left alone rather than guessed at.
    await queryRunner.query(`
      UPDATE "appointment_requests" r
      SET "design_id" = d."id"
      FROM "designs" d
      WHERE r."design_id" IS NULL
        AND r."deleted_at" IS NULL
        AND d."deleted_at" IS NULL
        AND d."business_id" = r."business_id"
        AND r."note" = 'I''d like this style: ' || d."name"
        AND (
          SELECT count(*) FROM "designs" d2
          WHERE d2."business_id" = r."business_id" AND d2."deleted_at" IS NULL AND d2."name" = d."name"
        ) = 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "appointment_requests" DROP CONSTRAINT "FK_8ab3aae10ca3412fa58a2cf0680"`);
    await queryRunner.query(`ALTER TABLE "appointment_requests" DROP COLUMN "design_id"`);
  }
}
