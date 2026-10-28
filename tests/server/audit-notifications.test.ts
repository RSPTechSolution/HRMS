import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listAudit, writeAudit } from "@/server/audit";
import { listNotifications, markAllRead, notifyEmployees, unreadCount } from "@/server/notifications";
import { makeEmployee, resetDb } from "../helpers/db";

describe("audit log", () => {
  beforeEach(resetDb);

  it("stores before/after as JSON and lists newest first", async () => {
    await writeAudit(db, { actorId: "u1", action: "settings.update", entityType: "Setting", entityId: "company.name", before: "A", after: "B" });
    await writeAudit(db, { actorId: null, action: "job.run", entityType: "Job", entityId: "x" });
    const rows = await listAudit({ entityType: "Setting" });
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].before!)).toBe("A");
    expect(JSON.parse(rows[0].after!)).toBe("B");
    expect((await listAudit({ entityType: "Job" }))[0].before).toBeNull();
  });

  it("rolls back with the surrounding transaction", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await writeAudit(tx, { actorId: "u1", action: "x", entityType: "T", entityId: "1" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.auditLog.count()).toBe(0);
  });
});

describe("notifications", () => {
  beforeEach(resetDb);

  it("notifies the users behind employee ids, once each", async () => {
    const a = await makeEmployee();
    const b = await makeEmployee();
    await notifyEmployees(db, [a.employee.id, a.employee.id, b.employee.id, "missing"], { kind: "test", title: "Hello", link: "/home" });
    expect(await unreadCount(a.user.id)).toBe(1);
    expect(await unreadCount(b.user.id)).toBe(1);
    const [n] = await listNotifications(a.user.id);
    expect(n).toMatchObject({ kind: "test", title: "Hello", link: "/home", readAt: null });
  });

  it("does nothing for an empty list", async () => {
    await notifyEmployees(db, [], { kind: "test", title: "x" });
    expect(await db.notification.count()).toBe(0);
  });

  it("marks everything read for one user only", async () => {
    const a = await makeEmployee();
    const b = await makeEmployee();
    await notifyEmployees(db, [a.employee.id, b.employee.id], { kind: "t", title: "One" });
    await notifyEmployees(db, [a.employee.id], { kind: "t", title: "Two" });
    await markAllRead(a.user.id);
    expect(await unreadCount(a.user.id)).toBe(0);
    expect(await unreadCount(b.user.id)).toBe(1);
  });
});
