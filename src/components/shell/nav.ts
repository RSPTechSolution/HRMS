import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import type { IconName } from "@/components/ui/icon-names";

export type NavLink = { href: string; label: string; icon: IconName; badge?: number };

export function navFor(user: CurrentUser, approvalsWaiting = 0): NavLink[] {
  const links: NavLink[] = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/attendance", label: "Attendance", icon: "clock" },
    { href: "/people", label: "People", icon: "users" },
    { href: "/approvals", label: "Approvals", icon: "inbox", ...(approvalsWaiting > 0 ? { badge: approvalsWaiting } : {}) },
  ];
  if (user.isManager || user.isHR || user.isAdmin) links.push({ href: "/reports/attendance", label: "Reports", icon: "chart" });
  links.push({ href: "/profile", label: "My profile", icon: "user" });
  if (can(user, "settings.manage")) links.push({ href: "/settings", label: "Settings", icon: "settings" });
  return links;
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
