import type { ImageRecord } from "../../media/dto/media.dto";

/** `private`: staff only. `customers`: also shown in the customer portal (PRD §4.5). */
export const DESIGN_VISIBILITIES = ["private", "customers"] as const;
export type DesignVisibility = (typeof DESIGN_VISIBILITIES)[number];

export const DESIGN_LIMITS = {
  /** The most a price may be, as for an order line. */
  maxPrice: 999_999_999,
} as const;

/** A style in the business's catalogue — to show customers and to attach to an order. */
export interface DesignRecord {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  /** Garment category, the business's own words: "Agbada", "Wedding gown"… */
  category: string | null;
  /** The usual price range, shown to customers. Either end may be left out ("from …", "up to …"). */
  priceMin: number | null;
  priceMax: number | null;
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

/** What the customer portal and the public page show of a design. */
export interface PublicDesignDTO {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceMin: number | null;
  priceMax: number | null;
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
