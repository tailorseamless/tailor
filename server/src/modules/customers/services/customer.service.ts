import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { env } from "../../../config/env";
import { randomToken, sha256 } from "../../../shared/utils/hash";
import { ActivityService } from "../../activity/services/activity.service";
import type { CustomerRecord } from "../dto/customer.dto";
import { CustomerRepository } from "../repositories/customer.repository";
import type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from "../validators/customer.schema";

export class CustomerService {
  static Instance = new CustomerService();

  private constructor(
    private readonly customers = CustomerRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  list(actor: Actor, query: ListCustomersQuery): Promise<Paginated<CustomerRecord>> {
    return this.customers.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
  }

  /** Another business's customer is a 404, never a 403: existence must not leak. */
  async detail(actor: Actor, id: string): Promise<CustomerRecord> {
    const customer = await this.customers.findInBusiness(id, actor.businessId);
    if (!customer) throw AppError.notFound("Customer not found");
    return customer;
  }

  async create(actor: Actor, input: CreateCustomerInput): Promise<CustomerRecord> {
    const { confirmDuplicate, ...fields } = input;
    return runInTransaction(async (tx) => {
      if (!confirmDuplicate) await this.assertPhoneIsNew(actor.businessId, fields.phone, undefined, tx);
      const customer = await this.customers.createCustomer(
        { ...fields, businessId: actor.businessId, createdBy: actor.id },
        tx,
      );
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "customer.created",
          entityType: "customer",
          entityId: customer.id,
        },
        tx,
      );
      return customer;
    });
  }

  async update(actor: Actor, id: string, input: UpdateCustomerInput): Promise<CustomerRecord> {
    const { confirmDuplicate, ...fields } = input;
    return runInTransaction(async (tx) => {
      const existing = await this.customers.findInBusiness(id, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Customer not found");
      if (fields.phone && fields.phone !== existing.phone && !confirmDuplicate) {
        await this.assertPhoneIsNew(actor.businessId, fields.phone, id, tx);
      }

      const customer = await this.customers.updateInBusiness(id, actor.businessId, fields, tx);
      if (!customer) throw AppError.notFound("Customer not found");
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "customer.updated",
          entityType: "customer",
          entityId: id,
          payload: { fields: Object.keys(fields) },
        },
        tx,
      );
      return customer;
    });
  }

  /**
   * A new private link to the customer's portal, shown ONCE — only its hash is
   * stored. Making a new one stops the old one working (PRD §4.7: share it by WhatsApp).
   */
  async createPortalLink(actor: Actor, id: string): Promise<{ url: string; createdAt: Date }> {
    const token = randomToken();
    await runInTransaction(async (tx) => {
      if (!(await this.customers.findInBusiness(id, actor.businessId, tx)))
        throw AppError.notFound("Customer not found");
      await this.customers.setPortalToken(id, actor.businessId, sha256(token), tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "customer.portal_link_created",
          entityType: "customer",
          entityId: id,
        },
        tx,
      );
    });
    return { url: `${env.appUrl}/portal/${token}`, createdAt: new Date() };
  }

  async revokePortalLink(actor: Actor, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      if (!(await this.customers.findInBusiness(id, actor.businessId, tx)))
        throw AppError.notFound("Customer not found");
      await this.customers.setPortalToken(id, actor.businessId, null, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "customer.portal_link_revoked",
          entityType: "customer",
          entityId: id,
        },
        tx,
      );
    });
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      const existing = await this.customers.findInBusiness(id, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Customer not found");
      await this.customers.removeInBusiness(id, actor.businessId, tx);
      await this.customers.setPortalToken(id, actor.businessId, null, tx); // a deleted customer's link stops working
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "customer.deleted",
          entityType: "customer",
          entityId: id,
        },
        tx,
      );
    });
  }

  /** Flags a likely duplicate; the client may resend with `confirmDuplicate: true`. */
  private async assertPhoneIsNew(businessId: string, phone: string, exceptId: string | undefined, tx: Tx) {
    const match = await this.customers.findByPhone(businessId, phone, exceptId, tx);
    if (!match) return;
    throw AppError.conflict("A customer with this phone number already exists", [
      { field: "phone", message: "duplicate", customerId: match.id, customerName: match.fullName },
    ]);
  }
}
