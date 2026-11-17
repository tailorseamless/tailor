/**
 * The permission → roles map (Backend Guide §13.2, §23.2).
 *
 * Roles are DERIVED, never stored on the user: an active membership in the
 * person's business gives its role; `platformRole = super_admin` adds `admin`.
 * Routes guard with `authorise("customer.create")` — never with role names.
 */

/** What a person can be inside a fashion business. */
export const MEMBER_ROLES = ["owner", "manager", "tailor", "receptionist", "accountant", "apprentice"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export type AppRole = MemberRole | "admin";

const ANY: AppRole[] = [...MEMBER_ROLES, "admin"];
const OWNER: AppRole[] = ["owner", "admin"];
const MANAGEMENT: AppRole[] = ["owner", "manager", "admin"];
/** People who deal with customers directly. */
const FRONT_DESK: AppRole[] = ["owner", "manager", "tailor", "receptionist", "admin"];
/** People who move work through production or hand it over — everyone but the accountant. */
const WORKSHOP: AppRole[] = ["owner", "manager", "tailor", "apprentice", "receptionist", "admin"];
/** People who take money and see the payment records. */
const TILL: AppRole[] = ["owner", "manager", "receptionist", "accountant", "admin"];
/** People who may give money back or correct the ledger. */
const FINANCE: AppRole[] = ["owner", "manager", "accountant", "admin"];

export const PERMISSIONS = {
  "profile.update": ANY,

  "business.read": ANY,
  "business.update": OWNER,
  "business.delete": OWNER,

  "branch.read": ANY,
  "branch.manage": OWNER,

  // Everyone can see who is on the team (to assign work); only the owner changes it.
  "team.read": ANY,
  "team.manage": OWNER,

  "customer.read": ANY,
  "customer.create": FRONT_DESK,
  "customer.update": FRONT_DESK,
  "customer.delete": MANAGEMENT,

  "measurement.read": ANY,
  "measurement.record": FRONT_DESK,
  "measurement.delete": MANAGEMENT,
  "measurement.template.manage": MANAGEMENT,

  // The design catalogue: everyone browses, the front desk curates.
  "design.read": ANY,
  "design.manage": FRONT_DESK,

  "order.read": ANY,
  "order.create": FRONT_DESK,
  "order.update": FRONT_DESK,
  "order.status": WORKSHOP,

  "payment.read": TILL,
  "payment.record": TILL,
  "payment.refund": FINANCE,
  "payment.void": FINANCE,

  "appointment.read": ANY,
  "appointment.write": FRONT_DESK,

  // Owners and managers plan the work; whoever does it moves it along.
  "task.read": ANY,
  "task.manage": MANAGEMENT,
  "task.status": WORKSHOP,

  // Stock: everyone can look, the workshop records purchases and usage, management edits the list.
  "inventory.read": ANY,
  "inventory.stock": WORKSHOP,
  "inventory.manage": MANAGEMENT,

  // Money going out, and the reports built on it.
  "expense.read": FINANCE,
  "expense.manage": FINANCE,
  "report.read": FINANCE,

  // A person's own notifications.
  "notification.read": ANY,
  // The business's email outbox.
  "email.read": MANAGEMENT,

  // The platform admin area: every business, counts and accounts only.
  "admin.platform": ["admin"],

  // Shows takings and balances, so it follows who may see payments.
  "dashboard.read": TILL,
} as const satisfies Record<string, AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;
