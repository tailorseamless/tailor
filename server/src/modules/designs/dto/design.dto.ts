import type { ImageRecord } from "../../media/dto/media.dto";

/** `private`: staff only. `customers`: also shown in the customer portal (PRD §4.5). */
export const DESIGN_VISIBILITIES = ["private", "customers"] as const;
export type DesignVisibility = (typeof DESIGN_VISIBILITIES)[number];

/** A style in the business's catalogue — to show customers and to attach to an order. */
export interface DesignRecord {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  /** Garment category, the business's own words: "Agbada", "Wedding gown"… */
  category: string | null;
  visibility: DesignVisibility;
  /** A popular design, pinned to the top. */
  isFavourite: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignDTO extends DesignRecord {
  images: ImageRecord[];
  /** The first picture, for a card. */
  coverUrl: string | null;
}

/** What the customer portal shows of a design. */
export interface PublicDesignDTO {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  images: { url: string; width: number | null; height: number | null }[];
}

export interface ListDesignsParams {
  businessId: string;
  page: number;
  limit: number;
  category?: string;
  visibility?: DesignVisibility;
  favourite?: boolean;
  search?: string;
}
