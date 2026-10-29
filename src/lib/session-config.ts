export const SESSION_COOKIE = "lnp_session";
export const SESSION_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
export const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"] as const;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
