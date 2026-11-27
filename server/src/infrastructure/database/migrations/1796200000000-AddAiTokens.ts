import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * AI is paid from each business's token balance instead of a daily limit on requests:
 *  - ai_token_accounts: one balance per business, never below zero;
 *  - ai_token_transactions: the ledger of every change;
 *  - ai_settings.starting_tokens replaces ai_settings.daily_limit;
 *  - ai_daily_usage is dropped (it only counted today's requests).
 *
 * Constraint names are TypeORM's own (DefaultNamingStrategy), so the CI drift check stays clean.
 */
export class AddAiTokens1796200000000 implements MigrationInterface {
  name = "AddAiTokens1796200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_token_accounts" ("business_id" uuid NOT NULL, "balance" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_d207bbd8ea19050a6ca09084ce" CHECK ("balance" >= 0), CONSTRAINT "PK_aef640ef17d6ab8e3f5a4cecc55" PRIMARY KEY ("business_id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ai_token_transactions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "amount" integer NOT NULL, "balance_after" integer NOT NULL, "feature" character varying(40), "note" character varying(300), "actor_id" uuid, CONSTRAINT "CHK_c7c788740f22876769fc0bf685" CHECK ("type" IN ('starting','grant','adjustment','usage')), CONSTRAINT "PK_f26e6cff90d2473bcb0beb9d83e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_token_transactions_business_created" ON "ai_token_transactions" ("business_id", "created_at") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_token_accounts" ADD CONSTRAINT "FK_aef640ef17d6ab8e3f5a4cecc55" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_token_transactions" ADD CONSTRAINT "FK_cfefe55a6fc8f1c43a9d4826c97" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_token_transactions" ADD CONSTRAINT "FK_871c7b4bb3e4052f109a91a7bb9" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "ai_settings" DROP CONSTRAINT "CHK_188ed13bea11c82cd4ff386386"`);
    await queryRunner.query(`ALTER TABLE "ai_settings" DROP COLUMN "daily_limit"`);
    await queryRunner.query(`ALTER TABLE "ai_settings" ADD "starting_tokens" integer NOT NULL DEFAULT '100000'`);
    await queryRunner.query(
      `ALTER TABLE "ai_settings" ADD CONSTRAINT "CHK_fc569be12177fdda1fa31433cf" CHECK ("starting_tokens" >= 0)`,
    );

    await queryRunner.query(`ALTER TABLE "ai_daily_usage" DROP CONSTRAINT "FK_a5274c42e42e0b0ea922d5f9425"`);
    await queryRunner.query(`DROP TABLE "ai_daily_usage"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_daily_usage" ("business_id" uuid NOT NULL, "day" date NOT NULL, "used" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_da4f082fb4ef132f5cf010e799" CHECK ("used" >= 0), CONSTRAINT "PK_87535585f76e0da6e4d804a2ea1" PRIMARY KEY ("business_id", "day"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_daily_usage" ADD CONSTRAINT "FK_a5274c42e42e0b0ea922d5f9425" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "ai_settings" DROP CONSTRAINT "CHK_fc569be12177fdda1fa31433cf"`);
    await queryRunner.query(`ALTER TABLE "ai_settings" DROP COLUMN "starting_tokens"`);
    await queryRunner.query(`ALTER TABLE "ai_settings" ADD "daily_limit" integer NOT NULL DEFAULT '20'`);
    await queryRunner.query(
      `ALTER TABLE "ai_settings" ADD CONSTRAINT "CHK_188ed13bea11c82cd4ff386386" CHECK ("daily_limit" >= 0)`,
    );

    await queryRunner.query(`ALTER TABLE "ai_token_transactions" DROP CONSTRAINT "FK_871c7b4bb3e4052f109a91a7bb9"`);
    await queryRunner.query(`ALTER TABLE "ai_token_transactions" DROP CONSTRAINT "FK_cfefe55a6fc8f1c43a9d4826c97"`);
    await queryRunner.query(`ALTER TABLE "ai_token_accounts" DROP CONSTRAINT "FK_aef640ef17d6ab8e3f5a4cecc55"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ai_token_transactions_business_created"`);
    await queryRunner.query(`DROP TABLE "ai_token_transactions"`);
    await queryRunner.query(`DROP TABLE "ai_token_accounts"`);
  }
}
