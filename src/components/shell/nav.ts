import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import type { IconName } from "@/components/ui/icon-names";

export type NavLink = { href: string; label: string; icon: IconName };

export function navFor(user: CurrentUser): NavLink[] {
  const links: NavLink[] = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/profile", label: "My profile", icon: "user" },
  ];
  if (can(user, "settings.manage")) links.push({ href: "/settings", label: "Settings", icon: "settings" });
  return links;
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
