import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import { AppointmentRepository } from "../../appointments/repositories/appointment.repository";
import { TaskRepository } from "../../tasks/repositories/task.repository";
import { MailerService } from "../../../shared/services/mailer.service";
import { EmailOutboxService } from "../../notifications/services/emailOutbox.service";
import { BranchService } from "../../branches/services/branch.service";
import { BusinessRepository } from "../../businesses/repositories/business.repository";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import { UserRepository } from "../../users/repositories/user.repository";
import { UserService } from "../../users/services/user.service";
import type { TeamMemberDTO } from "../dto/team.dto";
import type { AddMemberInput, ListTeamQuery, UpdateMemberInput } from "../validators/team.schema";

/**
 * The people of a business (PRD US-004, US-005). Adding someone creates their
 * account without a login; it links itself the first time they sign in with
 * that email, once the email is verified (Firebase Guide §4.6).
 */
export class TeamService {
  static Instance = new TeamService();

  private constructor(
    private readonly members = MemberRepository.Instance,
    private readonly users = UserRepository.Instance,
    private readonly businesses = BusinessRepository.Instance,
    private readonly appointments = AppointmentRepository.Instance,
    private readonly tasks = TaskRepository.Instance,
    private readonly branches = BranchService.Instance,
    private readonly emails = EmailOutboxService.Instance,
    private readonly mailer = MailerService.Instance,
    private readonly activity = ActivityService.Instance,
    private readonly userService = UserService.Instance,
  ) {}

  list(actor: Actor, query: ListTeamQuery): Promise<Paginated<TeamMemberDTO>> {
    return this.members.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
  }

  /** Someone in another business is a 404: existence must not leak. */
  async detail(actor: Actor, userId: string): Promise<TeamMemberDTO> {
    const member = await this.members.findMember(actor.businessId, userId);
    if (!member) throw AppError.notFound("Team member not found");
    return member;
  }

  async add(actor: Actor, input: AddMemberInput): Promise<TeamMemberDTO> {
    return runInTransaction(async (tx) => {
      // One account per email across the platform: a person belongs to one business.
      if (await this.users.findByEmail(input.email, tx)) {
        throw AppError.conflict("This email already belongs to an account", [{ field: "email", message: "duplicate" }]);
      }
      const business = await this.businesses.findBusiness(actor.businessId, tx);
      if (!business) throw AppError.notFound("Business not found");

      const user = await this.users.createUser(
        {
          businessId: actor.businessId,
          email: input.email,
          fullName: input.fullName,
          phone: input.phone ?? null,
          timeZone: business.timeZone,
        },
        tx,
      );
      await this.branches.assertActive(actor, input.branchId, tx);
      await this.members.createMember(
        { businessId: actor.businessId, userId: user.id, role: input.role, branchId: input.branchId ?? null },
        tx,
      );
      await this.audit(actor, "team.member_added", user.id, { role: input.role }, tx);
      await this.queueInvitation(
        actor,
        { userId: user.id, fullName: input.fullName, email: input.email, role: input.role },
        business.name,
        true,
        tx,
      );
      return (await this.members.findMember(actor.businessId, user.id, tx))!;
    });
  }

  /** Role, access (active / suspended), name and phone. The owner is not changed here. */
  async update(actor: Actor, userId: string, input: UpdateMemberInput): Promise<TeamMemberDTO> {
    const { role, status, branchId, ...profile } = input;
    const member = await runInTransaction(async (tx) => {
      const existing = await this.manageable(actor, userId, tx);

      await this.branches.assertActive(actor, branchId, tx);
      if (role || status || branchId !== undefined) {
        await this.members.updateMember(actor.businessId, userId, { role, status, branchId }, tx);
      }
      if (Object.keys(profile).length > 0) await this.users.updateUser(userId, profile, tx);
      await this.audit(
        actor,
        "team.member_updated",
        userId,
        {
          fields: Object.keys(input),
          ...(role ? { roleFrom: existing.role, roleTo: role } : {}),
          ...(status ? { statusFrom: existing.status, statusTo: status } : {}),
        },
        tx,
      );
      return (await this.members.findMember(actor.businessId, userId, tx))!;
    });
    this.userService.invalidate(userId); // their cached roles are stale now
    return member;
  }

  /**
   * Takes someone off the team. Their account is closed (soft-deleted), so
   * everything they recorded keeps their name, and their email is free again.
   * Appointments still booked with them and their open tasks become unassigned.
   */
  async remove(actor: Actor, userId: string): Promise<{ unassignedAppointments: number; unassignedTasks: number }> {
    const result = await runInTransaction(async (tx) => {
      await this.manageable(actor, userId, tx);
      const unassignedAppointments = await this.appointments.unassignScheduled(actor.businessId, userId, tx);
      const unassignedTasks = await this.tasks.unassignOpen(actor.businessId, userId, tx);
      await this.members.removeMember(actor.businessId, userId, tx);
      await this.users.softDelete(userId, tx);
      await this.audit(actor, "team.member_removed", userId, { unassignedAppointments, unassignedTasks }, tx);
      return { unassignedAppointments, unassignedTasks };
    });
    this.userService.invalidate(userId); // cut their access now, not in a minute
    return result;
  }

  /** Emails the invitation again, for someone who has not signed in yet. */
  async resendInvitation(actor: Actor, userId: string): Promise<{ queued: boolean; emailEnabled: boolean }> {
    const member = await this.members.findMember(actor.businessId, userId);
    if (!member) throw AppError.notFound("Team member not found");
    if (member.hasSignedIn) throw AppError.conflict("This person has already signed in");
    const business = await this.businesses.findBusiness(actor.businessId);
    if (!business) throw AppError.notFound("Business not found");
    const queued = await this.queueInvitation(actor, member, business.name, false);
    return { queued, emailEnabled: this.mailer.enabled };
  }

  private async queueInvitation(
    actor: Actor,
    member: { userId: string; fullName: string; email: string; role: string },
    businessName: string,
    once: boolean,
    tx?: Tx,
  ): Promise<boolean> {
    const inviter = await this.users.findUser(actor.id, tx);
    return this.emails.queue(
      {
        businessId: actor.businessId,
        kind: "team.invitation",
        to: member.email,
        toName: member.fullName,
        payload: {
          businessName,
          inviteeName: member.fullName,
          inviterName: inviter?.fullName ?? businessName,
          role: member.role,
          email: member.email,
        },
        dedupeKey: once ? `team.invitation:${member.userId}` : null,
      },
      tx,
    );
  }

  /** The member, if the caller may change them: not themself, not the owner. */
  private async manageable(actor: Actor, userId: string, tx: Tx): Promise<TeamMemberDTO> {
    const member = await this.members.findMember(actor.businessId, userId, tx);
    if (!member) throw AppError.notFound("Team member not found");
    if (userId === actor.id) throw AppError.conflict("You cannot change your own access");
    if (member.role === "owner") throw AppError.conflict("The owner's access cannot be changed");
    return member;
  }

  private audit(actor: Actor, action: AuditAction, userId: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "user", entityId: userId, payload },
      tx,
    );
  }
}
