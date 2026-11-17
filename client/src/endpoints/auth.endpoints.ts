import { http, wrapCall } from "../transport/http";
import type { Business, BusinessInput, Me, RegisterInput } from "../types/auth.types";

export const authEndpoints = {
  me: () => wrapCall<Me>(() => http.get("/auth/me")),
  register: (input: RegisterInput) => wrapCall<Me>(() => http.post("/auth/register", input)),
  updateProfile: (input: { fullName?: string; phone?: string | null; timeZone?: string }) =>
    wrapCall<Me["user"]>(() => http.patch("/users/me", input)),
  requestAccountDeletion: () => wrapCall<unknown>(() => http.post("/users/me/deletion")),
  cancelAccountDeletion: () => wrapCall<unknown>(() => http.delete("/users/me/deletion")),
};

export const businessEndpoints = {
  get: () => wrapCall<Business>(() => http.get("/businesses/me")),
  update: (input: BusinessInput) => wrapCall<Business>(() => http.patch("/businesses/me", input)),
  requestDeletion: (confirmName: string) =>
    wrapCall<unknown>(() => http.post("/businesses/me/deletion", { confirmName })),
  cancelDeletion: () => wrapCall<unknown>(() => http.delete("/businesses/me/deletion")),
};
