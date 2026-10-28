import { afterEach, describe, expect, it, vi } from "vitest";
import { outbox, sendMail } from "@/server/mail/mailer";

const msg = { to: "a@lnwebworks.test", subject: "Reset", text: "token=secret" };

describe("sendMail transport choice", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    outbox.length = 0;
  });

  it("collects mail in tests", async () => {
    await sendMail(msg);
    expect(outbox).toEqual([msg]);
  });

  it("refuses to log mail in production unless explicitly asked", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendMail(msg)).rejects.toThrow("No mail transport is configured");
    expect(log).not.toHaveBeenCalled();
  });

  it("logs to the console in development or when MAIL_TRANSPORT=console", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");
    await sendMail(msg);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MAIL_TRANSPORT", "console");
    await sendMail(msg);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
