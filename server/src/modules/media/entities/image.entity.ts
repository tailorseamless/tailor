import { Check, Column, Entity, Index } from "typeorm";
import { BaseEntity, ForeignKey } from "../../../shared/entities/baseEntity";

/**
 * A picture in Cloudinary: an order's reference picture or a catalogue
 * design's photo — exactly one of the two. URL and public id are always kept
 * together (Backend Guide §20.9); the public id is never sent to clients.
 */
@Entity("images")
@Index(["orderId", "position"])
@Index(["designId", "position"])
@Index("UQ_images_public_id", ["publicId"], { unique: true })
@Check(`num_nonnulls("order_id", "design_id") = 1`)
export class Image extends BaseEntity {
  @Column({ name: "business_id", type: "uuid" })
  businessId: string;

  @ForeignKey("Business", "business_id", "CASCADE")
  business?: unknown;

  @Column({ name: "order_id", type: "uuid", nullable: true })
  orderId: string | null;

  @ForeignKey("Order", "order_id", "CASCADE")
  order?: unknown;

  @Column({ name: "design_id", type: "uuid", nullable: true })
  designId: string | null;

  @ForeignKey("Design", "design_id", "CASCADE")
  design?: unknown;

  @Column({ type: "varchar", length: 500 })
  url: string;

  /** For deleting the asset. Never sent to clients. */
  @Column({ name: "public_id", type: "varchar", length: 255, select: false })
  publicId: string;

  @Column({ type: "integer", nullable: true })
  width: number | null;

  @Column({ type: "integer", nullable: true })
  height: number | null;

  @Column({ type: "integer" })
  bytes: number;

  @Column({ type: "varchar", length: 10, nullable: true })
  format: string | null;

  @Column({ name: "original_name", type: "varchar", length: 255 })
  originalName: string;

  @Column({ type: "integer", default: 0 })
  position: number;

  @Column({ name: "uploaded_by", type: "uuid", nullable: true })
  uploadedBy: string | null;

  @ForeignKey("User", "uploaded_by", "SET NULL")
  uploader?: unknown;
}
