import { cleanParams, http, wrapCall, wrapPage } from "../transport/http";
import type { ListParams } from "../types/api.types";
import type {
  Customer,
  CustomerInput,
  Measurement,
  MeasurementInput,
  MeasurementTemplate,
  PortalLink,
  TemplateInput,
} from "../types/customer.types";

export interface CustomerListParams extends ListParams {
  sort?: "recent" | "name";
}

export const customerEndpoints = {
  list: (params?: CustomerListParams) =>
    wrapPage<Customer>(() => http.get("/customers", { params: cleanParams(params) })),
  get: (id: string) => wrapCall<Customer>(() => http.get(`/customers/${id}`)),
  create: (input: CustomerInput) => wrapCall<Customer>(() => http.post("/customers", input)),
  update: (id: string, input: Partial<CustomerInput>) =>
    wrapCall<Customer>(() => http.patch(`/customers/${id}`, input)),
  remove: (id: string) => wrapCall<null>(() => http.delete(`/customers/${id}`)),
  createPortalLink: (id: string) => wrapCall<PortalLink>(() => http.post(`/customers/${id}/portal-link`)),
  revokePortalLink: (id: string) => wrapCall<null>(() => http.delete(`/customers/${id}/portal-link`)),
};

export const measurementEndpoints = {
  templates: () => wrapPage<MeasurementTemplate>(() => http.get("/measurement-templates", { params: { limit: 100 } })),
  createTemplate: (input: TemplateInput) =>
    wrapCall<MeasurementTemplate>(() => http.post("/measurement-templates", input)),
  updateTemplate: (id: string, input: Partial<TemplateInput>) =>
    wrapCall<MeasurementTemplate>(() => http.patch(`/measurement-templates/${id}`, input)),
  removeTemplate: (id: string) => wrapCall<null>(() => http.delete(`/measurement-templates/${id}`)),
  list: (customerId: string) =>
    wrapPage<Measurement>(() => http.get(`/customers/${customerId}/measurements`, { params: { limit: 50 } })),
  record: (customerId: string, input: MeasurementInput) =>
    wrapCall<Measurement>(() => http.post(`/customers/${customerId}/measurements`, input)),
  remove: (customerId: string, id: string) =>
    wrapCall<null>(() => http.delete(`/customers/${customerId}/measurements/${id}`)),
};
