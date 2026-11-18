import type { AppointmentType } from "./appointment.types";
import type { MeasurementUnit } from "./auth.types";
import type { CustomerGender, MeasurementValue } from "./customer.types";
import type { OrderStatus } from "./order.types";
import type { PaymentKind } from "./payment.types";

export interface PublicBusiness {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timeZone: string;
  currency: string;
  /** The unit a measurement form should start on. */
  measurementUnit: MeasurementUnit;
  /** The business's public page, when it has one. */
  pageUrl: string | null;
}

export interface PublicDesign {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  priceMin: number | null;
  priceMax: number | null;
  images: { url: string; width: number | null; height: number | null }[];
}

/** The customer's latest measurements, without the staff's notes. */
export interface PortalMeasurements {
  measuredOn: string;
  unit: MeasurementUnit;
  templateName: string | null;
  values: MeasurementValue[];
}

export interface Portal {
  business: PublicBusiness;
  customer: { fullName: string; gender: CustomerGender | null };
  measurements: PortalMeasurements | null;
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
    estimateMin: number | null;
    estimateMax: number | null;
    discountTotal: number;
    items: { garmentName: string; quantity: number }[];
    createdAt: string;
  }[];
  appointments: {
    id: string;
    type: AppointmentType;
    startsAt: string;
    durationMinutes: number;
    confirmedAt: string | null;
  }[];
  payments: {
    id: string;
    receiptNumber: string | null;
    kind: PaymentKind;
    amount: number;
    paidAt: string;
    voided: boolean;
  }[];
  requests: { id: string; type: AppointmentType; preferredStartsAt: string; status: string; createdAt: string }[];
  designs: PublicDesign[];
}

/** A business's public page: contact details, designs with their price ranges, and optionally a booking form. */
export interface ShopPage {
  business: PublicBusiness;
  /** Visitors can ask for an appointment here. */
  bookingOpen: boolean;
  appointmentTypes: { value: AppointmentType; label: string }[];
  designs: PublicDesign[];
}

export interface BookingRequestInput {
  fullName: string;
  phone: string;
  email?: string | null;
  type: AppointmentType;
  preferredStartsAt: string;
  note?: string | null;
  /** The design they asked about, when they came from "Book a fitting" on one. */
  designId?: string | null;
  /** Measurements the customer already has from another tailor; staff check them before they are kept. */
  measurements?: MeasurementValue[];
  measurementUnit?: MeasurementUnit;
}

/** What the portal sends: the customer is known, so no name or contact details. */
export type PortalRequestInput = Pick<
  BookingRequestInput,
  "type" | "preferredStartsAt" | "note" | "measurements" | "measurementUnit"
>;
