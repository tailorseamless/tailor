import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The AI layer (platform key only):
 *  - ai_credentials: the platform's provider keys, encrypted (one per provider, at most one in use);
 *  - ai_usage_logs: one row per AI request, counts only (never prompts, photos or replies);
 *  - ai_daily_usage: each business's AI requests today, against the daily allowance;
 *  - ai_settings: one row holding that allowance.
 *
 * Purely additive. Constraint names are TypeORM's own (DefaultNamingStrategy), so the CI drift check stays clean.
 */
export class AddAi1796100000000 implements MigrationInterface {
  name = "AddAi1796100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_credentials" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "provider" character varying(20) NOT NULL, "model" character varying(120) NOT NULL, "feature_models" jsonb NOT NULL DEFAULT '{}', "base_url" character varying(300), "key_ciphertext" text NOT NULL, "key_last4" character varying(4) NOT NULL, "is_active" boolean NOT NULL DEFAULT false, "updated_by" uuid, CONSTRAINT "CHK_48bdc7c77f42325fb46b5809a5" CHECK ("provider" IN ('anthropic','openai','gemini','ollama')), CONSTRAINT "PK_6f51574e76d585a7f695d6493b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_ai_credentials_provider" ON "ai_credentials" ("provider") `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ai_credentials_active" ON "ai_credentials" ("is_active") WHERE "is_active"`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_usage_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid, "user_id" uuid, "provider" character varying(20) NOT NULL, "model" character varying(120) NOT NULL, "feature" character varying(40) NOT NULL, "input_tokens" integer NOT NULL DEFAULT '0', "output_tokens" integer NOT NULL DEFAULT '0', "status" character varying(10) NOT NULL, "error_kind" character varying(20), "duration_ms" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_30eb0aa9921f74c38f48e95f59" CHECK ("status" IN ('ok','error')), CONSTRAINT "PK_7f42670987a1de5cb209a77e925" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_logs_business_created" ON "ai_usage_logs" ("business_id", "created_at") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_ai_usage_logs_created" ON "ai_usage_logs" ("created_at") `);

    await queryRunner.query(
      `CREATE TABLE "ai_daily_usage" ("business_id" uuid NOT NULL, "day" date NOT NULL, "used" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_da4f082fb4ef132f5cf010e799" CHECK ("used" >= 0), CONSTRAINT "PK_87535585f76e0da6e4d804a2ea1" PRIMARY KEY ("business_id", "day"))`,
    );

    await queryRunner.query(
      `CREATE TABLE "ai_settings" ("id" smallint NOT NULL DEFAULT '1', "daily_limit" integer NOT NULL DEFAULT '20', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, CONSTRAINT "CHK_4ecd94915248fb30f716be122f" CHECK ("id" = 1), CONSTRAINT "CHK_188ed13bea11c82cd4ff386386" CHECK ("daily_limit" >= 0), CONSTRAINT "PK_b6c95e8fdde441f7e72e1d4f10c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`INSERT INTO "ai_settings" ("id", "daily_limit") VALUES (1, 20)`);

    await queryRunner.query(
      `ALTER TABLE "ai_credentials" ADD CONSTRAINT "FK_87e3fb673ca5a788ae04ee19d8d" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "FK_c8704df34ee9a619236d6169122" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "FK_b81535100ed8a29f2184b4e862c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_daily_usage" ADD CONSTRAINT "FK_a5274c42e42e0b0ea922d5f9425" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_settings" ADD CONSTRAINT "FK_6d984aa5ef3dd75e57027fed581" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_settings" DROP CONSTRAINT "FK_6d984aa5ef3dd75e57027fed581"`);
    await queryRunner.query(`ALTER TABLE "ai_daily_usage" DROP CONSTRAINT "FK_a5274c42e42e0b0ea922d5f9425"`);
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP CONSTRAINT "FK_b81535100ed8a29f2184b4e862c"`);
    await queryRunner.query(`ALTER TABLE "ai_usage_logs" DROP CONSTRAINT "FK_c8704df34ee9a619236d6169122"`);
    await queryRunner.query(`ALTER TABLE "ai_credentials" DROP CONSTRAINT "FK_87e3fb673ca5a788ae04ee19d8d"`);
    await queryRunner.query(`DROP TABLE "ai_settings"`);
    await queryRunner.query(`DROP TABLE "ai_daily_usage"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_usage_logs_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_usage_logs_business_created"`);
    await queryRunner.query(`DROP TABLE "ai_usage_logs"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_ai_credentials_active"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_ai_credentials_provider"`);
    await queryRunner.query(`DROP TABLE "ai_credentials"`);
  }
}
