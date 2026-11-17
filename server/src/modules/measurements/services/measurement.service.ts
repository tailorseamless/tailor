import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import { localDay } from "../../../shared/utils/timezone";
import { ActivityService } from "../../activity/services/activity.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { CustomerRepository } from "../../customers/repositories/customer.repository";
import { resolveValues } from "../domain/measurementValues";
import type { CustomerMeasurementRecord } from "../dto/measurement.dto";
import { CustomerMeasurementRepository } from "../repositories/customerMeasurement.repository";
import { TemplateRepository } from "../repositories/template.repository";
import type { CreateMeasurementInput, ListMeasurementsQuery } from "../validators/measurement.schema";

export class MeasurementService {
  static Instance = new MeasurementService();

  private constructor(
    private readonly measurements = CustomerMeasurementRepository.Instance,
    private readonly templates = TemplateRepository.Instance,
    private readonly customers = CustomerRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  /** The customer's measurement history, newest first (PRD US-016). */
  async list(
    actor: Actor,
    customerId: string,
    query: ListMeasurementsQuery,
  ): Promise<Paginated<CustomerMeasurementRecord>> {
    await this.assertCustomer(actor, customerId);
    return this.measurements.listForCustomer({ ...query, customerId, businessId: actor.businessId });
  }

  async detail(actor: Actor, customerId: string, id: string): Promise<CustomerMeasurementRecord> {
    const measurement = await this.measurements.findForCustomer(id, customerId, actor.businessId);
    if (!measurement) throw AppError.notFound("Measurement not found");
    return measurement;
  }

  /**
   * Always a NEW record — earlier measurements are never overwritten
   * (PRD US-013, US-015, BR-006).
   */
  async record(actor: Actor, customerId: string, input: CreateMeasurementInput): Promise<CustomerMeasurementRecord> {
    return runInTransaction(async (tx) => {
      await this.assertCustomer(actor, customerId, tx);

      const template = input.templateId
        ? await this.templates.findInBusiness(input.templateId, actor.businessId, tx)
        : null;
      if (input.templateId && !template) {
        throw AppError.unprocessable("Choose a template that exists", [{ field: "templateId", message: "Not found" }]);
      }

      const { values, missing } = resolveValues(template?.fields ?? [], input.values);
      if (missing.length > 0) {
        throw AppError.unprocessable(
          "Some required measurements are missing",
          missing.map((name) => ({ field: "values", message: `${name} is required` })),
        );
      }

      const measurement = await this.measurements.createMeasurement(
        {
          businessId: actor.businessId,
          customerId,
          templateId: template?.id ?? null,
          templateName: template?.name ?? null,
          unit: input.unit ?? (await this.defaultUnit(actor, tx)),
          measuredOn: input.measuredOn ?? localDay(new Date(), actor.timeZone),
          notes: input.notes ?? null,
          values,
          recordedBy: actor.id,
        },
        tx,
      );
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "measurement.recorded",
          entityType: "customer_measurement",
          entityId: measurement.id,
          payload: { customerId, templateId: measurement.templateId },
        },
        tx,
      );
      return measurement;
    });
  }

  /** For a record entered by mistake. A soft delete: the row stays for anything that refers to it. */
  async remove(actor: Actor, customerId: string, id: string): Promise<void> {
    await runInTransaction(async (tx) => {
      const existing = await this.measurements.findForCustomer(id, customerId, actor.businessId, tx);
      if (!existing) throw AppError.notFound("Measurement not found");
      await this.measurements.removeForCustomer(id, customerId, actor.businessId, tx);
      await this.activity.audit(
        {
          businessId: actor.businessId,
          actorId: actor.id,
          action: "measurement.deleted",
          entityType: "customer_measurement",
          entityId: id,
          payload: { customerId },
        },
        tx,
      );
    });
  }

  /** Another business's customer is a 404: existence must not leak. */
  private async assertCustomer(actor: Actor, customerId: string, tx?: Tx): Promise<void> {
    if (!(await this.customers.findInBusiness(customerId, actor.businessId, tx))) {
      throw AppError.notFound("Customer not found");
    }
  }

  private async defaultUnit(actor: Actor, tx: Tx) {
    const business = await this.businesses.findBusiness(actor.businessId, tx);
    return business?.measurementUnit ?? "in";
  }
}
