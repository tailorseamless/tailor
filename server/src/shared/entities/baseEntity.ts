import {
  CreateDateColumn,
  DeleteDateColumn,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type ValueTransformer,
} from "typeorm";

/**
 * Soft-deletable base for user content (Backend Guide §9.2).
 * Every @Column in an entity states its `type`: tsx does not emit decorator metadata.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt: Date | null;
}

/** Append-only tables (audit log, ledgers): never updated, never soft-deleted. */
export abstract class AppendOnlyEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

type OnDelete = "RESTRICT" | "CASCADE" | "SET NULL";

/**
 * An explicit foreign key that names its target BY CLASS NAME, so entity files
 * never import each other. Put it on a placeholder property next to the id column:
 *
 *   @Column({ name: "business_id", type: "uuid" }) businessId: string;
 *   @ForeignKey("Business", "business_id") business?: unknown;
 */
export function ForeignKey(target: string, column: string, onDelete: OnDelete = "RESTRICT"): PropertyDecorator {
  return (object, propertyKey) => {
    ManyToOne(target, { onDelete })(object, propertyKey);
    JoinColumn({ name: column })(object, propertyKey);
  };
}

/** pg returns `numeric` as a string; money and quantities must be numbers in code. */
export const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value)),
};
