import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("sends signed-out visitors to login with a next parameter", () => {
    const res = proxy(new NextRequest("http://localhost/profile"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login?next=%2Fprofile");
  });

  it("does not add next for the root path", () => {
    const res = proxy(new NextRequest("http://localhost/"));
    expect(res.headers.get("location")).toBe("http://localhost/login");
  });

  it.each(["/login", "/forgot-password", "/set-password"])("lets signed-out visitors open %s", (path) => {
    const res = proxy(new NextRequest(`http://localhost${path}`));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets cookie holders through and refreshes the cookie lifetime", () => {
    const res = proxy(new NextRequest("http://localhost/home", { headers: { cookie: "lnp_session=abc" } }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const c = res.cookies.get("lnp_session");
    expect(c?.value).toBe("abc");
    expect(c?.maxAge).toBe(30 * 24 * 60 * 60);
    expect(c?.httpOnly).toBe(true);
  });
});
