import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey, numericTransformer } from "../../../shared/entities/baseEntity";
import type { PaymentMethod } from "../../payments/dto/payment.dto";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "../dto/expense.dto";

@Entity("expenses")
@Index(["businessId", "spentOn"]) // by date, and the period totals
@Index(["businessId", "category"])
@Index(["businessId", "branchId", "spentOn"]) // one branch's spending
@Check(`"category" IN (${EXPENSE_CATEGORIES.map((value) => `'${value}'`).join(",")})`)
@Check(`"method" IN ('cash','bank_transfer','pos','other')`)
@Check(`"amount" > 0`)
export class Expense extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  /** NULL = the business as a whole. */
  @Column({ name: "branch_id", type: "uuid", nullable: true })
  branchId: string | null;

  @ForeignKey("Branch", "branch_id", "RESTRICT")
  branch?: unknown;

  @Column({ type: "varchar", length: 20 })
  category: ExpenseCategory;

  @Column({ type: "numeric", precision: 14, scale: 2, transformer: numericTransformer })
  amount: number;

  @Column({ name: "spent_on", type: "date" })
  spentOn: string;

  @Column({ type: "varchar", length: 300 })
  description: string;

  @Column({ type: "varchar", length: 20, default: "cash" })
  method: PaymentMethod;

  @Column({ type: "varchar", length: 100, nullable: true })
  reference: string | null;

  @Column({ name: "recorded_by", type: "uuid", nullable: true })
  recordedBy: string | null;

  @ForeignKey("User", "recorded_by", "SET NULL")
  recorder?: unknown;
}
