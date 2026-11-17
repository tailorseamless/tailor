import { In } from "typeorm";
import { UPLOAD_LIMITS } from "../../../config/constants";
import { BaseRepository } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { UploadedImage } from "../../../shared/services/storage.service";
import type { ImageRecord, ImageTarget } from "../dto/media.dto";
import { Image } from "../entities/image.entity";

function toRecord(row: Image): ImageRecord {
  return {
    id: row.id,
    url: row.url,
    width: row.width ?? null,
    height: row.height ?? null,
    bytes: row.bytes,
    format: row.format ?? null,
    originalName: row.originalName,
    position: row.position,
    createdAt: row.createdAt,
  };
}

const column = (target: ImageTarget) => (target.kind === "order" ? "orderId" : "designId");

export class ImageRepository extends BaseRepository<Image> {
  static Instance = new ImageRepository();

  private constructor() {
    super(Image);
  }

  /** In display order. Indexes: images(order_id | design_id, position). Bounded by imagesPerItem. */
  async listFor(target: ImageTarget, tx?: Tx): Promise<ImageRecord[]> {
    const rows = await this.repo(tx).find({
      where: { [column(target)]: target.id },
      order: { position: "ASC", createdAt: "ASC" },
      take: UPLOAD_LIMITS.imagesPerItem,
    });
    return rows.map(toRecord);
  }

  /** Images of many designs at once, for a list page (no N+1). */
  async listForDesigns(designIds: string[]): Promise<Map<string, ImageRecord[]>> {
    const byDesign = new Map<string, ImageRecord[]>();
    if (designIds.length === 0) return byDesign;
    // Bounded: one page of designs × imagesPerItem.
    const rows = await this.repo().find({
      where: { designId: In(designIds) },
      order: { position: "ASC", createdAt: "ASC" },
      take: designIds.length * UPLOAD_LIMITS.imagesPerItem,
    });
    for (const row of rows) {
      const list = byDesign.get(row.designId!) ?? [];
      list.push(toRecord(row));
      byDesign.set(row.designId!, list);
    }
    return byDesign;
  }

  countFor(target: ImageTarget, tx?: Tx): Promise<number> {
    return this.repo(tx).count({ where: { [column(target)]: target.id } });
  }

  async insertMany(
    businessId: string,
    target: ImageTarget,
    uploaded: { image: UploadedImage; originalName: string }[],
    startPosition: number,
    uploadedBy: string,
    tx: Tx,
  ): Promise<void> {
    await this.repo(tx).insert(
      uploaded.map(({ image, originalName }, index) => ({
        businessId,
        orderId: target.kind === "order" ? target.id : null,
        designId: target.kind === "design" ? target.id : null,
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        format: image.format,
        originalName,
        position: startPosition + index,
        uploadedBy,
      })),
    );
  }

  /** The image with its public id, only if it belongs to this target. */
  async findForTarget(id: string, target: ImageTarget, tx?: Tx): Promise<{ id: string; publicId: string } | null> {
    const row = await this.repo(tx)
      .createQueryBuilder("i")
      .addSelect("i.publicId")
      .where("i.id = :id", { id })
      .andWhere(`i.${column(target)} = :targetId`, { targetId: target.id })
      .getOne();
    return row ? { id: row.id, publicId: row.publicId } : null;
  }

  async remove(id: string, tx: Tx): Promise<void> {
    await this.repo(tx).softDelete(id);
  }
}
