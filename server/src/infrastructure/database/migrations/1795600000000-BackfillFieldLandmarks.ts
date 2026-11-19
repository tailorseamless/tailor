import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gives the measurement fields businesses already have their body spot (measurement_fields.landmark), where the field
 * is one of the standard measurements and the right spot is not in doubt: Neck, Shoulder, Chest/Bust, Waist, Hip,
 * Thigh, Knee, Sleeve, Gown length, Jacket length, Trouser length, and a bare "Length" (waist-down in a template named
 * for trousers, pants, shorts, a skirt or a waist, otherwise shoulder-down). These are exactly the spots the figure
 * already guesses from those names, so nothing changes on screen; it just stops depending on the guess.
 *
 * It never overwrites a choice (only rows still NULL are touched), and it leaves every other name alone — "Round
 * Neck", "Waist Length", "Under Bust Length" and the like are for the owner to set in the template editor, because
 * only they know what they mean.
 *
 * The rules match `landmarkFor` in the web app for these names. They are written out here, not imported, because a
 * migration has to mean the same thing forever, whatever that guess later learns.
 */

/** A name as the web app reads it: lower case, letters and single spaces only. */
const normalised = (column: string) =>
  String.raw`btrim(regexp_replace(regexp_replace(lower(${column}), '[^a-z\s]', ' ', 'g'), '\s+', ' ', 'g'))`;

/** Every live field of a live template, with the spot this migration would give it (NULL: leave it). */
const spots = String.raw`
  WITH named AS (
    SELECT f.id, f.landmark AS current_spot, ${normalised("f.name")} AS n,
           (${normalised("t.name")} ~ '(trouser|\mpants?\M|\mshorts\M|skirt|waist)') AS lower_body
    FROM "measurement_fields" f
    JOIN "measurement_templates" t ON t."id" = f."template_id" AND t."deleted_at" IS NULL
    WHERE f."deleted_at" IS NULL
  )
  SELECT id, current_spot, CASE n
      WHEN 'neck' THEN 'neck'
      WHEN 'shoulder' THEN 'shoulder'
      WHEN 'chest' THEN 'bust'
      WHEN 'bust' THEN 'bust'
      WHEN 'waist' THEN 'waist'
      WHEN 'hip' THEN 'hip'
      WHEN 'thigh' THEN 'thigh'
      WHEN 'knee' THEN 'knee'
      WHEN 'sleeve' THEN 'sleeve'
      WHEN 'gown length' THEN 'length'
      WHEN 'jacket length' THEN 'length'
      WHEN 'trouser length' THEN 'trouserLength'
      WHEN 'length' THEN CASE WHEN lower_body THEN 'trouserLength' ELSE 'length' END
    END AS spot
  FROM named`;

export class BackfillFieldLandmarks1795600000000 implements MigrationInterface {
  name = "BackfillFieldLandmarks1795600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(String.raw`
      UPDATE "measurement_fields" f
      SET "landmark" = s.spot
      FROM (${spots}) s
      WHERE f."id" = s.id AND s.spot IS NOT NULL AND s.current_spot IS NULL`);
  }

  /**
   * Clears only the fields whose spot is exactly what `up` would have given them. Those fields behave the same
   * either way (the figure guesses the same spot from the name), so this loses nothing; anything the owner chose
   * differently is left as it is.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(String.raw`
      UPDATE "measurement_fields" f
      SET "landmark" = NULL
      FROM (${spots}) s
      WHERE f."id" = s.id AND s.spot IS NOT NULL AND s.current_spot = s.spot`);
  }
}
