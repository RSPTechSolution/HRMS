import { NextResponse, type NextRequest } from "next/server";
import { PUBLIC_PATHS, SESSION_COOKIE, SESSION_COOKIE_MAX_AGE_S, sessionCookieOptions } from "@/lib/session-config";

/** Optimistic check only: real authorisation happens on the server for every page and action. */
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!token && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (token) res.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, maxAge: SESSION_COOKIE_MAX_AGE_S });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
