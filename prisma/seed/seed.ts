import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, dayLabel, istDateKey, istDateTime, weekdayOf } from "../../src/lib/dates";
import { clearAll } from "./clear";
import { APPROVAL_POLICIES, DEMO_PASSWORD, DEPARTMENTS, HOLIDAYS_2026, PEOPLE, RECENT_JOINERS, type SeedPerson } from "./data";
import { dayEvents, profileFor, randomFor, workingDaysBetween, type SeedEvent } from "./generate";

export function emailFor(p: SeedPerson): string {
  if (p.email) return p.email.toLowerCase();
  return `${p.name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@lnwebworks.test`;
}

export function joinedOnFor(index: number): string {
  return new Date(Date.UTC(2020, 3, 1) + index * 37 * 86_400_000).toISOString().slice(0, 10);
}

const WEEKEND = [0, 6];
const ATTENDANCE_DAYS = 90;

export async function seed(db: PrismaClient, now = new Date()): Promise<{ employees: number; attendanceEvents: number }> {
  await clearAll(db);
  const passwordHash = await hash(DEMO_PASSWORD);

  const deptIds = new Map<string, string>();
  for (const name of DEPARTMENTS) deptIds.set(name, (await db.department.create({ data: { name } })).id);

  const designationIds = new Map<string, string>();
  const levels: Record<string, number> = { "Chief Executive Officer": 10, "Engineering Manager": 7, "Design Lead": 7, "QA Lead": 7, "Sales Lead": 7, "HR Generalist": 6 };
  for (const title of [...new Set(PEOPLE.map((p) => p.designation))]) {
    const level = levels[title] ?? (/Senior|Lead/.test(title) ? 5 : /Associate|Analyst|Executive/.test(title) ? 2 : 3);
    designationIds.set(title, (await db.designation.create({ data: { title, level } })).id);
  }

  await db.holiday.createMany({ data: HOLIDAYS_2026 });

  const people: { id: string; code: string; name: string; joinedOn: string; status: string }[] = [];
  for (const [i, p] of PEOPLE.entries()) {
    const email = emailFor(p);
    const deptId = deptIds.get(p.dept);
    if (!deptId) throw new Error(`Unknown department "${p.dept}" for ${p.name}`);
    const code = `LNW-${String(i + 1).padStart(4, "0")}`;
    const recent = RECENT_JOINERS[p.name];
    const joinedOn = recent?.joinedOn ?? joinedOnFor(i);
    const e = await db.employee.create({
      data: {
        code,
        fullName: p.name,
        workEmail: email,
        designationId: designationIds.get(p.designation)!,
        status: p.status ?? "ACTIVE",
        joinedOn,
        probationEndsOn: recent?.probationEndsOn ?? null,
        employmentType: "FULL_TIME",
        location: "Mohali",
        departmentId: deptId,
        ...profileFor(p, i),
      },
    });
    people.push({ id: e.id, code, name: p.name, joinedOn, status: e.status });
    await db.user.create({ data: { email, passwordHash, employeeId: e.id, isHR: !!p.isHR, isPayroll: !!p.isPayroll, isAdmin: !!p.isAdmin } });
  }
  const idOf = (name: string) => people.find((p) => p.name === name)!.id;

  for (const p of PEOPLE) {
    if (!p.manager) continue;
    if (!people.some((x) => x.name === p.manager)) throw new Error(`Unknown manager "${p.manager}" for ${p.name}`);
    await db.employee.update({ where: { id: idOf(p.name) }, data: { managerId: idOf(p.manager) } });
  }

  for (const [type, steps] of Object.entries(APPROVAL_POLICIES)) {
    await db.approvalPolicy.create({ data: { type, steps: JSON.stringify(steps) } });
  }

  // Attendance: the last 90 days (IST) for everyone employed, plus some check-ins this morning.
  const today = istDateKey(now);
  const holidaySet = new Set(HOLIDAYS_2026.map((h) => h.date));
  const workDays = workingDaysBetween(addDays(today, -ATTENDANCE_DAYS), today, WEEKEND, holidaySet);
  const karan = people.find((p) => p.name === "Karan Joshi")!;
  let correctionDay = addDays(today, -2);
  while (WEEKEND.includes(weekdayOf(correctionDay)) || holidaySet.has(correctionDay)) correctionDay = addDays(correctionDay, -1);

  const events: SeedEvent[] = [];
  for (const p of people) {
    for (const date of workDays) {
      if (date < p.joinedOn) continue;
      if (p.id === karan.id && date === correctionDay) continue; // Karan "forgot" — his correction is pending
      events.push(...dayEvents(p.id, p.code, date));
    }
    const isWorkingToday = !WEEKEND.includes(weekdayOf(today)) && !holidaySet.has(today);
    if (isWorkingToday && p.name !== "Arjun Mehta" && randomFor(`${p.code}-today`)() < 0.6) {
      const at = new Date(istDateTime(today, "09:00").getTime() + Math.floor(randomFor(`${p.code}-in`)() * 70) * 60000);
      if (at < now) events.push({ employeeId: p.id, workDate: today, at, kind: "IN", source: "WEB" });
    }
  }
  for (let i = 0; i < events.length; i += 2000) await db.attendanceEvent.createMany({ data: events.slice(i, i + 2000) });

  // Karan's pending correction, waiting on Ananya (written directly: the seed can't use server-only code).
  const ananya = people.find((p) => p.name === "Ananya Sharma")!;
  const correction = await db.attendanceCorrection.create({
    data: {
      employeeId: karan.id,
      workDate: correctionDay,
      inAt: istDateTime(correctionDay, "09:30"),
      outAt: istDateTime(correctionDay, "18:30"),
      reason: "Forgot to check in after the client call",
    },
  });
  const summary = `${dayLabel(correctionDay)} · 09:30–18:30`;
  await db.approvalRequest.create({
    data: {
      type: "ATTENDANCE_CORRECTION",
      subjectId: correction.id,
      requesterId: karan.id,
      summary,
      steps: { create: [{ order: 0, role: "MANAGER", approverId: ananya.id }] },
    },
  });

  const userOf = async (email: string) => db.user.findUniqueOrThrow({ where: { email } });
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const [arjun, ananyaUser] = await Promise.all([userOf("employee@lnwebworks.test"), userOf("manager@lnwebworks.test")]);
  await db.notification.createMany({
    data: [
      { userId: arjun.id, kind: "welcome", title: "Welcome to LN People — your HR, all in one place", link: "/home", createdAt: minutesAgo(12) },
      { userId: arjun.id, kind: "kudos", title: "Rohit gave you kudos for the client call", link: "/home", createdAt: minutesAgo(65) },
      { userId: arjun.id, kind: "announcement", title: "Diwali celebration · Fri 6 Nov, 4 pm", createdAt: minutesAgo(60 * 26), readAt: minutesAgo(60 * 20) },
      { userId: ananyaUser.id, kind: "approval.pending", title: `Karan Joshi needs your approval · Attendance fix: ${summary}`, link: "/approvals", createdAt: minutesAgo(40) },
    ],
  });

  return { employees: PEOPLE.length, attendanceEvents: events.length };
}
