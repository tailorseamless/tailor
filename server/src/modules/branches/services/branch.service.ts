import { AppError } from "../../../shared/errors/AppError";
import type { Paginated } from "../../../shared/pagination/paginate";
import { runInTransaction, type Tx } from "../../../shared/repositories/transaction";
import type { Actor } from "../../../shared/services/access.service";
import type { AuditAction } from "../../activity/dto/activity.dto";
import { ActivityService } from "../../activity/services/activity.service";
import { MemberRepository } from "../../businesses/repositories/member.repository";
import type { BranchRecord } from "../dto/branch.dto";
import { BranchRepository } from "../repositories/branch.repository";
import type { CreateBranchInput, ListBranchesQuery, UpdateBranchInput } from "../validators/branch.schema";

export class BranchService {
  static Instance = new BranchService();

  private constructor(
    private readonly branches = BranchRepository.Instance,
    private readonly members = MemberRepository.Instance,
    private readonly activity = ActivityService.Instance,
  ) {}

  list(actor: Actor, query: ListBranchesQuery): Promise<Paginated<BranchRecord>> {
    return this.branches.listForBusiness({ ...query, businessId: actor.businessId }); // tenant scope, always
  }

  async detail(actor: Actor, id: string): Promise<BranchRecord> {
    const branch = await this.branches.findInBusiness(id, actor.businessId);
    if (!branch) throw AppError.notFound("Branch not found");
    return branch;
  }

  async create(actor: Actor, input: CreateBranchInput): Promise<BranchRecord> {
    return runInTransaction(async (tx) => {
      await this.assertNameIsFree(actor.businessId, input.name, undefined, tx);
      const branch = await this.branches.createBranch(
        {
          businessId: actor.businessId,
          name: input.name,
          address: input.address ?? null,
          phone: input.phone ?? null,
          status: "active",
        },
        tx,
      );
      await this.audit(actor, "branch.created", branch.id, {}, tx);
      return branch;
    });
  }

  async update(actor: Actor, id: string, input: UpdateBranchInput): Promise<BranchRecord> {
    return runInTransaction(async (tx) => {
      if (!(await this.branches.findInBusiness(id, actor.businessId, tx))) throw AppError.notFound("Branch not found");
      if (input.name) await this.assertNameIsFree(actor.businessId, input.name, id, tx);
      await this.branches.updateBranch(id, actor.businessId, input, tx);
      await this.audit(actor, "branch.updated", id, { fields: Object.keys(input) }, tx);
      return (await this.branches.findInBusiness(id, actor.businessId, tx))!;
    });
  }

  /**
   * The branch a NEW record is filed under:
   * - an id: it must be an active branch of this business;
   * - null: no branch;
   * - undefined: the caller's home branch when they have an active one, else none.
   */
  async resolve(actor: Actor, requested: string | null | undefined, tx?: Tx): Promise<string | null> {
    if (requested === null) return null;
    if (requested !== undefined) {
      await this.assertActive(actor, requested, tx);
      return requested;
    }
    const membership = await this.members.findMembership(actor.businessId, actor.id, tx);
    if (!membership?.branchId) return null;
    const home = await this.branches.findInBusiness(membership.branchId, actor.businessId, tx);
    return home?.status === "active" ? home.id : null;
  }

  /** For updates: an explicitly given branch must be active; null and undefined pass. */
  async assertActive(actor: Actor, branchId: string | null | undefined, tx?: Tx): Promise<void> {
    if (!branchId) return;
    const branch = await this.branches.findInBusiness(branchId, actor.businessId, tx);
    if (!branch || branch.status !== "active") {
      throw AppError.unprocessable("Choose an active branch of your business", [
        { field: "branchId", message: "Not found" },
      ]);
    }
  }

  private async assertNameIsFree(businessId: string, name: string, exceptId: string | undefined, tx: Tx) {
    if (await this.branches.findByName(businessId, name, exceptId, tx)) {
      throw AppError.conflict("A branch with this name already exists", [{ field: "name", message: "duplicate" }]);
    }
  }

  private audit(actor: Actor, action: AuditAction, id: string, payload: Record<string, unknown>, tx: Tx) {
    return this.activity.audit(
      { businessId: actor.businessId, actorId: actor.id, action, entityType: "branch", entityId: id, payload },
      tx,
    );
  }
}
