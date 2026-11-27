import type { AiProviderId } from "../../../infrastructure/ai/aiProvider";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { AiFeature } from "../domain/aiFeatures";
import { AiCredential } from "../entities/aiCredential.entity";

/** At most four rows (one per provider), so plain lists need no paging. */
export class AiCredentialRepository extends BaseRepository<AiCredential> {
  static Instance = new AiCredentialRepository();

  private constructor() {
    super(AiCredential);
  }

  list(tx?: Tx): Promise<AiCredential[]> {
    return this.repo(tx).find({ order: { isActive: "DESC", provider: "ASC" } });
  }

  findByProvider(provider: AiProviderId, tx?: Tx): Promise<AiCredential | null> {
    return this.repo(tx).findOne({ where: { provider } });
  }

  findActive(tx?: Tx): Promise<AiCredential | null> {
    return this.repo(tx).findOne({ where: { isActive: true } });
  }

  /** The key a feature is pinned to, if any. */
  findPinned(feature: AiFeature, tx?: Tx): Promise<AiCredential | null> {
    return this.repo(tx)
      .createQueryBuilder("c")
      .where("c.feature_models ->> :feature IS NOT NULL", { feature })
      .getOne();
  }

  save(row: Partial<AiCredential>, tx?: Tx): Promise<AiCredential> {
    const repo = this.repo(tx);
    return repo.save(repo.create(row));
  }

  /** Only one key may be in use: clear the flag first, then set it, in the caller's transaction. */
  async makeActive(provider: AiProviderId, updatedBy: string, tx: Tx): Promise<void> {
    await this.repo(tx).update({ isActive: true }, { isActive: false });
    await this.repo(tx).update({ provider }, { isActive: true, updatedBy });
  }

  async remove(provider: AiProviderId, tx?: Tx): Promise<void> {
    await this.repo(tx).delete({ provider });
  }

  /** A feature belongs to at most one key: take it off all of them. */
  async unpin(feature: AiFeature, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE ai_credentials SET feature_models = feature_models - $1::text WHERE feature_models ? $1::text`,
      [feature],
    );
  }

  async pin(provider: AiProviderId, feature: AiFeature, model: string, updatedBy: string, tx: Tx): Promise<void> {
    await tx.query(
      `UPDATE ai_credentials SET feature_models = feature_models || jsonb_build_object($2::text, $3::text),
              updated_by = $4, updated_at = now()
        WHERE provider = $1`,
      [provider, feature, model, updatedBy],
    );
  }
}
