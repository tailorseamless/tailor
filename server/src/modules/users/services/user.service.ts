import { AUTH_CACHE_TTL_MS } from "../../../config/constants";
import { PERMISSIONS, type AppRole, type Permission } from "../../../config/permissions";
import { AppError } from "../../../shared/errors/AppError";
import { rolesFromFlags, type Actor, type AuthUser } from "../../../shared/services/access.service";
import { TtlCache } from "../../../shared/utils/ttlCache";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import type { MeDTO, UserRecord } from "../dto/user.dto";
import { UserRepository } from "../repositories/user.repository";
import type { UpdateMeInput } from "../validators/user.schema";

function permissionsFor(roles: AppRole[]): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
    roles.some((role) => (PERMISSIONS[permission] as readonly AppRole[]).includes(role)),
  );
}

export class UserService {
  static Instance = new UserService();

  private readonly authCache = new TtlCache<AuthUser>(AUTH_CACHE_TTL_MS);

  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly members = MemberRepository.Instance,
  ) {}

  /**
   * The linked, ACTIVE user behind a Firebase uid, with derived roles — cached
   * for 60 s. Null when there is none, they are disabled, or their business is
   * suspended. Misses are not cached, so a first sign-in links immediately.
   */
  async resolveAuthUser(firebaseUid: string): Promise<AuthUser | null> {
    const cached = this.authCache.get(firebaseUid);
    if (cached) return cached;

    const row = await this.users.findAuthRow(firebaseUid);
    if (!row || row.status !== "active" || row.businessStatus !== "active") return null;

    const user: AuthUser = {
      id: row.id,
      firebaseUid: row.firebaseUid,
      email: row.email,
      businessId: row.businessId,
      platformRole: row.platformRole,
      roles: rolesFromFlags(row),
      timeZone: row.timeZone,
    };
    this.authCache.set(firebaseUid, user);
    return user;
  }

  /** Call after anything that changes a person's roles, status or time zone. */
  invalidate(userId: string): void {
    this.authCache.deleteWhere((user) => user.id === userId);
  }

  /** Everyone in a business at once (it was suspended, reactivated or deleted). */
  invalidateBusiness(businessId: string): void {
    this.authCache.deleteWhere((user) => user.businessId === businessId);
  }

  /** The account, its business and what it may do — the body of /auth/me. */
  async describe(user: UserRecord): Promise<MeDTO> {
    const [business, membership] = await Promise.all([
      this.businesses.findBusiness(user.businessId),
      this.members.findMembership(user.businessId, user.id),
    ]);
    if (!business) throw AppError.notFound("Business not found");

    const roles = rolesFromFlags({
      platformRole: user.platformRole,
      memberRole: membership?.role ?? null,
      memberStatus: membership?.status ?? null,
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        timeZone: user.timeZone,
        platformRole: user.platformRole,
        deletionScheduledFor: user.deletionScheduledFor,
        onboarding: user.onboarding,
      },
      business,
      roles,
      permissions: permissionsFor(roles),
    };
  }

  async updateMe(actor: Actor, input: UpdateMeInput): Promise<MeDTO> {
    const user = await this.users.updateUser(actor.id, input);
    if (!user) throw AppError.notFound("Account not found");
    this.invalidate(actor.id); // the cached time zone may be stale
    return this.describe(user);
  }
}
