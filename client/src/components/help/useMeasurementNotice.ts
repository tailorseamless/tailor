import { Ruler } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useCustomers, useMeasurementStatus } from "../../hooks/useCustomers";
import { useNotNow } from "../../hooks/useNotNow";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Notice } from "./HelpNotice";

/** For a business that has never recorded a measurement: takes them straight to the form. */
export function useMeasurementNotice(): { ready: boolean; notice: Notice | null } {
  const { can } = useWorkspace();
  const navigate = useNavigate();
  const guide = useOnboarding();
  const { kept } = useNotNow();
  const enabled = can("measurement.record") && !kept.has("measure");
  const status = useMeasurementStatus(enabled);
  const none = enabled && status.data?.recorded === false;
  const latest = useCustomers({ sort: "recent", page: 1, limit: 1 }, none);

  if (!enabled) return { ready: true, notice: null };
  // A failed check offers nothing, and mustn't hold back the offers that come after this one.
  if (!status.data) return { ready: status.isError, notice: null };
  if (!none) return { ready: true, notice: null };
  if (!latest.data) return { ready: latest.isError, notice: null };

  const customer = latest.data.data[0];
  if (customer) {
    return {
      ready: true,
      notice: {
        icon: Ruler,
        title: "Record your first measurement",
        message: `We'll open ${customer.fullName}'s page with the form ready. Type the numbers and save.`,
        action: {
          label: `Measure ${customer.fullName.split(" ")[0]}`,
          run: () => navigate(`/customers/${customer.id}?record=1`),
        },
        later: ["measure"],
      },
    };
  }
  // No one to measure yet. While the setup guide is open it is already asking for a first customer.
  if (guide.active || !can("customer.create")) return { ready: true, notice: null };
  return {
    ready: true,
    notice: {
      icon: Ruler,
      title: "Record your first measurement",
      message: "First add the person you want to measure. Only a name and phone number are needed.",
      action: { label: "Add a customer", run: () => navigate("/customers?new=1") },
      later: ["measure"],
    },
  };
}
