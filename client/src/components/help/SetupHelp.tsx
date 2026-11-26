import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShowDesignsDialog } from "../designs/ShowDesignsDialog";
import { BankDetailsDialog } from "./BankDetailsDialog";
import { HelpNotice } from "./HelpNotice";
import { useDesignNotice } from "./useDesignNotice";
import { useMeasurementNotice } from "./useMeasurementNotice";
import { useShopNotice } from "./useShopNotice";

/** The dashboard's helper: one thing at a time, so it never becomes a wall of reminders. */
export function SetupHelp() {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"designs" | "bank" | null>(null);
  const design = useDesignNotice({
    onShow: () => setDialog("designs"),
    onAddPhoto: (id) => navigate(`/designs?open=${id}`),
  });
  const measurement = useMeasurementNotice();
  const shop = useShopNotice({ onAddBank: () => setDialog("bank") });
  // Wait for the earlier ones to be known, so a later offer doesn't flash up and then be replaced.
  const notice = design.ready && measurement.ready ? (design.notice ?? measurement.notice ?? shop) : null;

  return (
    <>
      {notice && <HelpNotice notice={notice} />}
      {dialog === "designs" && <ShowDesignsDialog onClose={() => setDialog(null)} />}
      {dialog === "bank" && <BankDetailsDialog onClose={() => setDialog(null)} />}
    </>
  );
}

/** On the Customers page, for staff who don't have the dashboard. */
export function MeasurementHelp() {
  const { notice } = useMeasurementNotice();
  return notice && <HelpNotice notice={notice} />;
}
