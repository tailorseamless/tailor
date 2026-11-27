import { AppDataSource } from "../../../infrastructure/database/dataSource";
import type { Tx } from "../../../shared/repositories/transaction";
import { DEFAULT_STARTING_TOKENS } from "../domain/aiFeatures";
import { AiSettings } from "../entities/aiSettings.entity";

/** The single settings row. The migration creates it; this recreates it if it is ever missing. */
export class AiSettingsRepository {
  static Instance = new AiSettingsRepository();

  private constructor() {}

  async get(): Promise<AiSettings> {
    const repo = AppDataSource.getRepository(AiSettings);
    const row = await repo.findOne({ where: { id: 1 } });
    if (row) return row;
    await AppDataSource.query(
      `INSERT INTO ai_settings (id, starting_tokens) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_STARTING_TOKENS],
    );
    return repo.findOneOrFail({ where: { id: 1 } });
  }

  /** The amount before the change (for the audit entry). Run inside the caller's transaction. */
  async update(startingTokens: number, updatedBy: string, tx: Tx): Promise<number> {
    const before = await this.get();
    await tx.getRepository(AiSettings).update({ id: 1 }, { startingTokens, updatedBy });
    return before.startingTokens;
  }
}
