import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useToast } from "../contexts/ToastContext";
import { errorMessage } from "../utils/errors";

type QueryOpts<T> = Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn">;

/** The only way screens read from the API: a key, a loader, options. */
export function useApiQuery<T>(key: QueryKey, fn: () => Promise<T>, options: QueryOpts<T> = {}) {
  return useQuery<T, Error, T, QueryKey>({ queryKey: key, queryFn: fn, ...options });
}

/** Same, but keeps the last page on screen while the next one loads. */
export function usePaginatedQuery<T>(key: QueryKey, fn: () => Promise<T>, options: QueryOpts<T> = {}) {
  return useQuery<T, Error, T, QueryKey>({ queryKey: key, queryFn: fn, placeholderData: keepPreviousData, ...options });
}

interface MutationOpts<TVars, TResult> {
  /** Query keys to refetch once it works. */
  invalidate?: QueryKey[] | ((result: TResult, vars: TVars) => QueryKey[]);
  /** A toast on success; omit to stay quiet. */
  success?: string | ((result: TResult, vars: TVars) => string);
  /** Set false when the screen shows the error itself (e.g. a form's field errors). */
  toastError?: boolean;
  onSuccess?: (result: TResult, vars: TVars) => void;
}

/** Writes: refetches what changed, toasts the result. Screens handle field errors via `mutation.error`. */
export function useApiMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: MutationOpts<TVars, TResult> = {},
) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation<TResult, Error, TVars>({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      const keys = typeof opts.invalidate === "function" ? opts.invalidate(result, vars) : (opts.invalidate ?? []);
      await Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(result, vars) : opts.success);
      opts.onSuccess?.(result, vars);
    },
    onError: (err) => {
      if (opts.toastError !== false) toast.error(errorMessage(err));
    },
  });
}
