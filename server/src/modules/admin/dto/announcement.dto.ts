export const ANNOUNCEMENT_AUDIENCES = ["owners", "everyone"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export type AnnouncementStatus = "queued" | "sending" | "sent" | "cancelled";

export interface AnnouncementDTO {
  id: string;
  createdAt: Date;
  title: string;
  body: string;
  linkPath: string | null;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  businessesReached: number;
  recipients: number;
  sentAt: Date | null;
  author: { id: string; fullName: string } | null;
}

export interface NewAnnouncementInput {
  title: string;
  body: string;
  linkPath?: string | null;
  audience: AnnouncementAudience;
}
