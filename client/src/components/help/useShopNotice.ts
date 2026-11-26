import { CalendarPlus, Landmark } from "lucide-react";
import { useSwitchOnBooking } from "../../hooks/useAccount";
import { useNotNow } from "../../hooks/useNotNow";
import { useWorkspace } from "../../hooks/useWorkspace";
import type { Notice } from "./HelpNotice";

/** What a published page is still missing. Only the owner can change these, so only the owner is asked. */
export function useShopNotice({ onAddBank }: { onAddBank: () => void }): Notice | null {
  const { business, can } = useWorkspace();
  const { kept } = useNotNow();
  const booking = useSwitchOnBooking();
  if (!can("business.update") || !business.pageEnabled) return null;

  const hasBank = Boolean(business.bankName && business.accountNumber && business.accountName);
  if (!hasBank && !kept.has("bank")) {
    return {
      icon: Landmark,
      title: "Your page doesn't show where to pay you",
      message: "Add your bank details so customers can send deposits and balances without asking.",
      action: { label: "Add bank details", run: onAddBank },
      later: ["bank"],
    };
  }
  if (!business.bookingEnabled && !kept.has("booking")) {
    return {
      icon: CalendarPlus,
      title: "Let customers ask for an appointment",
      message: "People on your page can ask for a time. Nothing is booked until you accept it.",
      action: { label: "Turn it on", run: () => booking.mutate(), busy: booking.isPending },
      later: ["booking"],
    };
  }
  return null;
}
