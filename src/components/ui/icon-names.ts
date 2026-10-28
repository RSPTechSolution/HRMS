export const ICON_NAMES = [
  "home", "clock", "plane", "users", "wallet", "heart", "search", "bell", "moon", "sun",
  "check", "x", "arrow", "settings", "user", "logout", "inbox", "sparkle", "calendar",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
