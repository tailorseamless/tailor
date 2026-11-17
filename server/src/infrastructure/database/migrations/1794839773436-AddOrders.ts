import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrders1794839773436 implements MigrationInterface {
  name = "AddOrders1794839773436";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "business_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "order_number" character varying(30) NOT NULL, "status" character varying(30) NOT NULL DEFAULT 'confirmed', "due_date" date, "total_amount" numeric(14,2) NOT NULL, "currency" character varying(3) NOT NULL, "notes" text, "created_by" uuid, "delivered_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_2fe235fb102ba1b61fc731f97f" CHECK ("total_amount" >= 0), CONSTRAINT "CHK_3727339cc946afdd9071dbeb1c" CHECK ("status" IN ('confirmed','awaiting_materials','cutting','sewing','fitting','alterations','finishing','ready','delivered','cancelled')), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_0a82e4d83e72b720991bb379e5" ON "orders" ("business_id", "customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_d4d81518a00a1c5c4bbeb9e7c5" ON "orders" ("business_id", "due_date") `);
    await queryRunner.query(`CREATE INDEX "IDX_c680815eee35a8cf16ea7220e5" ON "orders" ("business_id", "status") `);
    await queryRunner.query(`CREATE INDEX "IDX_f17e5e8e4b88d4f2dcf3d75b88" ON "orders" ("business_id", "created_at") `);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_orders_number" ON "orders" ("business_id", "order_number") `);
    await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "order_id" uuid NOT NULL, "garment_name" character varying(150) NOT NULL, "description" text, "quantity" integer NOT NULL DEFAULT '1', "unit_price" numeric(14,2) NOT NULL, "fabric_source" character varying(10) NOT NULL DEFAULT 'customer', "measurement_id" uuid, "position" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_6529c4e11751c6c82d87163366" CHECK ("fabric_source" IN ('customer','business')), CONSTRAINT "CHK_46bd93eb22f1b9e485817fa953" CHECK ("unit_price" >= 0), CONSTRAINT "CHK_6e5d794f7711186091b3156024" CHECK ("quantity" > 0), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_ada7296174202972b275e3fca8" ON "order_items" ("measurement_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_97a28aea50c08a60afa644ddf1" ON "order_items" ("order_id", "position") `);
    await queryRunner.query(`CREATE TABLE "order_status_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "from_status" character varying(30), "to_status" character varying(30) NOT NULL, "note" text, "changed_by" uuid, CONSTRAINT "PK_e6c66d853f155531985fc4f6ec8" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_8377877e87cbd809d0803a8975" ON "order_status_history" ("order_id", "created_at") `);
    await queryRunner.query(`ALTER TABLE "businesses" ADD "order_seq" integer NOT NULL DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_0e78f67403faf37092dce90d73a" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_574a2f0932043d4e4baf188ee05" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_ada7296174202972b275e3fca8d" FOREIGN KEY ("measurement_id") REFERENCES "customer_measurements"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_status_history" ADD CONSTRAINT "FK_1ca7d5228cf9dc589b60243933c" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "order_status_history" ADD CONSTRAINT "FK_de5bb51ff61072261b6b3419f83" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_status_history" DROP CONSTRAINT "FK_de5bb51ff61072261b6b3419f83"`);
    await queryRunner.query(`ALTER TABLE "order_status_history" DROP CONSTRAINT "FK_1ca7d5228cf9dc589b60243933c"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_ada7296174202972b275e3fca8d"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_574a2f0932043d4e4baf188ee05"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_0e78f67403faf37092dce90d73a"`);
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "order_seq"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_8377877e87cbd809d0803a8975"`);
    await queryRunner.query(`DROP TABLE "order_status_history"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_97a28aea50c08a60afa644ddf1"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ada7296174202972b275e3fca8"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_orders_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f17e5e8e4b88d4f2dcf3d75b88"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c680815eee35a8cf16ea7220e5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d4d81518a00a1c5c4bbeb9e7c5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_0a82e4d83e72b720991bb379e5"`);
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
