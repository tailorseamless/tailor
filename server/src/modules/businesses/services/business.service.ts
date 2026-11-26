import { randomBytes } from "node:crypto";
import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { isReservedSlug, slugFromName } from "../domain/shopAddress";
import type { BusinessRecord } from "../dto/business.dto";
import { BusinessRepository } from "../repositories/business.repository";
import type { UpdateBusinessInput } from "../validators/business.schema";

export class BusinessService {
  static Instance = new BusinessService();

  private constructor(
    private readonly businesses = BusinessRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  /** The caller's own business — the id always comes from the Actor, never from the client. */
  async mine(actor: Actor): Promise<BusinessRecord> {
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");
    return business;
  }

  async update(actor: Actor, input: UpdateBusinessInput): Promise<BusinessRecord> {
    return runInTransaction(async (tx) => {
      const current = await this.businesses.findBusiness(actor.businessId, tx);
      if (!current) throw AppError.notFound("Business not found");
      if (input.slug) {
        const owner = await this.businesses.findBySlug(input.slug, tx);
        if (owner && owner.id !== actor.businessId) {
          throw AppError.conflict("This booking page address is taken", [{ field: "slug", message: "duplicate" }]);
        }
      }
      const pageEnabled = input.pageEnabled ?? current.pageEnabled;
      // Publishing for the first time without choosing an address: choose one for them.
      const assigned =
        pageEnabled && !input.slug && !current.slug ? await this.freeSlug(input.name ?? current.name, tx) : null;
      const changes = assigned ? { ...input, slug: assigned } : input;
      const slug = changes.slug !== undefined ? changes.slug : current.slug;
      // Taking the page down takes its booking form with it, unless the same request says otherwise.
      const bookingEnabled = input.bookingEnabled ?? (pageEnabled ? current.bookingEnabled : false);
      if (pageEnabled && !slug) {
        throw AppError.unprocessable("Choose an address for your page first", [{ field: "slug", message: "Required" }]);
      }
      if (bookingEnabled && !pageEnabled) {
        throw AppError.unprocessable("Publish your page before taking bookings on it", [
          { field: "bookingEnabled", message: "Publish the page first" },
        ]);
      }
      // A bank without an account number, or a number without the name on it, is no use to a customer paying in.
      const account = {
        bankName: input.bankName !== undefined ? input.bankName : current.bankName,
        accountNumber: input.accountNumber !== undefined ? input.accountNumber : current.accountNumber,
        accountName: input.accountName !== undefined ? input.accountName : current.accountName,
      };
      const missing = (Object.keys(account) as (keyof typeof account)[]).filter((field) => !account[field]);
      if (missing.length > 0 && missing.length < 3) {
        throw AppError.unprocessable(
          "Add the bank name, account number and account name together, or clear all three",
          missing.map((field) => ({ field, message: "Required" })),
        );
      }
      const business = await this.businesses.updateBusiness(actor.businessId, { ...changes, bookingEnabled }, tx);
      if (!business) throw AppError.notFound("Business not found");
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "business.updated",
          entityType: "business",
          entityId: business.id,
          payload: { fields: Object.keys(changes) },
        },
        tx,
      );
      return business;
    });
  }

  /**
   * Switches a business's page on for the platform admin, choosing an address if it never had one. False when it
   * was already on. The caller checks who may do this and writes the audit entry.
   */
  async publishPageFor(businessId: string, tx: Tx): Promise<boolean> {
    const current = await this.businesses.findBusiness(businessId, tx);
    if (!current) throw AppError.notFound("Business not found");
    if (current.pageEnabled) return false;
    const slug = current.slug ?? (await this.freeSlug(current.name, tx));
    await this.businesses.updateBusiness(businessId, { pageEnabled: true, slug }, tx);
    return true;
  }

  /** As `publishPageFor`, for appointment requests, which need the page to be on. False when already on. */
  async openBookingFor(businessId: string, tx: Tx): Promise<boolean> {
    const current = await this.businesses.findBusiness(businessId, tx);
    if (!current) throw AppError.notFound("Business not found");
    if (current.bookingEnabled) return false;
    if (!current.pageEnabled) throw AppError.unprocessable("Switch their public page on first");
    await this.businesses.updateBusiness(businessId, { bookingEnabled: true }, tx);
    return true;
  }

  /** The name as an address, then "-2" to "-5"; a random ending if those are all taken. */
  private async freeSlug(name: string, tx: Tx): Promise<string> {
    const base = slugFromName(name) ?? "shop";
    for (const candidate of [base, ...[2, 3, 4, 5].map((n) => `${base}-${n}`)]) {
      if (isReservedSlug(candidate)) continue;
      if (!(await this.businesses.findBySlug(candidate, tx))) return candidate;
    }
    return `${base}-${randomBytes(3).toString("hex")}`;
  }
}
