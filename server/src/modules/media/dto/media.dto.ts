/** What an image belongs to. The caller has already checked it is the actor's business's. */
export type ImageTarget = { kind: "order"; id: string } | { kind: "design"; id: string };

export interface ImageRecord {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string | null;
  originalName: string;
  position: number;
  createdAt: Date;
}

/** A file as the upload middleware hands it over. */
export interface IncomingFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}
