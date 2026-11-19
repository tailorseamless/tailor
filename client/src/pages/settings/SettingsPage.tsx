import { ChevronRight, Mail, Ruler, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BusinessSettings, type BusinessCards } from "../../components/settings/BusinessSettings";
import { DangerZone } from "../../components/settings/DangerZone";
import { GuideSettings } from "../../components/settings/GuideSettings";
import { DeviceSettings, NotificationSettings, ProfileSettings } from "../../components/settings/PersonalSettings";
import { Card, PageHeader } from "../../components/shared/Display";
import { TabPanel, Tabs } from "../../components/shared/Tabs";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useWorkspace } from "../../hooks/useWorkspace";

const PREFIX = "settings";

interface SettingsLink {
  to: string;
  label: string;
  note: string;
  icon: LucideIcon;
}

/** Links to the two settings screens that have a page of their own. */
function LinkCard({ links }: { links: SettingsLink[] }) {
  if (links.length === 0) return null;
  return (
    <Card>
      <ul className="divide-y divide-line">
        {links.map(({ to, label, note, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 px-4 py-3 text-sm text-fg hover:bg-subtle"
              data-cy={`settings-link-${to.split("/").pop()}`}
            >
              <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-fg-muted">{note}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Two columns on a wide screen, one on a phone. `grid-cols-1` lets a column shrink to the screen. */
function Columns({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <div className="space-y-5">{left}</div>
      {right && <div className="space-y-5">{right}</div>}
    </div>
  );
}

/**
 * Settings, one topic per tab so no tab is a long scroll. The tab is kept in the address (?tab=customers), so a
 * refresh, the Back button and links from other screens land in the right place.
 */
export default function SettingsPage() {
  const { can } = useWorkspace();
  const guide = useOnboarding();
  const [params, setParams] = useSearchParams();
  const owner = can("business.update");

  const templates: SettingsLink[] = can("measurement.read")
    ? [
        {
          to: "/settings/measurements",
          label: "Measurement templates",
          note: "The measurements you take for each kind of garment.",
          icon: Ruler,
        },
      ]
    : [];
  const emailLog: SettingsLink[] = can("email.read")
    ? [
        {
          to: "/settings/emails",
          label: "Email log",
          note: "What was emailed to your customers, and whether it arrived.",
          icon: Mail,
        },
      ]
    : [];

  // Only the owner can change the business, so only the owner gets those tabs. Everyone else would be left with a
  // tab holding one link: theirs go on the Account tab instead.
  const tabs = [
    { id: "business", label: "Business", show: owner },
    { id: "customers", label: "For customers", show: owner },
    { id: "account", label: "Account", show: true },
    { id: "guide", label: "Guide", show: guide.steps.length > 0 },
  ].filter((tab) => tab.show);
  const has = (id: string) => tabs.some((tab) => tab.id === id);
  const requested = params.get("tab");
  const active = tabs.some((tab) => tab.id === requested) ? (requested as string) : tabs[0].id;
  // The first tab is the default, so its address stays clean. `replace`: Back leaves settings, not the last tab.
  const select = (id: string) => setParams(id === tabs[0].id ? {} : { tab: id }, { replace: true });

  const panels = (cards: BusinessCards | null) => (
    <>
      {cards && (
        <TabPanel idPrefix={PREFIX} id="business" active={active === "business"}>
          <Columns left={cards.business} right={<LinkCard links={templates} />} />
        </TabPanel>
      )}
      {cards && (
        <TabPanel idPrefix={PREFIX} id="customers" active={active === "customers"}>
          <Columns
            left={
              <>
                {cards.page}
                {cards.emails}
              </>
            }
            right={
              <>
                {cards.account}
                <LinkCard links={emailLog} />
              </>
            }
          />
        </TabPanel>
      )}
      <TabPanel idPrefix={PREFIX} id="account" active={active === "account"}>
        <Columns
          left={
            <>
              <ProfileSettings />
              <DeviceSettings />
            </>
          }
          right={
            <>
              {!owner && <LinkCard links={[...templates, ...emailLog]} />}
              {can("notification.read") && <NotificationSettings />}
              <DangerZone />
            </>
          }
        />
      </TabPanel>
      {has("guide") && (
        <TabPanel idPrefix={PREFIX} id="guide" active={active === "guide"}>
          <div className="max-w-2xl">
            <GuideSettings />
          </div>
        </TabPanel>
      )}
    </>
  );

  return (
    <>
      <PageHeader title="Settings" />
      {/* One topic only? No need for a row of tabs. */}
      {tabs.length > 1 && (
        <div className="mb-5">
          <Tabs
            tabs={tabs}
            value={active}
            onChange={select}
            label="Settings sections"
            idPrefix={PREFIX}
            dataCy="settings-tab"
          />
        </div>
      )}
      {owner ? <BusinessSettings>{panels}</BusinessSettings> : panels(null)}
    </>
  );
}
