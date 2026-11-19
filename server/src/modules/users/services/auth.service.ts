import { AppError } from "../../../shared/errors/AppError";
import { runInTransaction } from "../../../shared/repositories/transaction";
import { effectivePlatformRole, hasTrustedEmail, type FirebaseIdentity } from "../../../shared/services/access.service";
import { ActivityService } from "../../activity/services/activity.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import { MeasurementTemplateService } from "../../measurements/services/template.service";
import type { MeDTO, UserRecord } from "../dto/user.dto";
import { UserRepository } from "../repositories/user.repository";
import type { RegisterInput } from "../validators/user.schema";
import { UserService } from "./user.service";

/**
 * Turns a verified Firebase login into a Tailor Seamless account
 * (Firebase Guide §4.6). The API issues no tokens and stores no passwords.
 */
export class AuthService {
  static Instance = new AuthService();

  private constructor(
    private readonly users = UserRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly members = MemberRepository.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly userService = UserService.Instance,
    private readonly templates = MeasurementTemplateService.Instance,
  ) {}

  /** The account as the app sees it: a person named in PLATFORM_ADMIN_EMAILS shows up as a platform admin. */
  private describeFor(identity: FirebaseIdentity, user: UserRecord): Promise<MeDTO> {
    return this.userService.describe({ ...user, platformRole: effectivePlatformRole(identity, user.platformRole) });
  }

  /** GET /auth/me — who am I, which business, what may I do. */
  async me(identity: FirebaseIdentity): Promise<MeDTO> {
    return this.describeFor(identity, await this.resolveOrLink(identity));
  }

  /**
   * 1. A user already linked to this uid → that user.
   * 2. Otherwise, if the email is TRUSTED and one unlinked user has it → link
   *    (how people added by a business owner get in).
   * 3. Otherwise 404 `not_linked` — the client offers "create your business".
   */
  private async resolveOrLink(identity: FirebaseIdentity): Promise<UserRecord> {
    let user = await this.users.findByFirebaseUid(identity.uid);
    if (!user && hasTrustedEmail(identity)) {
      user = await this.users.linkByEmail(identity.email, identity.uid);
    }
    if (!user) {
      throw AppError.notFound("Account not linked", [{ field: "account", message: "not_linked" }]);
    }
    if (user.status !== "active") throw AppError.forbidden("Your account has been disabled");
    return user;
  }

  /**
   * POST /auth/register (PRD US-001) — creates the business workspace, the
   * user and their owner membership in ONE transaction.
   */
  async register(identity: FirebaseIdentity, input: RegisterInput): Promise<MeDTO> {
    if (!identity.email) {
      throw AppError.unprocessable("Your sign-in has no email address", [{ field: "email", message: "required" }]);
    }
    // A password login is never trusted until its email is confirmed.
    if (!hasTrustedEmail(identity)) {
      throw new AppError("Confirm your email address before creating a business", 403, [
        { field: "email", message: "not_verified" },
      ]);
    }
    const email = identity.email;

    const user = await runInTransaction(async (tx) => {
      if (await this.users.findByFirebaseUid(identity.uid, tx)) {
        throw AppError.conflict("This account already belongs to a business");
      }
      if (await this.users.findByEmail(email, tx)) {
        throw AppError.conflict("An account with this email already exists. Sign in to continue.");
      }

      const business = await this.businesses.createBusiness(
        {
          name: input.businessName,
          email,
          phone: input.phone ?? null,
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        },
        tx,
      );
      const created = await this.users.createUser(
        {
          businessId: business.id,
          firebaseUid: identity.uid,
          email,
          fullName: input.fullName,
          phone: input.phone ?? null,
          ...(input.timeZone ? { timeZone: input.timeZone } : {}),
          // The person who creates the business is walked through setting it up.
          onboarding: { completed: [], dismissed: false },
        },
        tx,
      );
      await this.members.createMember({ businessId: business.id, userId: created.id, role: "owner" }, tx);
      await this.templates.seedDefaults(business.id, tx); // Shirt, Trousers, Gown, Senator, Suit
      await this.activity.audit(
        {
          businessId: business.id,
          actorId: created.id,
          action: "business.registered",
          entityType: "business",
          entityId: business.id,
        },
        tx,
      );
      return created;
    });

    this.userService.invalidate(user.id);
    return this.describeFor(identity, user);
  }
}
