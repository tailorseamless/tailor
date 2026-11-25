import {
  BarChart3,
  Boxes,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  Palette,
  Receipt,
  Scissors,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "../../types/auth.types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  /** Shown as a bottom tab on phones (the rest go under "More"). */
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, permission: "dashboard.read", primary: true },
  { to: "/orders", label: "Orders", icon: Scissors, permission: "order.read", primary: true },
  { to: "/customers", label: "Customers", icon: Users, permission: "customer.read", primary: true },
  { to: "/appointments", label: "Diary", icon: CalendarDays, permission: "appointment.read", primary: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks, permission: "task.read" },
  { to: "/designs", label: "Designs", icon: Palette, permission: "design.read" },
  { to: "/inventory", label: "Materials", icon: Boxes, permission: "inventory.read" },
  { to: "/expenses", label: "Expenses", icon: Receipt, permission: "expense.read" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "report.read" },
  { to: "/team", label: "Team", icon: UserCog, permission: "team.read" },
  { to: "/admin", label: "Platform", icon: ShieldCheck, permission: "admin.read" },
  { to: "/settings", label: "Settings", icon: Settings, permission: "profile.update" },
];

/** Where "/" goes: the dashboard for people who can see money, otherwise the orders list. */
export function homePath(can: (permission: Permission) => boolean): string {
  return can("dashboard.read") ? "/dashboard" : "/orders";
}
