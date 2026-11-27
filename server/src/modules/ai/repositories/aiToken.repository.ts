import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { buildMeta, getOffset, type Paginated } from "../../../shared/pagination/paginate";
import { likePattern, returnedRows } from "../../../shared/repositories/baseRepository";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import { MAX_TOKEN_BALANCE, type AiUsageFeature } from "../domain/aiFeatures";
import type { AiTokenBalanceDTO } from "../dto/ai.dto";
import { AiTokenTransaction, type AiTokenType } from "../entities/aiTokenTransaction.entity";

interface LedgerEntry {
  businessId: string;
  type: AiTokenType;
  amount: number;
  balanceAfter: number;
  feature?: AiUsageFeature | null;
  note?: string | null;
  actorId?: string | null;
}

/**
 * Token balances. Every change to `balance` is ONE statement that locks the row, so concurrent requests can't
 * spend the same tokens or take a balance below zero. Changes that matter are written to the ledger in the
 * same transaction.
 */
export class AiTokenRepository {
  static Instance = new AiTokenRepository();

  private constructor() {}

  /** The account, created with the starting amount if this is the first time. */
  private async ensure(businessId: string, startingTokens: number, tx: Tx): Promise<void> {
    const inserted = (await tx.query(
      `INSERT INTO ai_token_accounts (business_id, balance, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (business_id) DO NOTHING RETURNING balance`,
      [businessId, startingTokens],
    )) as unknown[];
    if (inserted.length && startingTokens > 0) {
      await this.append({ businessId, type: "starting", amount: startingTokens, balanceAfter: startingTokens }, tx);
    }
  }

  private async append(entry: LedgerEntry, tx: Tx): Promise<void> {
    await tx.getRepository(AiTokenTransaction).insert(entry);
  }

  /** What the business has now (the starting amount if it has never spent or been given any). */
  async balance(businessId: string, startingTokens: number): Promise<number> {
    const [row] = await AppDataSource.query(`SELECT balance FROM ai_token_accounts WHERE business_id = $1`, [
      businessId,
    ]);
    return row ? Number(row.balance) : startingTokens;
  }

  /** Sets aside up to `hold` tokens before a request. The amount set aside, or null when there are none. */
  async reserve(businessId: string, startingTokens: number, hold: number): Promise<number | null> {
    return runInTransaction(async (tx) => {
      await this.ensure(businessId, startingTokens, tx);
      const rows = returnedRows<{ held: number }>(
        await tx.query(
          `WITH account AS (SELECT business_id, balance FROM ai_token_accounts WHERE business_id = $1 FOR UPDATE)
           UPDATE ai_token_accounts t SET balance = t.balance - LEAST(account.balance, $2::int), updated_at = now()
             FROM account WHERE t.business_id = account.business_id AND account.balance > 0
           RETURNING LEAST(account.balance, $2::int) AS held`,
          [businessId, hold],
        ),
      );
      return rows.length ? Number(rows[0].held) : null;
    });
  }

  /** The request produced nothing usable: what was set aside goes back. */
  async release(businessId: string, held: number): Promise<void> {
    await AppDataSource.query(
      `UPDATE ai_token_accounts SET balance = LEAST(balance::bigint + $2, $3)::int, updated_at = now()
        WHERE business_id = $1`,
      [businessId, held, MAX_TOKEN_BALANCE],
    );
  }

  /**
   * Gives back what was set aside and takes what was really used (never below zero), with one ledger line.
   * Returns what was actually taken and what is left.
   */
  async settle(
    businessId: string,
    held: number,
    used: number,
    entry: { feature: AiUsageFeature; actorId: string },
  ): Promise<{ charged: number; balance: number }> {
    return runInTransaction(async (tx) => {
      const rows = returnedRows<{ before: number; balance: number }>(
        await tx.query(
          `WITH account AS (SELECT business_id, balance FROM ai_token_accounts WHERE business_id = $1 FOR UPDATE)
           UPDATE ai_token_accounts t
              SET balance = GREATEST(account.balance::bigint + $2 - $3, 0)::int, updated_at = now()
             FROM account WHERE t.business_id = account.business_id
           RETURNING account.balance AS before, t.balance AS balance`,
          [businessId, held, used],
        ),
      );
      const row = rows[0];
      if (!row) return { charged: 0, balance: 0 };
      const charged = Number(row.before) + held - Number(row.balance);
      await this.append(
        { businessId, type: "usage", amount: -charged, balanceAfter: Number(row.balance), ...entry },
        tx,
      );
      return { charged, balance: Number(row.balance) };
    });
  }

  /**
   * The admin adds (or, with a negative amount, takes back) tokens. Null when taking more than the business has.
   * Run inside the caller's transaction.
   */
  async grant(
    businessId: string,
    startingTokens: number,
    amount: number,
    note: string | null,
    actorId: string,
    tx: Tx,
  ): Promise<number | null> {
    await this.ensure(businessId, startingTokens, tx);
    const rows = returnedRows<{ balance: number }>(
      await tx.query(
        `UPDATE ai_token_accounts SET balance = LEAST(balance::bigint + $2, $3)::int, updated_at = now()
          WHERE business_id = $1 AND balance::bigint + $2 >= 0 RETURNING balance`,
        [businessId, amount, MAX_TOKEN_BALANCE],
      ),
    );
    if (!rows.length) return null;
    const balance = Number(rows[0].balance);
    await this.append(
      { businessId, type: amount > 0 ? "grant" : "adjustment", amount, balanceAfter: balance, note, actorId },
      tx,
    );
    return balance;
  }

  /** Every live business with what it has left, fewest first. */
  async balances(params: {
    startingTokens: number;
    search?: string;
    page: number;
    limit: number;
  }): Promise<Paginated<AiTokenBalanceDTO>> {
    const term = params.search ? likePattern(params.search) : null;
    const rows: { id: string; name: string; tokens: string; started: boolean; used: string }[] =
      await AppDataSource.query(
        `SELECT b.id, b.name, COALESCE(a.balance, $1::int) AS tokens, a.business_id IS NOT NULL AS started,
                COALESCE((SELECT -SUM(t.amount) FROM ai_token_transactions t
                           WHERE t.business_id = b.id AND t.type = 'usage'
                             AND t.created_at > now() - interval '30 days'), 0) AS used
           FROM businesses b LEFT JOIN ai_token_accounts a ON a.business_id = b.id
          WHERE b.deleted_at IS NULL AND ($2::text IS NULL OR b.name ILIKE $2)
          ORDER BY tokens ASC, b.name ASC, b.id
          LIMIT $3 OFFSET $4`,
        [params.startingTokens, term, params.limit, getOffset(params.page, params.limit)],
      );
    const [{ total }] = await AppDataSource.query(
      `SELECT COUNT(*) AS total FROM businesses b WHERE b.deleted_at IS NULL AND ($1::text IS NULL OR b.name ILIKE $1)`,
      [term],
    );
    return {
      data: rows.map((row) => ({
        businessId: row.id,
        name: row.name,
        tokens: Number(row.tokens),
        started: row.started,
        usedLast30Days: Number(row.used),
      })),
      meta: buildMeta(params.page, params.limit, Number(total), rows.length),
    };
  }

  /** Businesses that have run out. */
  async countEmpty(): Promise<number> {
    const [row] = await AppDataSource.query(
      `SELECT COUNT(*) AS n FROM ai_token_accounts a JOIN businesses b ON b.id = a.business_id
        WHERE a.balance = 0 AND b.deleted_at IS NULL`,
    );
    return Number(row?.n ?? 0);
  }

  async businessExists(businessId: string, tx: Tx): Promise<boolean> {
    const [row] = await tx.query(`SELECT 1 AS found FROM businesses WHERE id = $1 AND deleted_at IS NULL`, [
      businessId,
    ]);
    return Boolean(row);
  }
}
