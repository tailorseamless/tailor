import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../infrastructure/database/dataSource";

/** The opaque transaction handle services pass down to repositories (Backend Guide §8.4). */
export type Tx = EntityManager;

/** Runs `work` in one transaction: everything given `tx` commits or rolls back together. */
export function runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return AppDataSource.transaction(work);
}

/** Joins the caller's transaction, or opens one. */
export function withTx<T>(tx: Tx | undefined, work: (tx: Tx) => Promise<T>): Promise<T> {
  return tx ? work(tx) : runInTransaction(work);
}
