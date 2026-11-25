/**
 * The permission → roles map (Backend Guide §13.2, §23.2).
 *
 * Roles are DERIVED, never stored on the user: an active membership in the
 * person's business gives its role; `platformRole = super_admin` adds `admin`,
 * `platformRole = support` adds `support`.
 * Routes guard with `authorise("customer.create")` — never with role names.
 *
 * The platform roles (`admin`, `support`) appear ONLY in the `admin.*`
 * permissions. Inside their own business a platform admin is whatever their
 * membership says, nothing more (least privilege; a test enforces it).
 */

/** What a person can be inside a fashion business. */
export const MEMBER_ROLES = ["owner", "manager", "tailor", "receptionist", "accountant", "apprentice"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Roles that come from `users.platform_role`, not from a business membership. */
export const PLATFORM_APP_ROLES = ["admin", "support"] as const;
export type PlatformAppRole = (typeof PLATFORM_APP_ROLES)[number];

export type AppRole = MemberRole | PlatformAppRole;

const ANY: AppRole[] = [...MEMBER_ROLES];
const OWNER: AppRole[] = ["owner"];
const MANAGEMENT: AppRole[] = ["owner", "manager"];
/** People who deal with customers directly. */
const FRONT_DESK: AppRole[] = ["owner", "manager", "tailor", "receptionist"];
/** People who move work through production or hand it over — everyone but the accountant. */
const WORKSHOP: AppRole[] = ["owner", "manager", "tailor", "apprentice", "receptionist"];
/** People who take money and see the payment records. */
const TILL: AppRole[] = ["owner", "manager", "receptionist", "accountant"];
/** People who may give money back or correct the ledger. */
const FINANCE: AppRole[] = ["owner", "manager", "accountant"];

/** Platform admin area: support looks, super admins act. */
const PLATFORM_VIEW: AppRole[] = ["admin", "support"];
const PLATFORM_ACT: AppRole[] = ["admin"];

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
  /** Overview, business and people lists, who the admins are. */
  "admin.read": PLATFORM_VIEW,
  /** Suspend/reactivate, disable/enable, edit a business's locked fields. */
  "admin.manage": PLATFORM_ACT,
  /** The raw audit trail, with IP addresses and devices. */
  "admin.audit": PLATFORM_ACT,
  /** Technical diagnostics (job errors, failed-delivery error text). */
  "admin.technical": PLATFORM_ACT,

  // Shows takings and balances, so it follows who may see payments.
  "dashboard.read": TILL,
} as const satisfies Record<string, AppRole[]>;

export type Permission = keyof typeof PERMISSIONS;
