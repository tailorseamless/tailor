import { useAuth } from "../contexts/AuthContext";
import type { Me } from "../types/auth.types";

/** The signed-in business. Only for screens behind RequireAuth, where `me` is always loaded. */
export function useWorkspace() {
  const { me, can } = useAuth();
  if (!me) throw new Error("useWorkspace used outside a signed-in screen");
  const business: Me["business"] = me.business;
  return { me, business, timeZone: business.timeZone, currency: business.currency, can };
}
