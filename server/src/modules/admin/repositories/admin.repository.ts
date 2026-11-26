import { AppDataSource } from "../../../infrastructure/database/dataSource";
import { buildMeta, getOffset, type Paginated } from "../../../shared/pagination/paginate";
import { likePattern } from "../../../shared/repositories/baseRepository";
import type { Tx } from "../../../shared/repositories/transaction";
import type { PlatformRole } from "../../../shared/services/access.service";
import type { OnboardingState } from "../../users/dto/user.dto";
import type {
  AdminBusinessDetailDTO,
  AdminBusinessDTO,
  AdminMemberDTO,
  AdminUserDTO,
  ListAdminBusinessesParams,
  ListAdminUsersParams,
  PlatformAdminDTO,
  PlatformOverviewDTO,
} from "../dto/admin.dto";

const toInt = (value: unknown) => Number(value ?? 0);

/**
 * Platform-wide reads for the admin area. These are the ONLY queries that
 * cross businesses — deliberately, and they return counts and account
 * details only. Raw SQL filters soft deletes by hand (Backend Guide §8.3).
 */
export class AdminRepository {
  static Instance = new AdminRepository();

  private constructor() {}

  async overview(): Promise<Omit<PlatformOverviewDTO, "alerts">> {
    const [b] = await AppDataSource.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'active') AS active,
              COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
              COUNT(*) FILTER (WHERE deletion_scheduled_for IS NOT NULL) AS scheduled,
              COUNT(*) FILTER (WHERE created_at > now() - interval '30 days') AS recent
         FROM businesses WHERE deleted_at IS NULL`,
    );
    const [u] = await AppDataSource.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'active') AS active,
              COUNT(*) FILTER (WHERE status = 'disabled') AS disabled,
              COUNT(*) FILTER (WHERE firebase_uid IS NOT NULL) AS signed_in
         FROM users WHERE deleted_at IS NULL`,
    );
    const [a] = await AppDataSource.query(
      `SELECT (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND created_at > now() - interval '30 days') AS orders,
              (SELECT COUNT(*) FROM appointments WHERE deleted_at IS NULL AND created_at > now() - interval '30 days') AS appointments,
              (SELECT COUNT(DISTINCT business_id) FROM orders WHERE deleted_at IS NULL AND created_at > now() - interval '30 days') AS active_businesses`,
    );
    return {
      businesses: {
        total: toInt(b.total),
        active: toInt(b.active),
        suspended: toInt(b.suspended),
        scheduledForDeletion: toInt(b.scheduled),
        newLast30Days: toInt(b.recent),
      },
      users: {
        total: toInt(u.total),
        active: toInt(u.active),
        disabled: toInt(u.disabled),
        signedIn: toInt(u.signed_in),
      },
      activity: {
        ordersLast30Days: toInt(a.orders),
        appointmentsLast30Days: toInt(a.appointments),
        activeBusinessesLast30Days: toInt(a.active_businesses),
      },
    };
  }

  private businessSelect = `
    SELECT b.id, b.name, b.status, b.currency, b.email, b.phone, b.address,
           b.time_zone AS "timeZone", b.measurement_unit AS "measurementUnit", b.created_at AS "createdAt",
           b.deletion_scheduled_for AS "deletionScheduledFor",
           o.id AS "ownerId", o.full_name AS "ownerName", o.email AS "ownerEmail",
           (SELECT COUNT(*) FROM business_members m WHERE m.business_id = b.id AND m.deleted_at IS NULL) AS members,
           (SELECT COUNT(*) FROM customers c WHERE c.business_id = b.id AND c.deleted_at IS NULL) AS customers,
           (SELECT COUNT(*) FROM orders r WHERE r.business_id = b.id AND r.deleted_at IS NULL) AS orders,
           (SELECT MAX(r.created_at) FROM orders r WHERE r.business_id = b.id AND r.deleted_at IS NULL) AS "lastOrderAt"
      FROM businesses b
      LEFT JOIN business_members om ON om.business_id = b.id AND om.role = 'owner' AND om.deleted_at IS NULL
      LEFT JOIN users o ON o.id = om.user_id
     WHERE b.deleted_at IS NULL`;

  private toBusiness(row: Record<string, unknown>): AdminBusinessDTO {
    return {
      id: row.id as string,
      name: row.name as string,
      status: row.status as AdminBusinessDTO["status"],
      currency: row.currency as string,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      address: (row.address as string | null) ?? null,
      timeZone: row.timeZone as string,
      measurementUnit: row.measurementUnit as AdminBusinessDTO["measurementUnit"],
      createdAt: row.createdAt as Date,
      deletionScheduledFor: (row.deletionScheduledFor as Date | null) ?? null,
      owner: row.ownerId
        ? { id: row.ownerId as string, fullName: row.ownerName as string, email: row.ownerEmail as string }
        : null,
      counts: { members: toInt(row.members), customers: toInt(row.customers), orders: toInt(row.orders) },
      lastOrderAt: (row.lastOrderAt as Date | null) ?? null,
    };
  }

  /** Newest first. A small table (one row per business); counts are per page only. */
  async listBusinesses(params: ListAdminBusinessesParams): Promise<Paginated<AdminBusinessDTO>> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (params.status) {
      args.push(params.status);
      where.push(`b.status = $${args.length}`);
    }
    if (params.search) {
      args.push(likePattern(params.search));
      where.push(`(b.name ILIKE $${args.length} OR o.email ILIKE $${args.length})`);
    }
    const filter = where.length ? ` AND ${where.join(" AND ")}` : "";
    args.push(params.limit, getOffset(params.page, params.limit));
    const rows: Record<string, unknown>[] = await AppDataSource.query(
      `${this.businessSelect}${filter} ORDER BY b.created_at DESC, b.id LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args,
    );
    const total =
      params.page === 1 && rows.length === params.limit
        ? toInt(
            (
              await AppDataSource.query(
                `SELECT COUNT(*) AS n FROM (${this.businessSelect}${filter}) t`,
                args.slice(0, -2),
              )
            )[0].n,
          )
        : params.page === 1
          ? rows.length
          : 0;
    return {
      data: rows.map((row) => this.toBusiness(row)),
      meta: buildMeta(params.page, params.limit, total, rows.length),
    };
  }

  async findBusiness(id: string, tx?: Tx): Promise<AdminBusinessDTO | null> {
    const rows: Record<string, unknown>[] = await (tx ?? AppDataSource.manager).query(
      `${this.businessSelect} AND b.id = $1`,
      [id],
    );
    return rows[0] ? this.toBusiness(rows[0]) : null;
  }

  async setBusinessStatus(id: string, status: "active" | "suspended", tx: Tx): Promise<void> {
    await tx.query(`UPDATE businesses SET status = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [
      id,
      status,
    ]);
  }

  private userSelect = `
    SELECT u.id, u.full_name AS "fullName", u.email, u.status, u.platform_role AS "platformRole",
           u.firebase_uid IS NOT NULL AS "hasSignedIn", u.last_seen_at AS "lastSeenAt", u.business_id AS "businessId", b.name AS "businessName",
           m.role, u.created_at AS "createdAt"
      FROM users u
      JOIN businesses b ON b.id = u.business_id
      LEFT JOIN business_members m ON m.user_id = u.id AND m.business_id = u.business_id AND m.deleted_at IS NULL
     WHERE u.deleted_at IS NULL`;

  async listUsers(params: ListAdminUsersParams): Promise<Paginated<AdminUserDTO>> {
    const where: string[] = [];
    const args: unknown[] = [];
    if (params.status) {
      args.push(params.status);
      where.push(`u.status = $${args.length}`);
    }
    if (params.businessId) {
      args.push(params.businessId);
      where.push(`u.business_id = $${args.length}`);
    }
    if (params.search) {
      args.push(likePattern(params.search));
      where.push(`(u.full_name ILIKE $${args.length} OR u.email ILIKE $${args.length})`);
    }
    const filter = where.length ? ` AND ${where.join(" AND ")}` : "";
    args.push(params.limit, getOffset(params.page, params.limit));
    const rows: AdminUserDTO[] = await AppDataSource.query(
      `${this.userSelect}${filter} ORDER BY u.created_at DESC, u.id LIMIT $${args.length - 1} OFFSET $${args.length}`,
      args,
    );
    const total =
      params.page === 1 && rows.length === params.limit
        ? toInt(
            (
              await AppDataSource.query(`SELECT COUNT(*) AS n FROM (${this.userSelect}${filter}) t`, args.slice(0, -2))
            )[0].n,
          )
        : params.page === 1
          ? rows.length
          : 0;
    return { data: rows, meta: buildMeta(params.page, params.limit, total, rows.length) };
  }

  async findUser(id: string, tx?: Tx): Promise<AdminUserDTO | null> {
    const rows: AdminUserDTO[] = await (tx ?? AppDataSource.manager).query(`${this.userSelect} AND u.id = $1`, [id]);
    return rows[0] ?? null;
  }

  async setUserStatus(id: string, status: "active" | "disabled", tx: Tx): Promise<void> {
    await tx.query(`UPDATE users SET status = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [
      id,
      status,
    ]);
  }

  /** Business 360, without the business row itself (the service adds it). One query per concern, all by business id. */
  async businessDetail(id: string): Promise<Omit<AdminBusinessDetailDTO, "business" | "openAlerts" | "churnRisk">> {
    const [page] = await AppDataSource.query(
      `SELECT slug, page_enabled AS "pageEnabled", booking_enabled AS "bookingEnabled",
              (bank_name IS NOT NULL AND account_number IS NOT NULL AND account_name IS NOT NULL) AS "hasBankDetails"
         FROM businesses WHERE id = $1`,
      [id],
    );
    const members: AdminMemberDTO[] = await AppDataSource.query(
      `SELECT u.id AS "userId", u.full_name AS "fullName", u.email, m.role, m.status AS "memberStatus",
              u.status AS "userStatus", u.platform_role AS "platformRole", u.firebase_uid IS NOT NULL AS "hasSignedIn",
              u.last_seen_at AS "lastSeenAt", m.created_at AS "addedAt"
         FROM business_members m JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
        WHERE m.business_id = $1 AND m.deleted_at IS NULL
        ORDER BY (m.role = 'owner') DESC, m.created_at`,
      [id],
    );
    const [owner] = await AppDataSource.query(
      `SELECT u.onboarding FROM business_members m JOIN users u ON u.id = m.user_id
        WHERE m.business_id = $1 AND m.role = 'owner' AND m.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    const [c] = await AppDataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM branches WHERE business_id = $1 AND deleted_at IS NULL) AS branches,
         (SELECT COUNT(*) FROM customers WHERE business_id = $1 AND deleted_at IS NULL) AS customers,
         (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND deleted_at IS NULL
             AND status NOT IN ('delivered', 'cancelled')) AS orders_open,
         (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND deleted_at IS NULL
             AND status NOT IN ('delivered', 'cancelled', 'ready') AND due_date < CURRENT_DATE) AS orders_overdue,
         (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND deleted_at IS NULL AND status = 'delivered') AS orders_delivered,
         (SELECT COUNT(*) FROM orders WHERE business_id = $1 AND deleted_at IS NULL AND status = 'cancelled') AS orders_cancelled,
         (SELECT COUNT(*) FROM payments WHERE business_id = $1) AS payments,
         (SELECT COUNT(*) FROM appointments WHERE business_id = $1 AND deleted_at IS NULL
             AND status = 'scheduled' AND starts_at > now()) AS appointments_upcoming,
         (SELECT COUNT(*) FROM appointment_requests WHERE business_id = $1 AND deleted_at IS NULL AND status = 'pending') AS requests_pending,
         (SELECT COUNT(*) FROM production_tasks WHERE business_id = $1 AND deleted_at IS NULL
             AND status IN ('todo', 'in_progress')) AS tasks_open,
         (SELECT COUNT(*) FROM designs WHERE business_id = $1 AND deleted_at IS NULL) AS designs,
         (SELECT COUNT(*) FROM customer_measurements WHERE business_id = $1 AND deleted_at IS NULL) AS measurements,
         (SELECT COUNT(*) FROM materials WHERE business_id = $1 AND deleted_at IS NULL) AS materials,
         (SELECT COUNT(*) FROM expenses WHERE business_id = $1 AND deleted_at IS NULL) AS expenses`,
      [id],
    );
    const [seen] = await AppDataSource.query(
      `SELECT COUNT(*) FILTER (WHERE has_photo AND visibility = 'customers') AS showing,
              COUNT(*) FILTER (WHERE has_photo AND visibility = 'private') AS hidden,
              COUNT(*) FILTER (WHERE NOT has_photo) AS no_photo
         FROM (SELECT d.visibility,
                      EXISTS (SELECT 1 FROM images i WHERE i.design_id = d.id AND i.deleted_at IS NULL) AS has_photo
                 FROM designs d
                WHERE d.business_id = $1 AND d.deleted_at IS NULL) AS catalogue`,
      [id],
    );
    const [mail] = await AppDataSource.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'sent') AS sent, COUNT(*) FILTER (WHERE status = 'failed') AS failed,
              COUNT(*) FILTER (WHERE status = 'pending') AS pending
         FROM email_outbox WHERE business_id = $1 AND created_at > now() - interval '30 days'`,
      [id],
    );
    const weeks: { weekStart: string; events: string }[] = await AppDataSource.query(
      `SELECT to_char(w.week, 'YYYY-MM-DD') AS "weekStart", COUNT(a.id) AS events
         FROM generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') AS w(week)
         LEFT JOIN audit_logs a ON a.business_id = $1 AND a.created_at >= w.week AND a.created_at < w.week + interval '1 week'
        GROUP BY w.week ORDER BY w.week`,
      [id],
    );
    const [last] = await AppDataSource.query(`SELECT MAX(created_at) AS at FROM audit_logs WHERE business_id = $1`, [
      id,
    ]);
    return {
      publicPage: {
        slug: (page?.slug as string | null) ?? null,
        pageEnabled: page?.pageEnabled === true,
        bookingEnabled: page?.bookingEnabled === true,
        hasBankDetails: page?.hasBankDetails === true,
      },
      designVisibility: { showing: toInt(seen.showing), hidden: toInt(seen.hidden), noPhoto: toInt(seen.no_photo) },
      members,
      onboarding: (owner?.onboarding as OnboardingState | null) ?? null,
      counts: {
        branches: toInt(c.branches),
        customers: toInt(c.customers),
        ordersOpen: toInt(c.orders_open),
        ordersOverdue: toInt(c.orders_overdue),
        ordersDelivered: toInt(c.orders_delivered),
        ordersCancelled: toInt(c.orders_cancelled),
        payments: toInt(c.payments),
        appointmentsUpcoming: toInt(c.appointments_upcoming),
        requestsPending: toInt(c.requests_pending),
        tasksOpen: toInt(c.tasks_open),
        designs: toInt(c.designs),
        measurements: toInt(c.measurements),
        materials: toInt(c.materials),
        expenses: toInt(c.expenses),
      },
      email30d: { sent: toInt(mail.sent), failed: toInt(mail.failed), pending: toInt(mail.pending) },
      activityByWeek: weeks.map((w) => ({ weekStart: w.weekStart, events: toInt(w.events) })),
      lastActivityAt: (last?.at as Date | null) ?? null,
    };
  }

  /** User 360's extra account fields and how much they have done. */
  async userDetail(id: string): Promise<{
    timeZone: string;
    deletionScheduledFor: Date | null;
    onboarding: OnboardingState | null;
    memberStatus: "active" | "suspended" | null;
    actionsTotal: number;
    actionsLast30Days: number;
  } | null> {
    const [row] = await AppDataSource.query(
      `SELECT u.time_zone AS "timeZone", u.deletion_scheduled_for AS "deletionScheduledFor", u.onboarding,
              m.status AS "memberStatus",
              (SELECT COUNT(*) FROM audit_logs a WHERE a.actor_id = u.id) AS total,
              (SELECT COUNT(*) FROM audit_logs a WHERE a.actor_id = u.id AND a.created_at > now() - interval '30 days') AS recent
         FROM users u
         LEFT JOIN business_members m ON m.user_id = u.id AND m.business_id = u.business_id AND m.deleted_at IS NULL
        WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [id],
    );
    if (!row) return null;
    return {
      timeZone: row.timeZone,
      deletionScheduledFor: row.deletionScheduledFor ?? null,
      onboarding: row.onboarding ?? null,
      memberStatus: row.memberStatus ?? null,
      actionsTotal: toInt(row.total),
      actionsLast30Days: toInt(row.recent),
    };
  }

  async openAlertsFor(businessId: string): Promise<number> {
    const [row] = await AppDataSource.query(
      `SELECT COUNT(*) AS n FROM admin_alerts WHERE business_id = $1 AND status <> 'resolved'`,
      [businessId],
    );
    return toInt(row.n);
  }

  /** Whether the business has ever taken a payment (voided and refunded ones count: they are on receipts). */
  async businessHasPayments(businessId: string, tx?: Tx): Promise<boolean> {
    const rows: { found: boolean }[] = await (tx ?? AppDataSource.manager).query(
      `SELECT EXISTS (SELECT 1 FROM payments WHERE business_id = $1) AS found`,
      [businessId],
    );
    return rows[0]?.found === true;
  }

  /**
   * Everyone with platform power: the database grants, plus the addresses in PLATFORM_ADMIN_EMAILS
   * (with or without an account). Merged by email; the setting always means super admin.
   */
  async listPlatformAdmins(settingEmails: readonly string[]): Promise<PlatformAdminDTO[]> {
    const rows: {
      id: string;
      email: string;
      fullName: string;
      status: AdminUserDTO["status"];
      platformRole: PlatformRole;
      businessName: string;
      hasSignedIn: boolean;
    }[] = await AppDataSource.query(
      `SELECT u.id, u.email, u.full_name AS "fullName", u.status, u.platform_role AS "platformRole",
              b.name AS "businessName", u.firebase_uid IS NOT NULL AS "hasSignedIn"
         FROM users u
         JOIN businesses b ON b.id = u.business_id
        WHERE u.deleted_at IS NULL AND (u.platform_role <> 'user' OR u.email = ANY($1::text[]))
        ORDER BY u.email`,
      [settingEmails],
    );
    const inSetting = new Set(settingEmails);
    const admins: PlatformAdminDTO[] = rows.map((row) => {
      const sources: PlatformAdminDTO["sources"] = [];
      if (row.platformRole !== "user") sources.push("database");
      if (inSetting.has(row.email)) sources.push("setting");
      return {
        email: row.email,
        role: inSetting.has(row.email) || row.platformRole === "super_admin" ? "super_admin" : "support",
        sources,
        user: {
          id: row.id,
          fullName: row.fullName,
          status: row.status,
          businessName: row.businessName,
          hasSignedIn: row.hasSignedIn,
        },
      };
    });
    const found = new Set(rows.map((row) => row.email));
    for (const email of settingEmails) {
      if (!found.has(email)) admins.push({ email, role: "super_admin", sources: ["setting"], user: null });
    }
    return admins;
  }

  /** Used by the admin:grant script only. The user's id and role before the change, or null. */
  async setPlatformRole(
    email: string,
    role: PlatformRole,
    tx: Tx,
  ): Promise<{ id: string; previous: PlatformRole } | null> {
    const [before]: { id: string; previous: PlatformRole }[] = await tx.query(
      `SELECT id, platform_role AS previous FROM users WHERE email = $1 AND deleted_at IS NULL FOR UPDATE`,
      [email.toLowerCase()],
    );
    if (!before) return null;
    if (before.previous !== role) {
      await tx.query(`UPDATE users SET platform_role = $2, updated_at = now() WHERE id = $1`, [before.id, role]);
    }
    return before;
  }
}
