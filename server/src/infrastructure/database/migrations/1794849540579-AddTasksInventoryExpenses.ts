import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTasksInventoryExpenses1794849540579 implements MigrationInterface {
  name = "AddTasksInventoryExpenses1794849540579";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "category" character varying(20) NOT NULL, "amount" numeric(14,2) NOT NULL, "spent_on" date NOT NULL, "description" character varying(300) NOT NULL, "method" character varying(20) NOT NULL DEFAULT 'cash', "reference" character varying(100), "recorded_by" uuid, CONSTRAINT "CHK_2a9ace1ff35dc3d2ae1ae9ebd5" CHECK ("amount" > 0), CONSTRAINT "CHK_120d136efe7f794ee862be5d6b" CHECK ("method" IN ('cash','bank_transfer','pos','other')), CONSTRAINT "CHK_c67578563e81e0b22e700e29be" CHECK ("category" IN ('materials','rent','electricity','transport','wages','equipment','other')), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_195466747abf421f969da045f4" ON "expenses" ("business_id", "category") `);
    await queryRunner.query(`CREATE INDEX "IDX_19a8293adad6395dfa145a7194" ON "expenses" ("business_id", "spent_on") `);
    await queryRunner.query(`CREATE TABLE "inventory_transactions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_id" uuid NOT NULL, "material_id" uuid NOT NULL, "kind" character varying(20) NOT NULL, "change" numeric(14,3) NOT NULL, "balance_after" numeric(14,3) NOT NULL, "unit_cost" numeric(14,2), "order_id" uuid, "note" text, "recorded_by" uuid, CONSTRAINT "CHK_0e86eb4a8a1f6e5abc742e7784" CHECK ("kind" IN ('purchase','usage','adjustment')), CONSTRAINT "PK_9b7144851f08f9eededde7edd42" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_23afde96676fc44e4e554968c9" ON "inventory_transactions" ("order_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_d6304c2e2167973c112b8a95a4" ON "inventory_transactions" ("material_id", "created_at") `);
    await queryRunner.query(`CREATE TABLE "materials" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "category" character varying(20) NOT NULL DEFAULT 'other', "unit" character varying(20) NOT NULL, "quantity" numeric(14,3) NOT NULL DEFAULT '0', "unit_cost" numeric(14,2), "min_quantity" numeric(14,3), "supplier" character varying(150), "notes" text, CONSTRAINT "CHK_983bd1630fcd930055a9cd79a9" CHECK ("quantity" >= 0), CONSTRAINT "CHK_9c6295a31240473ebd4cceadfe" CHECK ("category" IN ('fabric','thread','button','zipper','lining','interfacing','embellishment','other')), CONSTRAINT "PK_2fd1a93ecb222a28bef28663fa0" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_c2aa31036d1048343bea85a636" ON "materials" ("business_id", "category") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_materials_name_live" ON "materials" ("business_id", "name") WHERE "deleted_at" IS NULL`);
    await queryRunner.query(`CREATE TABLE "production_tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "order_id" uuid NOT NULL, "title" character varying(150) NOT NULL, "stage" character varying(20) NOT NULL DEFAULT 'other', "status" character varying(20) NOT NULL DEFAULT 'todo', "assigned_to" uuid, "due_date" date, "notes" text, "completed_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, CONSTRAINT "CHK_fa69576662a41550f91146a3c6" CHECK ("status" IN ('todo','in_progress','done','cancelled')), CONSTRAINT "CHK_c0c381a9fec11f78ab2ffb824e" CHECK ("stage" IN ('cutting','sewing','fitting','alterations','finishing','other')), CONSTRAINT "PK_2e650b46a4eb798dbb97b61973e" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_7afef967d8405beaa91fe18e7b" ON "production_tasks" ("order_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_d1137bb08dc7ee01b233c23ed4" ON "production_tasks" ("business_id", "assigned_to", "status") `);
    await queryRunner.query(`CREATE INDEX "IDX_257f2b36b310e91754720b4d25" ON "production_tasks" ("business_id", "status", "due_date") `);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_ef28e0814977f1c47575f0814c7" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_e6de3b5b8282e4b146a4b50d557" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_40dfd40d6a48aa07d46fc73d733" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_27111e3d0262799c28ca96e3368" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_23afde96676fc44e4e554968c99" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" ADD CONSTRAINT "FK_cb07ac7ca4757a197b0ce7d0712" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "materials" ADD CONSTRAINT "FK_e6e9e3fc8a2f690af84123298e3" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "production_tasks" ADD CONSTRAINT "FK_0cd42e82c7fd24d34588b1bed08" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "production_tasks" ADD CONSTRAINT "FK_7afef967d8405beaa91fe18e7b8" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "production_tasks" ADD CONSTRAINT "FK_8761433957df30d16a8c10b3744" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "production_tasks" ADD CONSTRAINT "FK_4299a19c0d633f6e35b1f4af955" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "production_tasks" DROP CONSTRAINT "FK_4299a19c0d633f6e35b1f4af955"`);
    await queryRunner.query(`ALTER TABLE "production_tasks" DROP CONSTRAINT "FK_8761433957df30d16a8c10b3744"`);
    await queryRunner.query(`ALTER TABLE "production_tasks" DROP CONSTRAINT "FK_7afef967d8405beaa91fe18e7b8"`);
    await queryRunner.query(`ALTER TABLE "production_tasks" DROP CONSTRAINT "FK_0cd42e82c7fd24d34588b1bed08"`);
    await queryRunner.query(`ALTER TABLE "materials" DROP CONSTRAINT "FK_e6e9e3fc8a2f690af84123298e3"`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_cb07ac7ca4757a197b0ce7d0712"`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_23afde96676fc44e4e554968c99"`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_27111e3d0262799c28ca96e3368"`);
    await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_40dfd40d6a48aa07d46fc73d733"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_e6de3b5b8282e4b146a4b50d557"`);
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_ef28e0814977f1c47575f0814c7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_257f2b36b310e91754720b4d25"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d1137bb08dc7ee01b233c23ed4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7afef967d8405beaa91fe18e7b"`);
    await queryRunner.query(`DROP TABLE "production_tasks"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_materials_name_live"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c2aa31036d1048343bea85a636"`);
    await queryRunner.query(`DROP TABLE "materials"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d6304c2e2167973c112b8a95a4"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_23afde96676fc44e4e554968c9"`);
    await queryRunner.query(`DROP TABLE "inventory_transactions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_19a8293adad6395dfa145a7194"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_195466747abf421f969da045f4"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
  }
}
