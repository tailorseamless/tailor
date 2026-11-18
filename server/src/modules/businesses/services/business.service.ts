import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
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
      const slug = input.slug !== undefined ? input.slug : current.slug;
      const pageEnabled = input.pageEnabled ?? current.pageEnabled;
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
      const business = await this.businesses.updateBusiness(actor.businessId, { ...input, bookingEnabled }, tx);
      if (!business) throw AppError.notFound("Business not found");
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "business.updated",
          entityType: "business",
          entityId: business.id,
          payload: { fields: Object.keys(input) },
        },
        tx,
      );
      return business;
    });
  }
}
