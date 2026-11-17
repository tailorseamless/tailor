import { customerEndpoints, measurementEndpoints, type CustomerListParams } from "../endpoints/customer.endpoints";
import type { CustomerInput, MeasurementInput, TemplateInput } from "../types/customer.types";
import { keys } from "./queryKeys";
import { useApiMutation, useApiQuery, usePaginatedQuery } from "./useApi";

export function useCustomers(params: CustomerListParams, enabled = true) {
  return usePaginatedQuery(keys.customers.list(params), () => customerEndpoints.list(params), { enabled });
}

export function useCustomer(id: string | undefined) {
  return useApiQuery(keys.customers.detail(id ?? ""), () => customerEndpoints.get(id as string), {
    enabled: Boolean(id),
  });
}

/** The form shows the duplicate-phone 409 itself, so errors aren't toasted. */
export function useCreateCustomer() {
  return useApiMutation((input: CustomerInput) => customerEndpoints.create(input), {
    invalidate: [keys.customers.all, ["dashboard"]],
    success: (c) => `${c.fullName} added`,
    toastError: false,
  });
}

export function useUpdateCustomer(id: string) {
  return useApiMutation((input: Partial<CustomerInput>) => customerEndpoints.update(id, input), {
    invalidate: [keys.customers.all],
    success: "Customer saved",
    toastError: false,
  });
}

export function useDeleteCustomer() {
  return useApiMutation((id: string) => customerEndpoints.remove(id), {
    invalidate: [keys.customers.all, ["dashboard"]],
    success: "Customer removed",
  });
}

export function usePortalLink(customerId: string) {
  const create = useApiMutation(() => customerEndpoints.createPortalLink(customerId), {
    invalidate: [keys.customers.detail(customerId)],
  });
  const revoke = useApiMutation(() => customerEndpoints.revokePortalLink(customerId), {
    invalidate: [keys.customers.detail(customerId)],
    success: "The old link no longer works",
  });
  return { create, revoke };
}

export function useMeasurementTemplates() {
  return useApiQuery(keys.measurements.templates, () => measurementEndpoints.templates(), { staleTime: 5 * 60_000 });
}

export function useTemplateActions() {
  const after = { invalidate: [keys.measurements.templates] };
  const create = useApiMutation((input: TemplateInput) => measurementEndpoints.createTemplate(input), {
    ...after,
    success: "Template added",
    toastError: false,
  });
  const update = useApiMutation(
    (vars: { id: string; input: Partial<TemplateInput> }) => measurementEndpoints.updateTemplate(vars.id, vars.input),
    { ...after, success: "Template saved", toastError: false },
  );
  const remove = useApiMutation((id: string) => measurementEndpoints.removeTemplate(id), {
    ...after,
    success: "Template deleted",
  });
  return { create, update, remove };
}

export function useMeasurements(customerId: string) {
  return useApiQuery(keys.measurements.forCustomer(customerId), () => measurementEndpoints.list(customerId), {
    enabled: Boolean(customerId),
  });
}

export function useRecordMeasurement(customerId: string) {
  return useApiMutation((input: MeasurementInput) => measurementEndpoints.record(customerId, input), {
    invalidate: [keys.measurements.forCustomer(customerId)],
    success: "Measurements saved",
    toastError: false,
  });
}

export function useDeleteMeasurement(customerId: string) {
  return useApiMutation((id: string) => measurementEndpoints.remove(customerId, id), {
    invalidate: [keys.measurements.forCustomer(customerId)],
    success: "Measurement removed",
  });
}
