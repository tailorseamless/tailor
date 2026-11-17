import type { AppointmentType } from "./appointment.types";
import type { OrderStatus } from "./order.types";
import type { PaymentKind } from "./payment.types";

export interface PublicBusiness {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timeZone: string;
  currency: string;
  bookingUrl: string | null;
}

export interface PublicDesign {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  images: { url: string; width: number | null; height: number | null }[];
}

export interface Portal {
  business: PublicBusiness;
  customer: { fullName: string };
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    dueDate: string | null;
    totalAmount: number;
    amountPaid: number;
    balance: number;
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

export interface BookingPage {
  business: PublicBusiness;
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
}
