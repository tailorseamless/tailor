import * as Menu from "@radix-ui/react-dropdown-menu";
import { LifeBuoy, LogOut, MoreHorizontal, Plus, Settings } from "lucide-react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { OnboardingProvider, useOnboarding } from "../../contexts/OnboardingContext";
import { useWorkspace } from "../../hooks/useWorkspace";
import { cn } from "../../utils/cn";
import { GuideCoach } from "../onboarding/GuideCoach";
import { Logo } from "./AuthLayout";
import { NAV, homePath } from "./navItems";
import { NotificationBell } from "./NotificationBell";

const menuItem =
  "flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-fg outline-none data-[highlighted]:bg-subtle";

/** The signed-in app, with the getting-started guide available on every screen. */
export function AppShell() {
  return (
    <OnboardingProvider>
      <Shell />
    </OnboardingProvider>
  );
}

/** Sidebar on desktop; four bottom tabs plus "More" on phones. */
function Shell() {
  const { me, business, can } = useWorkspace();
  const { signOut } = useAuth();
  const guide = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV.filter((item) => can(item.permission));
  const tabs = items.filter((i) => i.primary).slice(0, 4);
  const more = items.filter((i) => !tabs.includes(i));
  const moreActive = more.some((i) => location.pathname.startsWith(i.to));
  // WhatsApp with a first line that says which business is asking (never anything about its customers).
  const supportLink = me.support?.whatsapp
    ? `https://wa.me/${me.support.whatsapp}?text=${encodeURIComponent(`Hello, I need help with Tailor Seamless (${business.name}).`)}`
    : null;
  const initials = me.user.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh bg-canvas md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-5">
          <Logo />
          <p className="mt-1 truncate text-xs text-fg-subtle" title={business.name}>
            {business.name}
          </p>
        </div>
        {can("order.create") && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => navigate("/orders/new")}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-on-brand hover:bg-brand-hover"
              data-cy="nav-new-order"
            >
              <Plus className="size-4" aria-hidden /> New order
            </button>
          </div>
        )}
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-cy={`nav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  isActive ? "bg-brand-soft font-medium text-link" : "text-fg-muted hover:bg-subtle hover:text-fg",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-8">
        <div className="min-w-0 md:hidden">
          <p className="truncate font-display font-semibold text-fg">{business.name}</p>
        </div>
        <div className="hidden md:block" />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Menu.Root>
            <Menu.Trigger
              className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-link"
              aria-label="Your account"
              data-cy="account-menu"
            >
              {initials || "?"}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-52 rounded-lg border border-line bg-surface p-1 shadow-pop"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-fg">{me.user.fullName}</p>
                  <p className="truncate text-xs text-fg-subtle">{me.user.email}</p>
                </div>
                <Menu.Separator className="my-1 h-px bg-line" />
                <Menu.Item onSelect={() => navigate("/settings")} className={menuItem} data-cy="menu-settings">
                  <Settings className="size-4" aria-hidden /> Settings
                </Menu.Item>
                {supportLink && (
                  <Menu.Item asChild className={menuItem}>
                    <a href={supportLink} target="_blank" rel="noopener noreferrer" data-cy="menu-support">
                      <LifeBuoy className="size-4" aria-hidden /> Contact support
                    </a>
                  </Menu.Item>
                )}
                <Menu.Item onSelect={() => void signOut()} className={menuItem} data-cy="menu-sign-out">
                  <LogOut className="size-4" aria-hidden /> Sign out
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-6xl px-4 pt-5 pb-28 md:px-8 md:pb-12",
          // Room to scroll the end of the page above the open guide (at most 45dvh tall on phones).
          guide.active && !guide.collapsed && "max-md:pb-[calc(45dvh+5.5rem)]",
        )}
      >
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            data-cy={`tab-${label.toLowerCase()}`}
            className={({ isActive }) =>
              cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
                isActive ? "font-medium text-link" : "text-fg-subtle",
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
        {more.length > 0 && (
          <Menu.Root>
            <Menu.Trigger
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
                moreActive ? "font-medium text-link" : "text-fg-subtle",
              )}
              data-cy="tab-more"
            >
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                side="top"
                align="end"
                sideOffset={8}
                className="z-50 min-w-48 rounded-lg border border-line bg-surface p-1 shadow-pop"
              >
                {more.map(({ to, label, icon: Icon }) => (
                  <Menu.Item
                    key={to}
                    onSelect={() => navigate(to)}
                    className={menuItem}
                    data-cy={`more-${label.toLowerCase()}`}
                  >
                    <Icon className="size-4" aria-hidden /> {label}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
      </nav>
      <GuideCoach />
    </div>
  );
}

/** "/" → the right first screen for this person's role. */
export function HomeRedirect() {
  const { can } = useWorkspace();
  return <Navigate to={homePath(can)} replace />;
}
