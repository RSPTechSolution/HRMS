import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getShellView } from "@/server/shell";
import { makeEmployee, resetDb } from "../helpers/db";

describe("getShellView", () => {
  beforeEach(resetDb);

  it("returns newest notifications with relative times and the unread count", async () => {
    const { user } = await makeEmployee();
    const now = new Date("2026-10-28T10:00:00Z");
    await db.notification.createMany({
      data: [
        { userId: user.id, kind: "a", title: "Older", createdAt: new Date("2026-10-28T07:00:00Z"), readAt: now },
        { userId: user.id, kind: "b", title: "Newer", link: "/home", createdAt: new Date("2026-10-28T09:48:00Z") },
      ],
    });
    expect(await getShellView(user.id, now)).toEqual({
      unread: 1,
      items: [
        { id: expect.any(String), title: "Newer", link: "/home", ago: "12 min ago", read: false },
        { id: expect.any(String), title: "Older", link: null, ago: "3 h ago", read: true },
      ],
    });
  });
});
