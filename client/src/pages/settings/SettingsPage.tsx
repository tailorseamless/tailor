import { ChevronRight, Mail, Ruler } from "lucide-react";
import { Link } from "react-router-dom";
import { BusinessSettings } from "../../components/settings/BusinessSettings";
import { DangerZone } from "../../components/settings/DangerZone";
import { GuideSettings } from "../../components/settings/GuideSettings";
import { DeviceSettings, NotificationSettings, ProfileSettings } from "../../components/settings/PersonalSettings";
import { Card, PageHeader } from "../../components/shared/Display";
import { useWorkspace } from "../../hooks/useWorkspace";

export default function SettingsPage() {
  const { can } = useWorkspace();
  const links = [
    { to: "/settings/measurements", label: "Measurement templates", icon: Ruler, show: can("measurement.read") },
    { to: "/settings/emails", label: "Email log", icon: Mail, show: can("email.read") },
  ].filter((l) => l.show);

  return (
    <>
      <PageHeader title="Settings" />
      {/* grid-cols-1 lets the column shrink to the screen; without it a wide table inside stretches the whole page. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <GuideSettings />
          {can("business.update") ? <BusinessSettings /> : <ProfileSettings />}
          {links.length > 0 && (
            <Card>
              <ul className="divide-y divide-line">
                {links.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-fg hover:bg-subtle"
                      data-cy={`settings-link-${to.split("/").pop()}`}
                    >
                      <Icon className="size-4 text-fg-subtle" aria-hidden />
                      <span className="flex-1">{label}</span>
                      <ChevronRight className="size-4 text-fg-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          {can("business.update") && <ProfileSettings />}
          {can("notification.read") && <NotificationSettings />}
          <DeviceSettings />
          <DangerZone />
        </div>
      </div>
    </>
  );
}
