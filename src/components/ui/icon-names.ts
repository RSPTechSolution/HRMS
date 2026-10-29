export const ICON_NAMES = [
  "home", "clock", "plane", "users", "wallet", "heart", "search", "bell", "moon", "sun",
  "check", "x", "arrow", "settings", "user", "logout", "inbox", "sparkle", "calendar", "chart", "org", "file",
  "upload", "edit", "plus", "left", "right", "download", "coffee", "login", "play",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
