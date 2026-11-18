import { businessEndpoints, authEndpoints } from "../endpoints/auth.endpoints";
import { branchEndpoints, designEndpoints, teamEndpoints } from "../endpoints/workspace.endpoints";
import type {
  BranchInput,
  DesignFilters,
  DesignInput,
  TeamMemberInput,
  TeamMemberUpdate,
} from "../types/workspace.types";
import { uploadInBatches } from "../utils/pictures";
import { keys } from "./queryKeys";
import { useApiMutation, useApiQuery, usePaginatedQuery } from "./useApi";

const team = ["team"] as const;
const branches = ["branches"] as const;
const designs = ["designs"] as const;

/** Everyone in the business; also used to pick who a task goes to. */
export function useTeam(params: { search?: string; page?: number; limit?: number } = {}, enabled = true) {
  return usePaginatedQuery([...team, params], () => teamEndpoints.list(params), { enabled });
}

export function useTeamActions() {
  const add = useApiMutation((input: TeamMemberInput) => teamEndpoints.add(input), {
    invalidate: [team],
    success: (m) => `${m.fullName} added. We've emailed them an invitation.`,
    toastError: false,
  });
  const update = useApiMutation(
    (vars: { userId: string; input: TeamMemberUpdate }) => teamEndpoints.update(vars.userId, vars.input),
    { invalidate: [team], success: "Team member saved", toastError: false },
  );
  const remove = useApiMutation((userId: string) => teamEndpoints.remove(userId), {
    invalidate: [team],
    success: "Removed from the team",
  });
  const resend = useApiMutation((userId: string) => teamEndpoints.resendInvitation(userId), {
    success: "Invitation sent again",
  });
  return { add, update, remove, resend };
}

export function useBranches(enabled = true) {
  return useApiQuery(branches, () => branchEndpoints.list(), { enabled, staleTime: 5 * 60_000 });
}

export function useBranchActions() {
  const create = useApiMutation((input: BranchInput) => branchEndpoints.create(input), {
    invalidate: [branches],
    success: "Branch added",
    toastError: false,
  });
  const update = useApiMutation(
    (vars: { id: string; input: BranchInput }) => branchEndpoints.update(vars.id, vars.input),
    {
      invalidate: [branches, team],
      success: "Branch saved",
      toastError: false,
    },
  );
  return { create, update };
}

export function useDesigns(params: DesignFilters) {
  return usePaginatedQuery([...designs, "list", params], () => designEndpoints.list(params));
}

export function useDesignCategories() {
  return useApiQuery([...designs, "categories"], () => designEndpoints.categories(), { staleTime: 5 * 60_000 });
}

export function useDesign(id: string | null) {
  return useApiQuery([...designs, "detail", id], () => designEndpoints.get(id as string), { enabled: Boolean(id) });
}

export function useDesignActions() {
  const create = useApiMutation((input: DesignInput) => designEndpoints.create(input), {
    invalidate: [designs],
    success: "Design added",
    toastError: false,
  });
  // Create and add pictures in one go. The server takes 5 pictures per request, so they go in batches.
  // If a batch fails the design still exists, so the result says how far it got instead of throwing.
  const createWithPictures = useApiMutation(
    async (vars: { input: DesignInput; files: File[] }) => {
      const design = await designEndpoints.create(vars.input);
      const { uploaded, uploadError } = await uploadInBatches(vars.files, (batch) =>
        designEndpoints.addImages(design.id, batch),
      );
      return { design, uploaded, uploadError };
    },
    { invalidate: [designs], toastError: false },
  );
  const update = useApiMutation(
    (vars: { id: string; input: DesignInput }) => designEndpoints.update(vars.id, vars.input),
    {
      invalidate: [designs],
      toastError: false,
    },
  );
  const remove = useApiMutation((id: string) => designEndpoints.remove(id), {
    invalidate: [designs],
    success: "Design deleted",
  });
  const addImages = useApiMutation(
    (vars: { id: string; files: File[] }) => designEndpoints.addImages(vars.id, vars.files),
    {
      invalidate: [designs],
      success: "Pictures added",
    },
  );
  const removeImage = useApiMutation(
    (vars: { id: string; imageId: string }) => designEndpoints.removeImage(vars.id, vars.imageId),
    { invalidate: [designs], success: "Picture removed" },
  );
  return { create, createWithPictures, update, remove, addImages, removeImage };
}

/** Scheduling deletion of the person's account or the whole business; both can be cancelled. */
export function useDeletion() {
  const after = { invalidate: [keys.me, keys.business] };
  return {
    requestAccount: useApiMutation(() => authEndpoints.requestAccountDeletion(), {
      ...after,
      success: "Account deletion scheduled",
    }),
    cancelAccount: useApiMutation(() => authEndpoints.cancelAccountDeletion(), {
      ...after,
      success: "Account deletion cancelled",
    }),
    requestBusiness: useApiMutation((confirmName: string) => businessEndpoints.requestDeletion(confirmName), {
      ...after,
      success: "Business deletion scheduled",
      toastError: false,
    }),
    cancelBusiness: useApiMutation(() => businessEndpoints.cancelDeletion(), {
      ...after,
      success: "Business deletion cancelled",
    }),
  };
}
