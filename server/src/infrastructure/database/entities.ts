import { AuditLog } from "../../modules/activity/entities/auditLog.entity";
import { AdminAlert } from "../../modules/admin/entities/adminAlert.entity";
import { AdminNote } from "../../modules/admin/entities/adminNote.entity";
import { PlatformAnnouncement } from "../../modules/admin/entities/platformAnnouncement.entity";
import { PlatformDailyStat } from "../../modules/admin/entities/platformDailyStat.entity";
import { AiCredential } from "../../modules/ai/entities/aiCredential.entity";
import { AiDailyUsage } from "../../modules/ai/entities/aiDailyUsage.entity";
import { AiSettings } from "../../modules/ai/entities/aiSettings.entity";
import { AiUsageLog } from "../../modules/ai/entities/aiUsageLog.entity";
import { JobStatus } from "../../modules/system/entities/jobStatus.entity";
import { SecurityCounter } from "../../modules/system/entities/securityCounter.entity";
import { Appointment } from "../../modules/appointments/entities/appointment.entity";
import { Branch } from "../../modules/branches/entities/branch.entity";
import { Business } from "../../modules/businesses/entities/business.entity";
import { BusinessMember } from "../../modules/businesses/entities/businessMember.entity";
import { Customer } from "../../modules/customers/entities/customer.entity";
import { Design } from "../../modules/designs/entities/design.entity";
import { Expense } from "../../modules/expenses/entities/expense.entity";
import { InventoryTransaction } from "../../modules/inventory/entities/inventoryTransaction.entity";
import { Material } from "../../modules/inventory/entities/material.entity";
import { CustomerMeasurement } from "../../modules/measurements/entities/customerMeasurement.entity";
import { MeasurementField } from "../../modules/measurements/entities/measurementField.entity";
import { MeasurementTemplate } from "../../modules/measurements/entities/measurementTemplate.entity";
import { Image } from "../../modules/media/entities/image.entity";
import { EmailOutbox } from "../../modules/notifications/entities/emailOutbox.entity";
import { DeviceToken } from "../../modules/notifications/entities/deviceToken.entity";
import { NotificationPreference } from "../../modules/notifications/entities/notificationPreference.entity";
import { PushDelivery } from "../../modules/notifications/entities/pushDelivery.entity";
import { Notification } from "../../modules/notifications/entities/notification.entity";
import { Order } from "../../modules/orders/entities/order.entity";
import { OrderItem } from "../../modules/orders/entities/orderItem.entity";
import { OrderStatusEvent } from "../../modules/orders/entities/orderStatusEvent.entity";
import { IdempotencyKey } from "../../modules/idempotency/entities/idempotencyKey.entity";
import { AppointmentRequest } from "../../modules/requests/entities/appointmentRequest.entity";
import { Payment } from "../../modules/payments/entities/payment.entity";
import { ProductionTask } from "../../modules/tasks/entities/productionTask.entity";
import { User } from "../../modules/users/entities/user.entity";

/**
 * The entity registry — an explicit list, no globbing (it breaks under tsx).
 * REGISTER every new entity here (Backend Guide §9.1, §16 step 1).
 */
export const ENTITIES = [
  Business,
  Branch,
  User,
  BusinessMember,
  Customer,
  MeasurementTemplate,
  MeasurementField,
  CustomerMeasurement,
  Order,
  OrderItem,
  OrderStatusEvent,
  Payment,
  Appointment,
  AppointmentRequest,
  ProductionTask,
  Material,
  InventoryTransaction,
  Expense,
  Design,
  Image,
  Notification,
  NotificationPreference,
  DeviceToken,
  PushDelivery,
  EmailOutbox,
  IdempotencyKey,
  AuditLog,
  AdminAlert,
  AdminNote,
  PlatformAnnouncement,
  PlatformDailyStat,
  JobStatus,
  SecurityCounter,
  AiCredential,
  AiUsageLog,
  AiDailyUsage,
  AiSettings,
];
