import type {
  DeepPartial,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { AppDataSource } from "../../infrastructure/database/dataSource";
import { buildMeta, getOffset, type Paginated } from "../pagination/paginate";
import type { Tx } from "./transaction";

/**
 * Base for every repository (Backend Guide §8.1). Repositories are the only
 * layer that touches entities and SQL; every method takes an optional `tx`.
 */
export abstract class BaseRepository<T extends ObjectLiteral & { id: string }> {
  protected constructor(private readonly entity: EntityTarget<T>) {}

  /** Repository bound to the transaction when one is given. */
  protected repo(tx?: Tx): Repository<T> {
    return tx ? tx.getRepository(this.entity) : AppDataSource.getRepository(this.entity);
  }

  findById(id: string, tx?: Tx): Promise<T | null> {
    return this.repo(tx).findOne({ where: { id } as FindOptionsWhere<T> });
  }

  create(data: Partial<T>, tx?: Tx): Promise<T> {
    const repo = this.repo(tx);
    return repo.save(repo.create(data as DeepPartial<T>));
  }

  async update(id: string, data: Partial<T>, tx?: Tx): Promise<T | null> {
    await this.repo(tx).update(id, data as QueryDeepPartialEntity<T>);
    return this.findById(id, tx);
  }

  async softDelete(id: string, tx?: Tx): Promise<void> {
    await this.repo(tx).softDelete(id);
  }

  /** Offset pagination; COUNT only on page 1 (Backend Guide §11.1). */
  protected async paginate<E extends ObjectLiteral>(
    qb: SelectQueryBuilder<E>,
    page: number,
    limit: number,
  ): Promise<Paginated<E>> {
    const data = await qb.clone().offset(getOffset(page, limit)).limit(limit).getMany();
    return { data, meta: buildMeta(page, limit, await this.total(qb, page, limit, data.length), data.length) };
  }

  /** As `paginate`, for raw (non-entity) selects. */
  protected async paginateRaw<R, E extends ObjectLiteral = ObjectLiteral>(
    qb: SelectQueryBuilder<E>,
    page: number,
    limit: number,
  ): Promise<Paginated<R>> {
    const data = await qb.clone().offset(getOffset(page, limit)).limit(limit).getRawMany<R>();
    return { data, meta: buildMeta(page, limit, await this.total(qb, page, limit, data.length), data.length) };
  }

  private total<E extends ObjectLiteral>(
    qb: SelectQueryBuilder<E>,
    page: number,
    limit: number,
    count: number,
  ): Promise<number> {
    if (page !== 1) return Promise.resolve(0);
    // A short first page is the whole result: no COUNT needed.
    if (count < limit) return Promise.resolve(count);
    return qb.clone().getCount();
  }
}

/**
 * Rows from a raw `… RETURNING` statement. The pg driver answers
 * `[rows, affectedCount]` for UPDATE/DELETE and plain `rows` for INSERT.
 */
export function returnedRows<R>(result: unknown): R[] {
  if (!Array.isArray(result)) return [];
  return (Array.isArray(result[0]) ? result[0] : result) as R[];
}

/** Escapes LIKE/ILIKE wildcards in user search input. Always use it for search terms. */
export function likePattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

/** The term with its wildcards escaped and none added: `ILIKE` then means "equal, ignoring case". */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
