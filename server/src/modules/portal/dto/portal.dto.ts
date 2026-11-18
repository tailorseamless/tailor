import type { AppointmentType } from "../../appointments/dto/appointment.dto";
import type { MeasurementUnit } from "../../businesses/dto/business.dto";
import type { CustomerGender } from "../../customers/dto/customer.dto";
import type { PublicDesignDTO } from "../../designs/dto/design.dto";
import type { MeasurementValue } from "../../measurements/dto/measurement.dto";
import type { OrderStatus } from "../../orders/dto/order.dto";
import type { PaymentKind } from "../../payments/dto/payment.dto";
import type { RequestStatus } from "../../requests/dto/request.dto";

export const PORTAL_LIMITS = { orders: 20, appointments: 20, payments: 20, designs: 24, requests: 10 } as const;

/** What a business shows about itself on public pages — contact details only. */
export interface PublicBusinessDTO {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timeZone: string;
  currency: string;
  /** Online booking is open: <APP_URL>/book/<slug>. */
  bookingUrl: string | null;
}

/**
 * The customer portal (PRD §4.7, Phase 3): opened by a secret link, read-only
 * apart from confirming appointments and asking for new ones. Shows only what
 * the customer needs: no staff names, no internal notes, no other customers.
 */
export interface PortalDTO {
  business: PublicBusinessDTO;
  /** The gender only picks which body figure the measurements are drawn on. */
  customer: { fullName: string; gender: CustomerGender | null };
  /** The latest set of this customer's own measurements, without the staff's notes; null if none were taken. */
  measurements: PortalMeasurementsDTO | null;
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    dueDate: string | null;
    totalAmount: number;
    amountPaid: number;
    balance: number;
    /** An item still has only an estimate, so the total is not final. */
    pricePending: boolean;
    /** The range the order could come to while the price is pending; null once final. */
    estimateMin: number | null;
    estimateMax: number | null;
    /** All the discounts on the order added up. */
    discountTotal: number;
    items: { garmentName: string; quantity: number }[];
    createdAt: Date;
  }[];
  appointments: {
    id: string;
    type: AppointmentType;
    startsAt: Date;
    durationMinutes: number;
    /** The customer said they will come. */
    confirmedAt: Date | null;
  }[];
  payments: {
    id: string;
    receiptNumber: string | null;
    kind: PaymentKind;
    amount: number;
    paidAt: Date;
    voided: boolean;
  }[];
  requests: { id: string; type: AppointmentType; preferredStartsAt: Date; status: RequestStatus; createdAt: Date }[];
  designs: PublicDesignDTO[];
}

export interface PortalMeasurementsDTO {
  /** `YYYY-MM-DD` */
  measuredOn: string;
  unit: MeasurementUnit;
  templateName: string | null;
  values: MeasurementValue[];
}

/** The public booking page. */
export interface BookingPageDTO {
  business: PublicBusinessDTO;
  appointmentTypes: { value: AppointmentType; label: string }[];
  designs: PublicDesignDTO[];
}
