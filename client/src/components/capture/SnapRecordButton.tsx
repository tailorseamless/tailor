import { Camera } from "lucide-react";
import { useAiStatus } from "../../hooks/useAi";
import { useWorkspace } from "../../hooks/useWorkspace";
import { ButtonLink } from "../shared/Button";

/**
 * The way in to Snap a record. Shown only to people who can add customers, and only once AI is switched on:
 * a button that leads nowhere would just confuse. With today's allowance used up it still shows, so the page
 * can say when it's back.
 */
export function SnapRecordButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const { can } = useWorkspace();
  const allowed = can("customer.create");
  const status = useAiStatus("record_capture", allowed);
  if (!allowed || !status.data) return null;
  if (!status.data.available && status.data.dailyLimit === 0) return null;
  if (!status.data.available && !status.data.providerLabel) return null;
  return (
    <ButtonLink to="/capture" variant={variant} icon={<Camera className="size-4" aria-hidden />} data-cy="snap-record">
      Snap a record
    </ButtonLink>
  );
}
