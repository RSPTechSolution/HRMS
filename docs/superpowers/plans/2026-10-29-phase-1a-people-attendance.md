# Phase 1a — People & Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give LN People its first real features: an employee directory with profiles, documents and an org chart; HR employee management; flexible-hours attendance with check-in/break/check-out, a month calendar, corrections through the approval engine, a team board and a monthly report; an approvals inbox; and the prototype's home dashboard (clock card, KPIs, hours chart, team today).

**Architecture:** Same layering as Phase 0 — pure rules in `src/domain/**`, Prisma only in `src/server/**`, pages/components never touch the DB. Attendance status is computed by one pure function from events + calendar + settings, so past days, today and the month view all agree; `AttendanceDay` rows are a cache rewritten whenever a day's events change. Corrections are the first real approval type and register hooks with the Phase 0 engine.

**Tech Stack:** Next.js 16.4.3 (App Router, Server Actions, Route Handlers), React 19.3, TypeScript 5, Prisma 7.10.1 + SQLite (better-sqlite3 adapter), zod 4, Vitest 5, Playwright 1.64 — all already installed. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-ln-people-hrms-design.md` — §5 Employees & org, §5.3 Documents, §6 Attendance, §4.3 approvals inbox, §9 dashboard (attendance parts), §13 assumptions 1–3 and 12. Visual reference: `.superpowers/brainstorm/307-1793173977/content/app-v2.html` (Home, Attendance and Team pages).

**Scope (what 1a does not do):** leave, WFH and the holiday *admin* UI are Phase 1b — 1a adds the `Holiday` table and seeds 2026 holidays because day status needs them, and `computeDayStatus` already accepts a leave input that 1b will fill. Announcements, kudos, birthdays and anniversaries are Phase 1c. Profile photos stay initials avatars.

## Global Constraints

- Everything in Phase 0's Global Constraints still applies (`docs/superpowers/plans/2026-10-28-phase-0-foundation.md`): pinned versions, Next 16 conventions (`proxy.ts`, async `cookies()`/`params`/`searchParams`), Prisma 7 import path `@/generated/prisma/client`, layering, string-literal status types, lowercase emails, plain-English copy, prototype tokens and motion rules, the commit trailer.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing Route Handlers (`01-app/03-api-reference/03-file-conventions/route.md`) or upload actions.
- Business timezone `Asia/Kolkata`; calendar dates are `YYYY-MM-DD` strings in IST; instants are UTC `DateTime`; durations are integer minutes.
- Settings come from `getSettings()`: `work.weekendDays` (0 = Sunday), `attendance.requiredDailyMinutes` (540), `attendance.halfDayMinutes` (270), `attendance.correctionWindowDays` (30). Never hard-code these.
- Schema changes that drop or rename a column: generate with `npx prisma migrate dev --create-only --name <name>`, review the SQL, apply with `npx prisma migrate deploy`, then `npx prisma generate`. Never `migrate reset` / `db push --force-reset`.
- Uploads: PDF, JPG, PNG only, ≤ 10 MB, type checked by magic bytes (not the browser's MIME type). Files live under `storage/` (git-ignored), never under `public/`, and are served only through `/api/files/[id]` after a permission check with `X-Content-Type-Options: nosniff`.
- `next.config.ts` sets `experimental.serverActions.bodySizeLimit: "12mb"` and `experimental.proxyClientMaxBodySize: "12mb"` (10 MB file + multipart overhead).
- Sensitive employee fields (bank account, PAN, Aadhaar) are never included in data sent to a client component unless the viewer may see them; masked values keep only the last 4 characters.
- Managers see their direct **and indirect** reports (spec §13.12). HR and Admin see everyone. Payroll sees everyone's job and bank details.
- E2E server runs with `MAIL_TRANSPORT=console` so creating employees can send set-password mail.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Sessions across midnight and forgotten check-outs** — a session started 23:00 IST and ended 01:00 belongs to the day it started; a session left open for more than 16 hours is abandoned (the old day becomes `MISSING_CHECKOUT`) and the next check-in starts a fresh day instead of being refused. Pinned in Task 6.
2. **Double clicks and invalid buttons** — pressing Check in twice, or Break while checked out, never writes a second event; two simultaneous check-ins produce one `IN`. Pinned in Task 6.
3. **Peeking at other teams** — a manager can open the attendance and personal details of their reports only; any other employee's profile URL shows the public card, and the month view refuses. Pinned in Task 4 and Task 6.
4. **Sensitive data leaking to the browser** — PAN, Aadhaar and bank details never appear in the directory payload or in a non-HR profile payload (masked for self). Pinned in Task 4.
5. **Bad corrections** — corrections for today, a future date, outside the 30-day window, with out ≤ in, or a second open correction for the same day are refused; an approved correction replaces that day's events and recomputes it. Pinned in Task 7.

---

## File Map

```
prisma/schema.prisma                          + Designation, Holiday, AttendanceEvent, AttendanceDay, AttendanceCorrection, Document; Employee fields
prisma/seed/{data,seed,clear}.ts              extended (designations, profile data, holidays, 90 days of attendance, a pending correction)
next.config.ts                                upload size limits
src/lib/dates.ts                              IST calendar helpers
src/domain/people/{types,schemas,access,hierarchy}.ts
src/domain/attendance/{types,state,summary,status}.ts
src/domain/attendance/corrections.ts          correction validation
src/domain/documents/files.ts                 type sniffing + limits
src/server/people/{employees,directory,structure}.ts
src/server/attendance/{record,views,team,close-day,corrections,report}.ts
src/server/documents/{store,documents}.ts
src/server/approvals/types.ts                 imports every module that registers an approval type
src/jobs/close-attendance-day.ts              npm run jobs:close-day
src/app/api/files/[id]/route.ts
src/app/api/reports/attendance/route.ts       CSV
src/app/(app)/home/page.tsx                   rebuilt dashboard
src/app/(app)/attendance/{page,team/page,actions}.tsx|ts
src/app/(app)/people/{page,[id]/page,new/page,structure/page,org/page,actions}.tsx|ts
src/app/(app)/approvals/{page,actions}.tsx|ts
src/app/(app)/reports/attendance/page.tsx
src/components/attendance/{ClockCard,MonthCalendar,HoursChart,Timeline,CorrectionForm}.tsx
src/components/people/{PersonCard,EmployeeForm,DocumentsPanel,OrgTree}.tsx
src/components/approvals/ApprovalRow.tsx
tests/lib/dates.test.ts, tests/domain/{people,attendance,corrections,files}.test.ts,
tests/server/{employees,attendance,corrections,report,documents}.test.ts, tests/e2e/{attendance,people}.spec.ts
```

---

### Task 1: IST calendar helpers

**Files:**
- Create: `src/lib/dates.ts`
- Test: `tests/lib/dates.test.ts`

**Interfaces:**
- Produces: `istDateKey(d: Date): string` (YYYY-MM-DD in IST) · `istTimeLabel(d: Date): string` ("09:42") · `addDays(key: string, n: number): string` · `weekdayOf(key: string): number` (0 = Sun) · `daysOfMonth(year: number, month: number): string[]` (month 1–12) · `istStartOfDay(key: string): Date` (UTC instant of 00:00 IST) · `istDateTime(key: string, hhmm: string): Date` · `monthOf(key: string): { year: number; month: number }` · `minutesBetween(a: Date, b: Date): number` (floored).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/dates.test.ts
import { describe, expect, it } from "vitest";
import { addDays, daysOfMonth, istDateKey, istDateTime, istStartOfDay, istTimeLabel, minutesBetween, monthOf, weekdayOf } from "@/lib/dates";

describe("IST dates", () => {
  it("uses the IST calendar day, not UTC", () => {
    expect(istDateKey(new Date("2026-10-28T18:29:00Z"))).toBe("2026-10-28"); // 23:59 IST
    expect(istDateKey(new Date("2026-10-28T18:31:00Z"))).toBe("2026-10-29"); // 00:01 IST
  });
  it("formats IST clock times", () => {
    expect(istTimeLabel(new Date("2026-10-28T04:12:00Z"))).toBe("09:42");
  });
  it("does calendar arithmetic across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(weekdayOf("2026-10-28")).toBe(3);
    expect(daysOfMonth(2026, 2)).toHaveLength(28);
    expect(daysOfMonth(2026, 10)[0]).toBe("2026-10-01");
    expect(monthOf("2026-10-28")).toEqual({ year: 2026, month: 10 });
  });
  it("converts IST wall-clock times to instants", () => {
    expect(istStartOfDay("2026-10-28").toISOString()).toBe("2026-10-27T18:30:00.000Z");
    expect(istDateTime("2026-10-28", "09:30").toISOString()).toBe("2026-10-28T04:00:00.000Z");
    expect(minutesBetween(new Date("2026-10-28T04:00:00Z"), new Date("2026-10-28T13:00:59Z"))).toBe(540);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/lib/dates.test.ts` — Expected: FAIL, cannot resolve `@/lib/dates`.

- [ ] **Step 3: Implement `src/lib/dates.ts`** — IST is a fixed +05:30 offset (no DST), so convert by adding/subtracting 330 minutes and using UTC getters; `addDays`/`weekdayOf`/`daysOfMonth` work on `Date.UTC` values. No external library.

- [ ] **Step 4: Run** the test — Expected: PASS.

- [ ] **Step 5: Commit** `feat: add IST calendar helpers`.

---

### Task 2: Schema for people, attendance and documents

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed/clear.ts`, `prisma/seed/seed.ts` (designation linkage only), `tests/helpers/db.ts`, `next.config.ts`
- Test: `tests/server/db.test.ts` (extend)

**Interfaces:**
- Produces (Prisma models, all ids `cuid()`):
  - `Designation { id, title @unique, level Int @default(1), employees Employee[] }`
  - `Employee` gains: `designationId String?` (relation, replaces the `designation` text column), `preferredName String?`, `personalEmail String?`, `phone String?`, `dateOfBirth String?` (YYYY-MM-DD), `gender String?`, `bloodGroup String?`, `probationEndsOn String?`, `employmentType String @default("FULL_TIME")` (`FULL_TIME | INTERN | CONTRACT`), `location String @default("Mohali")`, `currentAddress String?`, `permanentAddress String?`, `emergencyName String?`, `emergencyRelation String?`, `emergencyPhone String?`, `bankHolder String?`, `bankAccount String?`, `bankIfsc String?`, `pan String?`, `aadhaar String?`, `showBirthday Boolean @default(true)`, plus relations to the models below.
  - `Holiday { id, date String @unique, name String }`
  - `AttendanceEvent { id, employeeId, workDate String, at DateTime, kind String /* IN|OUT|BREAK_START|BREAK_END */, source String /* WEB|CORRECTION|SYSTEM */, createdAt; @@index([employeeId, workDate]) @@index([employeeId, at]) }`
  - `AttendanceDay { id, employeeId, workDate String, firstInAt DateTime?, lastOutAt DateTime?, workedMinutes Int @default(0), breakMinutes Int @default(0), status String, flags String @default("[]"), updatedAt; @@unique([employeeId, workDate]) }`
  - `AttendanceCorrection { id, employeeId, workDate String, inAt DateTime, outAt DateTime, breakStartAt DateTime?, breakEndAt DateTime?, reason String, status String @default("PENDING"), createdAt; @@index([employeeId, workDate]) }`
  - `Document { id, employeeId, category String, fileName String, mimeType String, size Int, storageKey String @unique, uploadedById String, verifiedAt DateTime?, verifiedById String?, createdAt }`
  - `clearAll` deletes the new tables before `user`/`employee`; `makeEmployee` sets no designation (nullable).

- [ ] **Step 1: Extend the harness test** — add to `tests/server/db.test.ts`:

```ts
  it("stores attendance and documents for an employee and clears them", async () => {
    const { employee } = await makeEmployee();
    const designation = await db.designation.create({ data: { title: "Engineer", level: 2 } });
    await db.employee.update({ where: { id: employee.id }, data: { designationId: designation.id, pan: "ABCDE1234F" } });
    await db.attendanceEvent.create({ data: { employeeId: employee.id, workDate: "2026-10-28", at: new Date(), kind: "IN", source: "WEB" } });
    await db.attendanceDay.create({ data: { employeeId: employee.id, workDate: "2026-10-28", status: "IN_PROGRESS" } });
    await db.document.create({ data: { employeeId: employee.id, category: "ID_PROOF", fileName: "pan.pdf", mimeType: "application/pdf", size: 10, storageKey: "k1", uploadedById: employee.id } });
    await db.holiday.create({ data: { date: "2026-11-08", name: "Diwali" } });
    await resetDb();
    expect(await db.attendanceEvent.count()).toBe(0);
    expect(await db.document.count()).toBe(0);
    expect(await db.designation.count()).toBe(0);
    expect(await db.holiday.count()).toBe(0);
  });
```

- [ ] **Step 2: Run** `npx vitest run tests/server/db.test.ts` — Expected: FAIL (`db.designation` undefined).

- [ ] **Step 3: Change the schema and migrate.** The `designation` text column is replaced by `designationId`, which drops a column: `npx prisma migrate dev --create-only --name people_attendance`, check the SQL rebuilds `Employee` without `designation`, then `npx prisma migrate deploy` and `npx prisma generate`. Update `clearAll`. In `prisma/seed/seed.ts`, create one `Designation` per distinct `designation` in `PEOPLE` and link it (the full seed extension is Task 15). Update every Phase 0 reader of `employee.designation` (`src/server/profile.ts`) to read `employee.designation?.title ?? null`.

- [ ] **Step 4: Set upload limits** in `next.config.ts`: `experimental: { serverActions: { bodySizeLimit: "12mb" }, proxyClientMaxBodySize: "12mb" }`.

- [ ] **Step 5: Run** `npm test && npm run typecheck` — Expected: all pass (update `tests/server/profile.test.ts` to create a `Designation` instead of setting text).

- [ ] **Step 6: Re-seed dev** `npm run db:seed` — Expected: "Seeded 48 employees."

- [ ] **Step 7: Commit** `feat: add schema for people, attendance and documents`.

---

### Task 3: People rules — validation, access, hierarchy

**Files:**
- Create: `src/domain/people/types.ts`, `src/domain/people/schemas.ts`, `src/domain/people/access.ts`, `src/domain/people/hierarchy.ts`
- Test: `tests/domain/people.test.ts`

**Interfaces:**
- Consumes: `CurrentUser`, `can`.
- Produces:
  - `type EmploymentType = "FULL_TIME" | "INTERN" | "CONTRACT"`; `type EmployeeStatus = "ACTIVE" | "NOTICE" | "EXITED"`.
  - `employeeInputSchema` (zod; HR create/edit): `fullName` 2–80, `workEmail` (email, lowercased), `designationId`, `departmentId`, `managerId` (nullable), `joinedOn` (YYYY-MM-DD), `probationEndsOn?`, `employmentType`, `status`, `location`, `phone?` (10–15 digits, optional +), `personalEmail?`, `dateOfBirth?` (not in the future, age ≥ 16), `gender?`, `bloodGroup?` (A+, A-, B+, B-, AB+, AB-, O+, O-), addresses, emergency contact, `bankHolder?`, `bankAccount?` (9–18 digits), `bankIfsc?` (`/^[A-Z]{4}0[A-Z0-9]{6}$/`), `pan?` (`/^[A-Z]{5}[0-9]{4}[A-Z]$/`), `aadhaar?` (12 digits), role flags `isHR`, `isPayroll`, `isAdmin`. Empty strings become `null`.
  - `selfEditSchema`: `phone`, `personalEmail`, `currentAddress`, `permanentAddress`, `emergencyName`, `emergencyRelation`, `emergencyPhone`, `showBirthday` only.
  - `maskTail(value: string | null, keep = 4): string | null` → `"•••• •••• 1234"`-style (bullets + last 4).
  - `type ProfileAccess = { level: "SELF" | "HR" | "PAYROLL" | "MANAGER" | "COLLEAGUE"; personal: boolean; bank: "FULL" | "MASKED" | "NONE"; ids: "FULL" | "MASKED" | "NONE"; attendance: boolean; documents: boolean; edit: "FULL" | "SELF" | "NONE"; audit: boolean; roles: boolean }`
  - `profileAccess(viewer: CurrentUser, subjectEmployeeId: string, viewerManagesSubject: boolean): ProfileAccess` — matrix: SELF → personal, bank MASKED, ids MASKED, attendance, documents, edit SELF; HR/Admin → everything FULL, edit FULL, audit, roles only for Admin; PAYROLL → bank FULL, ids FULL, personal false, attendance false; MANAGER (chain) → attendance true only; COLLEAGUE → nothing. Self wins over manager; HR/Admin wins over self for edit level.
  - `isInChain(managerId: string, employeeId: string, managerOf: Map<string, string | null>): boolean` (direct or indirect; cycle-safe).
  - `wouldCreateCycle(employeeId: string, newManagerId: string | null, managerOf: Map<string, string | null>): boolean` (true for self-management too).
  - `reportsOf(managerId: string, managerOf: Map<string, string | null>): string[]` (all levels).
  - `type OrgNode = { id: string; children: OrgNode[] }`; `buildOrgTree(managerOf: Map<string, string | null>): OrgNode[]` (roots = no manager or manager missing from the map).

- [ ] **Step 1: Write the failing tests** — `tests/domain/people.test.ts`:
  - `employeeInputSchema` accepts a full valid record and lowercases the email; rejects PAN `abcde1234f`, IFSC `SBIN1234567`, Aadhaar of 11 digits, a birth date in the future, and blood group `C+`; turns `""` into `null` for optional fields.
  - `maskTail("123456789012")` → `"•••• •••• 9012"`; `maskTail(null)` → `null`; `maskTail("12")` → `"12"`.
  - `profileAccess` table test covering SELF, HR, Admin (`roles: true`), PAYROLL, MANAGER (`attendance: true`, `personal: false`, `bank: "NONE"`), COLLEAGUE (all false/NONE).
  - `isInChain`: A→B→C means `isInChain("A","C")` true, `isInChain("C","A")` false; a corrupt cycle in the map terminates.
  - `wouldCreateCycle`: setting A's manager to C (who reports to A) is true; to self is true; to null is false.
  - `reportsOf("A")` returns B and C; `buildOrgTree` returns one root A with B under it and C under B.

- [ ] **Step 2: Run** `npx vitest run tests/domain/people.test.ts` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** the four files with the signatures above.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `feat: add people validation, access matrix and hierarchy rules`.

---

### Task 4: People service — employees, directory, profiles, structure

**Files:**
- Create: `src/server/people/employees.ts`, `src/server/people/directory.ts`, `src/server/people/structure.ts`, `src/server/people/hierarchy.ts`
- Modify: `src/server/auth/password-tokens.ts` (refuse EXITED in `consumePasswordToken` — Phase 0 deferred minor)
- Test: `tests/server/employees.test.ts`

**Interfaces:**
- Consumes: Task 3 rules, `sendSetPasswordEmail`, `revokeAllSessions`, `writeAudit`, `notifyEmployees`, `can`.
- Produces:
  - `loadManagerMap(db?: Db): Promise<Map<string, string | null>>`; `managesEmployee(managerEmployeeId, employeeId): Promise<boolean>`; `visibleReportIds(viewer: CurrentUser): Promise<string[] | "ALL">` (HR/Admin → "ALL"; managers → all levels; others → []).
  - `type EmployeeResult = { ok: true; id: string } | { ok: false; error: string; field?: string }`
  - `createEmployee(actor, raw: unknown): Promise<EmployeeResult>` — requires `employees.manage`; role flags only honoured for Admin; unique work email ("Someone already uses that work email."); next code `LNW-NNNN`; creates Employee + User; audits `employee.create`; schedules `sendSetPasswordEmail` (call directly; the caller uses `after()`).
  - `updateEmployee(actor, id, raw: unknown): Promise<EmployeeResult>` — requires `employees.manage`; refuses manager cycles ("That would make them report to themselves."); audits before/after **excluding** bank/PAN/Aadhaar values (record only which of those changed); when status becomes `EXITED`: revoke all sessions and mark unused password tokens used.
  - `updateMyDetails(actor, raw: unknown): Promise<EmployeeResult>` — `selfEditSchema` only; audits `employee.self_update`.
  - `type DirectoryEntry = { id; code; fullName; designation: string | null; department: string | null; location: string; status: EmployeeStatus; email: string; today: "IN" | "BREAK" | "OUT" | "NOT_IN" }`
  - `getDirectory(viewer, filter: { q?: string; departmentId?: string; includeExited?: boolean }): Promise<DirectoryEntry[]>` — EXITED hidden unless HR/Admin asks; `q` matches name, code, designation, email (case-insensitive); `today` from today's attendance (Task 6 provides `todayStateMap`; until Task 6 lands use `"NOT_IN"` — Task 6 Step 3 wires it).
  - `type ProfileView = { id; code; fullName; preferredName; email; designation; department; managerId; managerName; location; employmentType; status; joinedOn; probationEndsOn; access: ProfileAccess; personal?: {...}; bank?: { holder; account; ifsc }; ids?: { pan; aadhaar } }` — sensitive groups are **absent** (not null) when access is NONE, masked when MASKED.
  - `getProfile(viewer, employeeId): Promise<ProfileView | null>`.
  - `listDepartments()`, `createDepartment(actor, name)`, `renameDepartment(actor, id, name)`, `listDesignations()`, `createDesignation(actor, title, level)`, `renameDesignation(actor, id, title, level)` — HR/Admin only, unique names, audited.
  - `getOrgChart(): Promise<{ nodes: Record<string, { id; fullName; designation: string | null; department: string | null }>; roots: OrgNode[] }>` (active and notice only).

- [ ] **Step 1: Write the failing tests** — `tests/server/employees.test.ts`, with an org of HR, Admin, manager → engineer, and an unrelated colleague:
  - HR creates an employee: code `LNW-0001` on an empty DB, user created with lowercase email, outbox has one set-password mail, audit row `employee.create`; duplicate email returns the field error.
  - HR cannot grant roles (`isAdmin: true` is ignored); Admin can.
  - A plain employee calling `createEmployee` gets `{ ok: false, error: "You don't have permission to do that." }`.
  - `updateEmployee` refuses a cycle; exiting revokes sessions and marks an outstanding SET token used; the audit `after` JSON contains `"pan":"changed"` not the PAN value.
  - `updateMyDetails` changes phone, ignores an attempted `fullName` change.
  - **Review Focus 4:** `getDirectory(colleague)` entries have no `pan`, `aadhaar`, `bankAccount` keys anywhere (`JSON.stringify` does not contain the seeded PAN); `getProfile(colleague, engineer)` has no `personal`, `bank`, `ids` keys; `getProfile(engineer, self).ids.pan` is masked; `getProfile(hr, engineer).ids.pan` is the full value.
  - **Review Focus 3:** `getProfile(manager, engineer).access.attendance` is true and `personal` is absent; `getProfile(manager, colleague).access.attendance` is false.
  - `consumePasswordToken` for an EXITED employee returns the expired-link error and leaves the hash unchanged.
  - `getOrgChart` roots contain the top person; exited people are absent.

- [ ] **Step 2: Run** `npx vitest run tests/server/employees.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** the four files. Permission failures return `{ ok: false, error: "You don't have permission to do that." }` (no throws for expected denials).

- [ ] **Step 4: Run** `npm test` — Expected: all pass.

- [ ] **Step 5: Commit** `feat: add employee management, directory and profile access`.

---

### Task 5: Attendance rules — state machine, summary, day status

**Files:**
- Create: `src/domain/attendance/types.ts`, `src/domain/attendance/state.ts`, `src/domain/attendance/summary.ts`, `src/domain/attendance/status.ts`
- Modify: `src/server/settings.ts` (read-time invariant — Phase 0 deferred minor)
- Test: `tests/domain/attendance.test.ts`, `tests/server/settings.test.ts` (extend)

**Interfaces:**
- Produces:
  - `type EventKind = "IN" | "OUT" | "BREAK_START" | "BREAK_END"`; `type AttendanceState = "NOT_STARTED" | "WORKING" | "ON_BREAK" | "CHECKED_OUT"`; `type DayStatus = "PRESENT" | "SHORT" | "HALF_DAY" | "ABSENT" | "MISSING_CHECKOUT" | "IN_PROGRESS" | "HOLIDAY" | "WEEKEND" | "LEAVE" | "UPCOMING"`; `type TimedEvent = { kind: EventKind; at: Date }`.
  - `nextAttendanceState(state: AttendanceState, kind: EventKind): AttendanceState | null` — allowed: NOT_STARTED+IN→WORKING, WORKING+BREAK_START→ON_BREAK, ON_BREAK+BREAK_END→WORKING, WORKING+OUT→CHECKED_OUT, ON_BREAK+OUT→CHECKED_OUT, CHECKED_OUT+IN→WORKING; everything else `null`.
  - `stateAfter(events: TimedEvent[]): AttendanceState` (events in time order).
  - `summarise(events: TimedEvent[], until: Date): { firstInAt: Date | null; lastOutAt: Date | null; workedMinutes: number; breakMinutes: number; open: boolean }` — worked = IN→OUT spans minus breaks; an open session or break is counted up to `until`; an OUT during a break ends the break.
  - `computeDayStatus(input: { isWeekend: boolean; holidayName: string | null; leave: "FULL" | "HALF" | null; hasEvents: boolean; open: boolean; isPast: boolean; isToday: boolean; workedMinutes: number; requiredMinutes: number; halfDayMinutes: number }): DayStatus` — priority exactly as spec §6.3: holiday → weekend → full leave → (today and open or (today and no events)) `IN_PROGRESS` → future `UPCOMING` → open past day `MISSING_CHECKOUT` → worked ≥ required (halved by half-day leave) `PRESENT` → worked ≥ halfDay `SHORT` → worked > 0 `HALF_DAY` → no events on a past working day `ABSENT`. A weekend/holiday with events keeps its HOLIDAY/WEEKEND status (worked time still shows).
  - `OPEN_SESSION_MAX_MINUTES = 960` (16 h) and `isAbandoned(lastEventAt: Date, now: Date): boolean`.
  - `getSettings()` now falls back to the defaults for **both** `attendance.requiredDailyMinutes` and `attendance.halfDayMinutes` when the stored pair has half-day ≥ full day.

- [ ] **Step 1: Write the failing tests** — `tests/domain/attendance.test.ts`:
  - Transition table: every allowed transition, and `nextAttendanceState("CHECKED_OUT", "OUT")`, `("NOT_STARTED", "BREAK_START")`, `("WORKING", "IN")` are `null`.
  - `summarise`: IN 09:30, BREAK 13:00–13:30, OUT 18:45 → worked 525, break 30, open false; second session IN 20:00 OUT 21:00 adds 60; open session IN 09:00 until 11:00 → worked 120, open true; OUT while on break closes the break.
  - `computeDayStatus` cases: holiday beats everything; weekend; full leave; today with no events → IN_PROGRESS; future → UPCOMING; open past → MISSING_CHECKOUT; 540 → PRESENT; 539 → SHORT; 270 → SHORT; 269 → HALF_DAY; past working day, no events → ABSENT; half-day leave + 270 worked → PRESENT.
  - `isAbandoned`: 16 h 1 m after the last event → true; 15 h 59 m → false.
- Extend `tests/server/settings.test.ts`: stored half-day 600 with a corrupt full-day row → both read back as 540/270.

- [ ] **Step 2: Run** both files — Expected: FAIL.

- [ ] **Step 3: Implement** the four domain files and the `getSettings` invariant.

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `feat: add attendance state machine and day status rules`.

---

### Task 6: Attendance service — recording, views, team board, nightly close

**Files:**
- Create: `src/server/attendance/record.ts`, `src/server/attendance/views.ts`, `src/server/attendance/team.ts`, `src/server/attendance/close-day.ts`, `src/jobs/close-attendance-day.ts`
- Modify: `src/server/people/directory.ts` (wire `today`), `package.json` (`"jobs:close-day": "tsx src/jobs/close-attendance-day.ts"`)
- Test: `tests/server/attendance.test.ts`

**Interfaces:**
- Consumes: Task 1 dates, Task 5 rules, `getSettings`, `visibleReportIds`, `notifyEmployees`.
- Produces:
  - `recordAttendance(actor: CurrentUser, kind: EventKind, now?: Date): Promise<{ ok: true; state: AttendanceState; workDate: string } | { ok: false; error: string }>` — the open work date is the latest event's `workDate` when its state is WORKING/ON_BREAK and not abandoned; otherwise today's IST date (an abandoned open day is left as is for the nightly job). Invalid transitions return `"You're already checked in."`, `"You aren't checked in."`, `"You're not on a break."`, etc. Runs in a transaction that re-reads the latest event, so parallel duplicate clicks write one event. Recomputes the day.
  - `recomputeDay(tx: DbTx, employeeId: string, workDate: string, now: Date): Promise<void>` — upserts `AttendanceDay` from events + holiday + settings via `summarise` and `computeDayStatus`.
  - `type TodayView = { workDate; state: AttendanceState; events: { kind; at: string; time: string }[]; workedMinutes: number; startedAt: string | null; requiredMinutes: number }` — `getToday(employeeId, now?)`.
  - `type MonthDay = { date; weekday; status: DayStatus; workedMinutes; firstIn: string | null; lastOut: string | null; holidayName: string | null; correctionPending: boolean }`; `type MonthStats = { averageMinutes: number; fullDays: number; shortDays: number; halfDays: number; absences: number; missingCheckouts: number }`; `getMonth(viewer: CurrentUser, employeeId: string, year: number, month: number, now?): Promise<{ ok: true; days: MonthDay[]; stats: MonthStats } | { ok: false; error: string }>` — allowed for self, HR/Admin, managers in chain (**Review Focus 3**); past working days with no row are ABSENT.
  - `buildMonthDays(employeeId: string, year: number, month: number, now: Date, ctx: { settings: Settings; holidays: Map<string, string>; joinedOn: string }): Promise<{ days: MonthDay[]; stats: MonthStats }>` — the shared per-day builder used by `getMonth` and the Task 8 report (days before `joinedOn` are excluded from stats).
  - `getRecentHours(employeeId, now?, count = 10): Promise<{ date; label; minutes; today: boolean; holidayName: string | null }[]>` — the last `count` working days (weekends skipped, holidays kept and marked) ending today.
  - `todayStateMap(employeeIds: string[], now?): Promise<Map<string, "IN" | "BREAK" | "OUT" | "NOT_IN">>`.
  - `getTeamToday(viewer, now?): Promise<{ counts: { in: number; onBreak: number; out: number; notIn: number }; people: { id; fullName; designation: string | null; state: "IN" | "BREAK" | "OUT" | "NOT_IN"; since: string | null }[] } | null>` — null for viewers with no reports.
  - `closeAttendanceDay(workDate: string, now?): Promise<{ missingCheckout: number; absent: number }>` — for every ACTIVE/NOTICE employee who had joined by that date: recompute the day as past; notify `MISSING_CHECKOUT` ("You didn't check out on <date>. Ask for a correction.", link `/attendance`) and `ABSENT` ("No attendance for <date>. If you worked, ask for a correction."). Idempotent: re-running does not notify twice (skip when the stored status is already final).
  - `src/jobs/close-attendance-day.ts` closes yesterday (IST) and prints the counts.

- [ ] **Step 1: Write the failing tests** — `tests/server/attendance.test.ts`, with fixed `now` values:
  - Check in → break → back → check out writes 4 events, state CHECKED_OUT, day PRESENT/SHORT per minutes; checking in again the same day reopens it.
  - **Review Focus 2:** IN twice → second returns `"You're already checked in."` and one event exists; BREAK_START while CHECKED_OUT is refused; `Promise.all` of two IN calls → exactly one `IN` event.
  - **Review Focus 1:** IN at 23:00 IST on the 28th, OUT at 01:00 IST on the 29th → both events have `workDate` "2026-10-28", worked 120; IN on the 28th, nothing else, then IN at 09:30 on the 30th → new work date "2026-10-30" accepted, and after `closeAttendanceDay("2026-10-28")` that day is MISSING_CHECKOUT with one notification; running the close again adds no notification.
  - `getMonth` for self returns 31 days for October with the 2nd marked HOLIDAY "Gandhi Jayanti" (seed a holiday in the test), weekends WEEKEND, a past working day with no events ABSENT, future days UPCOMING; stats count them.
  - **Review Focus 3:** `getMonth(manager, report)` ok; `getMonth(colleague, other)` → `{ ok: false, error: "You can't see this person's attendance." }`; HR sees anyone.
  - `getRecentHours` returns 10 entries ending today, skipping weekends.
  - `getTeamToday(manager)` counts one IN and one NOT_IN; `getTeamToday(plainEmployee)` is null.
  - `getDirectory` now reports `today: "IN"` for someone checked in.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** the files, wire `todayStateMap` into `getDirectory`, add the npm script.

- [ ] **Step 4: Run** `npm test` — Expected: all pass.

- [ ] **Step 5: Commit** `feat: add attendance recording, month view, team board and nightly close`.

---

### Task 7: Attendance corrections and the approval type registry

**Files:**
- Create: `src/domain/attendance/corrections.ts`, `src/server/attendance/corrections.ts`, `src/server/approvals/types.ts`
- Test: `tests/domain/corrections.test.ts`, `tests/server/corrections.test.ts`

**Interfaces:**
- Consumes: `submitApproval`, `registerApprovalType`, `withdrawApproval`, `recomputeDay`, dates, settings.
- Produces:
  - `correctionInputSchema` (zod): `workDate`, `inTime` "HH:MM", `outTime` "HH:MM", `breakStart?`, `breakEnd?`, `reason` 5–300 chars.
  - `validateCorrection(input, ctx: { today: string; windowDays: number; hasOpenCorrection: boolean }): { ok: true; inAt: Date; outAt: Date; breakStartAt: Date | null; breakEndAt: Date | null } | { ok: false; error: string }` — errors (exact copy): `"Pick a day before today."` (today or future), `"Corrections are only possible for the last 30 days."` (uses windowDays), `"Check-out must be after check-in."`, `"The break must sit inside the working hours."`, `"Give both break times or neither."`, `"There's already a correction waiting for that day."`. An `outTime` earlier than `inTime` is **not** treated as next day (night work uses live check-in).
  - `requestCorrection(actor: CurrentUser, raw: unknown, now?): Promise<{ ok: true; id: string } | { ok: false; error: string }>` — creates `AttendanceCorrection` and submits approval type `ATTENDANCE_CORRECTION` with summary like `"Attendance fix · Tue 14 Oct, 09:30–18:30"`.
  - Registered hooks (label `"Attendance fix"`, link `/attendance?month=YYYY-MM`): `onApproved` deletes that day's events, writes CORRECTION events (IN, optional BREAK_START/BREAK_END, OUT), marks the correction APPROVED and calls `recomputeDay`; `onClosed` marks DECLINED/WITHDRAWN.
  - `listMyCorrections(employeeId): Promise<{ id; workDate; status; summary; approvalId }[]>`.
  - `src/server/approvals/types.ts` imports `@/server/attendance/corrections` (side-effect registration). Every page/action/test that decides approvals imports this module first.

- [ ] **Step 1: Write the failing tests**
  - `tests/domain/corrections.test.ts` (**Review Focus 5**): each error above with its exact message; a valid input returns IST instants (`09:30` on 2026-10-14 → `2026-10-14T04:00:00.000Z`).
  - `tests/server/corrections.test.ts`: employee with a manager requests a fix for a past ABSENT day → approval routed to the manager only (policy seeded as `["MANAGER"]`); manager approves → that day now has 2 CORRECTION events, status PRESENT, correction APPROVED, employee notified; a second request for the same day while one is pending is refused; declining marks DECLINED and leaves the day untouched; withdrawing marks WITHDRAWN.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test` — Expected: all pass.

- [ ] **Step 5: Commit** `feat: add attendance corrections through the approval engine`.

---

### Task 8: Monthly attendance report and CSV

**Files:**
- Create: `src/server/attendance/report.ts`, `src/app/api/reports/attendance/route.ts`
- Test: `tests/server/report.test.ts`

**Interfaces:**
- Consumes: `getMonth`-equivalent computation (share the per-day builder from `views.ts`; export `buildMonthDays(employeeId, year, month, now, ctx)`), `visibleReportIds`.
- Produces:
  - `type ReportRow = { employeeId; code; fullName; department: string | null; present; short; halfDay; absent; leave; wfh; holidays; missingCheckout; totalMinutes; averageMinutes }` (`leave`/`wfh` are 0 until Phase 1b).
  - `getMonthlyReport(viewer, year, month, now?): Promise<ReportRow[] | null>` — HR/Admin all active+notice employees; managers their chain; others null.
  - `reportToCsv(rows: ReportRow[], year: number, month: number): string` — header `Code,Name,Department,Present,Short,Half day,Absent,Leave,WFH,Holidays,Missing check-out,Total hours,Average hours`; hours as `h:mm`; fields quoted and `"` doubled; a leading `=`, `+`, `-` or `@` is prefixed with `'` (spreadsheet formula injection).
  - `GET /api/reports/attendance?month=YYYY-MM` → `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="attendance-YYYY-MM.csv"`; 401 without a session, 403 for viewers without access, 400 for a bad month.

- [ ] **Step 1: Write the failing tests** — counts for a seeded mini-month; manager sees only their chain; plain employee gets null; CSV escaping of a name `Ravi "RP" Prakash` and a department `=SUM(A1)` → `"'=SUM(A1)"`.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.

- [ ] **Step 5: Commit** `feat: add monthly attendance report with safe CSV export`.

---

### Task 9: Documents

**Files:**
- Create: `src/domain/documents/files.ts`, `src/server/documents/store.ts`, `src/server/documents/documents.ts`, `src/app/api/files/[id]/route.ts`
- Test: `tests/domain/files.test.ts`, `tests/server/documents.test.ts`

**Interfaces:**
- Produces:
  - `DOCUMENT_CATEGORIES = ["ID_PROOF", "ADDRESS_PROOF", "EDUCATION", "EXPERIENCE", "OFFER_LETTER", "OTHER"] as const` with labels ("ID proof", "Address proof", "Education", "Experience", "Offer / appointment letter", "Other"); `MAX_DOCUMENT_BYTES = 10 * 1024 * 1024`.
  - `sniffFileType(bytes: Uint8Array): "application/pdf" | "image/png" | "image/jpeg" | null` (`%PDF-`, `89 50 4E 47 0D 0A 1A 0A`, `FF D8 FF`).
  - `safeFileName(name: string): string` — keeps letters, digits, `.`, `-`, `_`, spaces; max 120 chars; never empty (`"document"`).
  - `FileStore` interface `{ save(bytes: Uint8Array): Promise<string>; read(key: string): Promise<Uint8Array>; remove(key: string): Promise<void> }`; `localFileStore(root = process.env.STORAGE_DIR ?? "storage")` storing under random hex keys (no user input in paths). Tests use a temp dir.
  - `uploadDocument(actor, input: { employeeId: string; category: string; file: File }, store?: FileStore): Promise<{ ok: true; id: string } | { ok: false; error: string }>` — self or HR/Admin; errors: `"Choose a file to upload."`, `"Files can be up to 10 MB."`, `"Upload a PDF, JPG or PNG."` (by sniffing, regardless of the browser's type), `"Pick a document type."`; audited.
  - `listDocuments(viewer, employeeId)` (self or HR/Admin, else null), `verifyDocument(actor, id)` (HR/Admin; sets verifiedAt/verifiedById; notifies the owner "HR verified your <label>"), `openDocument(viewer, id, store?): Promise<{ bytes; mimeType; fileName } | null>`.
  - `GET /api/files/[id]` → 401 no session; 404 when the viewer may not see it (do not reveal existence); otherwise the bytes with the stored type, `Content-Disposition: inline; filename="<safe>"`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.

- [ ] **Step 1: Write the failing tests** — sniffing (a PNG renamed `.pdf` is PNG; a text file claiming `application/pdf` is rejected); `safeFileName("../../etc/passwd")` has no slashes; upload by self and by HR succeed; a manager uploading for a report is refused; a colleague cannot list or open; verify notifies; an 11 MB buffer is refused.

- [ ] **Step 2–4:** run (FAIL) → implement → run `npm test` (PASS).

- [ ] **Step 5: Commit** `feat: add employee documents with type-checked uploads`.

---

### Task 10: Navigation and shell updates

**Files:**
- Modify: `src/components/shell/nav.ts`, `src/components/ui/icon-names.ts`, `src/components/ui/IconSprite.tsx`, `src/app/(app)/layout.tsx`, `src/components/shell/Sidebar.tsx`, `src/app/globals.css`
- Test: `tests/domain/permissions.test.ts` (extend `navFor`)

**Interfaces:**
- Produces: `navFor(user)` order: Home `/home`, Attendance `/attendance`, People `/people`, Approvals `/approvals`, Reports `/reports/attendance` (HR/Admin or anyone with reports), My profile `/profile`, Settings `/settings` (Admin). `NavLink` gains optional `badge?: number`; the layout passes the approvals count from `listPendingFor(user).length`. New icon names: `"inbox"` (exists), `"file"`, `"chart"`, `"org"`.
- Sidebar footer stays visible on short screens: `.side { overflow-y: auto }` and the footer never overlaps the nav.

- [ ] **Step 1: Update the `navFor` tests** for employee (Home, Attendance, People, Approvals, My profile), manager (+ Reports), HR (+ Reports), Admin (+ Reports, Settings). Run — FAIL.
- [ ] **Step 2: Implement**; show the badge as the prototype's `.count` pill.
- [ ] **Step 3: Run** `npm test && npm run typecheck && npm run lint` — PASS.
- [ ] **Step 4: Commit** `feat: add Phase 1a navigation with approvals badge`.

---

### Task 11: People pages

**Files:**
- Create: `src/app/(app)/people/page.tsx`, `src/app/(app)/people/[id]/page.tsx`, `src/app/(app)/people/new/page.tsx`, `src/app/(app)/people/structure/page.tsx`, `src/app/(app)/people/org/page.tsx`, `src/app/(app)/people/actions.ts`, `src/components/people/PersonCard.tsx`, `src/components/people/EmployeeForm.tsx`, `src/components/people/DocumentsPanel.tsx`, `src/components/people/OrgTree.tsx`
- Modify: `src/app/(app)/profile/page.tsx` → redirect to `/people/<own id>`

**Interfaces:**
- Consumes: Task 4 and Task 9 services, `profileAccess` result, `getMonth` for the Attendance tab, `listAudit` for the HR Audit tab.
- Behaviour (prototype "Team" page styling: `.tgrid`, `.pcard` with `data-tilt`, `.chips`, `.sinput`):
  - `/people` — search box (debounced URL `?q=`), department chips (`?dept=`), cards with status dot from `today`, "Add employee" button for HR/Admin, links to Structure and Org chart; empty state "Nobody matches “x”. Try a role, such as “designer”."
  - `/people/[id]` — header (avatar, name, designation, department, status pill) and tabs via `?tab=`: Overview (always), Personal (if `access.personal`), Job & pay (bank/ids per access), Documents (if `access.documents`), Attendance (if `access.attendance`, renders `MonthCalendar` read-only), Audit (if `access.audit`). Unknown id → `notFound()`. HR sees "Edit"; self sees "Edit my details" (self-edit form).
  - `/people/new` and `?edit=1` — `EmployeeForm` (client, `useActionState`) with field errors from `EmployeeResult.field`; role checkboxes rendered only for Admin; after create, `after(() => sendSetPasswordEmail(id))` and redirect to the new profile with a toast "Invite sent to <email>".
  - `/people/structure` (HR/Admin) — two cards listing departments and designations with inline add/rename forms.
  - `/people/org` — collapsible tree (`<details>`), keyboard accessible.
  - Server actions in `people/actions.ts` call the services and `revalidatePath`.

- [ ] **Step 1:** Build the pages; `npm run typecheck && npm run lint && npm run build` — Expected: clean build listing `/people`, `/people/[id]`, `/people/new`, `/people/structure`, `/people/org`.
- [ ] **Step 2:** Manual check with `npm run dev`: as `hr@` add an employee and see the set-password mail in the terminal; as `employee@` open Ananya's profile and confirm only Overview shows.
- [ ] **Step 3: Commit** `feat: add people directory, profiles, employee forms and org chart`.

(Behaviour is pinned by the service tests in Tasks 4/9 and the E2E in Task 16.)

---

### Task 12: Attendance pages

**Files:**
- Create: `src/app/(app)/attendance/page.tsx`, `src/app/(app)/attendance/team/page.tsx`, `src/app/(app)/attendance/actions.ts`, `src/app/(app)/reports/attendance/page.tsx`, `src/components/attendance/MonthCalendar.tsx`, `src/components/attendance/Timeline.tsx`, `src/components/attendance/CorrectionForm.tsx`

**Interfaces:**
- Consumes: `getMonth`, `getToday`, `getTeamToday`, `requestCorrection`, `listMyCorrections`, `getMonthlyReport`.
- Behaviour (prototype "Attendance" page: `.heat`, `.hc` level classes, legend, `.tl` timeline):
  - `/attendance?month=YYYY-MM` — month switcher (no months before the employee joined, none after this month), stats tiles from `MonthStats`, `MonthCalendar` (each day a button with an accessible label like "Tue 14 Oct · 8h 32m · in at 09:31"; tooltip; pending-correction marker), the Today timeline, "My corrections" list, and the correction form (opens with the clicked past day pre-filled). Form errors use `FormError`/`errorProps`.
  - `/attendance/team` (managers/HR) — `getTeamToday` board with counts and per-person state; link to each person's Attendance tab.
  - `/reports/attendance?month=` (HR/Admin and managers) — the report table and a "Download CSV" link to the Route Handler.
  - `attendance/actions.ts`: `checkAction(kind)` → `recordAttendance` + `revalidatePath("/", "layout")`; `requestCorrectionAction`; `runCloseDayAction()` (Admin only) → `closeAttendanceDay(yesterday)` and a toast with the counts.
  - Settings page (Admin) gains a "Scheduled jobs" card with a "Close yesterday's attendance now" button calling `runCloseDayAction` (spec §3.2 "Run now").

- [ ] **Step 1:** Build; `npm run typecheck && npm run lint && npm run build` — clean.
- [ ] **Step 2:** Manual check in dev: October calendar shows Gandhi Jayanti and Dussehra as holidays, and past absences.
- [ ] **Step 3: Commit** `feat: add attendance month view, team board, corrections and report pages`.

---

### Task 13: Approvals inbox

**Files:**
- Create: `src/app/(app)/approvals/page.tsx`, `src/app/(app)/approvals/actions.ts`, `src/components/approvals/ApprovalRow.tsx`
- Modify: `src/server/approvals/engine.ts` — add `listMyRequests(actor): Promise<RequestWithSteps[]>` (requester's own, newest first, 50) and `describeStep(r): string` ("Waiting on Ananya Sharma" / "Waiting on HR" / "Approved" / "Declined by …")
- Test: `tests/server/approvals.test.ts` (extend for the two additions)

**Interfaces:**
- Behaviour: "Waiting on you" (from `listPendingFor`) with requester avatar, label + summary, age, Approve (✓) and Decline (✕, opens an inline reason field — required) buttons; rows fold away on success (prototype `.ap` collapse) with a toast; "Your requests" with status pills and Withdraw for pending. Both lists import `@/server/approvals/types` first so hooks are registered.
- `approvals/actions.ts`: `decideAction(requestId, decision, comment?)`, `withdrawAction(requestId)` → engine + `revalidatePath("/", "layout")`; return engine errors to the row.

- [ ] **Step 1:** Extend tests: `listMyRequests` returns own requests newest first; `describeStep` texts for pending manager step, pending HR step, approved, declined. Run — FAIL. Implement — PASS.
- [ ] **Step 2:** Build the page; `npm run typecheck && npm run lint && npm run build` — clean.
- [ ] **Step 3: Commit** `feat: add approvals inbox`.

---

### Task 14: Home dashboard

**Files:**
- Modify: `src/app/(app)/home/page.tsx`, `src/server/home.ts`, `tests/server/profile.test.ts` (home view part)
- Create: `src/components/attendance/ClockCard.tsx`, `src/components/attendance/HoursChart.tsx`

**Interfaces:**
- `getHomeView(user, now?)` returns `{ dateLabel; heading; today: TodayView; recent: Awaited<ReturnType<typeof getRecentHours>>; kpis: { averageMinutes: number; fullDaysThisMonth: number; shortDaysThisMonth: number; toReview: number }; team: Awaited<ReturnType<typeof getTeamToday>>; notes: { id; title; ago }[] }`.
- `ClockCard` (client) — the prototype clock card: state chip, live `HH:MM:SS` (ticks every second from `startedAt` + server `workedMinutes`, never computed during render — use an effect), ring of worked/required, buttons per state (Check in / Take a break + Check out / Resume + Check out) calling `checkAction`; on error shows a toast; keyboard focus returns to the new primary button.
- `HoursChart` — the prototype bars (last 10 working days, 9 h target line from `requiredMinutes`, holiday and today styles), each bar a button with an accessible label and tooltip.
- Layout per prototype: hero (greeting + quick actions "Fix attendance" → `/attendance`, "Find a colleague" → `/people`) + clock card; KPI tiles (Average day, Full days this month, Short days, To review — hidden when 0 and the user approves nothing); hours chart + team today (managers/HR) or "Latest for you" (others); notifications card.

- [ ] **Step 1:** Update `getHomeView` test: with a check-in at 09:30 and `now` 11:00, `today.state` is WORKING and `today.workedMinutes` 90; `kpis.toReview` counts a pending correction for the manager. Run — FAIL. Implement — PASS.
- [ ] **Step 2:** Build the components; `npm run typecheck && npm run lint && npm run build` — clean.
- [ ] **Step 3: Commit** `feat: rebuild home dashboard with clock card, KPIs and hours chart`.

---

### Task 15: Seed data for Phase 1a

**Files:**
- Modify: `prisma/seed/data.ts`, `prisma/seed/seed.ts`, `tests/seed.test.ts`

**Interfaces:**
- Produces: designations with levels; every employee gets phone, personal email, DOB (ages 21–48), gender, blood group, Mohali address, emergency contact; HR-visible bank/PAN/Aadhaar with valid formats (fake, deterministic); 2026 holidays: 26 Jan Republic Day, 4 Mar Holi, 15 Aug Independence Day, 2 Oct Gandhi Jayanti, 20 Oct Dussehra, 8 Nov Diwali, 9 Nov Govardhan Puja, 24 Nov Guru Nanak Jayanti, 25 Dec Christmas; attendance for the 90 days before **today (IST, at seed time)** for every active employee who had joined: deterministic per employee/day (seeded PRNG from code + date), mostly 8h45–9h30 days, ~8% short, ~2% half, ~2% absent, ~1% missing check-out, lunch breaks; `employee@` (Arjun) has no events today; Karan Joshi has a pending correction for a recent absent day awaiting Ananya.
- `seed.test.ts`: designations ≥ 20; every employee's PAN matches the PAN regex; holidays = 9; Arjun has attendance on the last working day before today and none today; one pending `ATTENDANCE_CORRECTION` approval routed to Ananya.

- [ ] **Step 1:** Extend `tests/seed.test.ts`; run — FAIL. Implement — PASS (keep the seed under 60 s).
- [ ] **Step 2:** `npm run db:seed` — prints the counts and demo logins.
- [ ] **Step 3: Commit** `feat: seed profiles, holidays and three months of attendance`.

---

### Task 16: End-to-end tests and final verification

**Files:**
- Create: `tests/e2e/attendance.spec.ts`, `tests/e2e/people.spec.ts`
- Modify: `playwright.config.ts` (`webServer.env.MAIL_TRANSPORT = "console"`), `README.md` (jobs section: `npm run jobs:close-day`, Windows Task Scheduler daily at 00:30)

**Interfaces:**
- E2E (reuse `signIn`, `signOut`, `submitLogin` patterns from `auth.spec.ts`; move them to `tests/e2e/helpers.ts`):
  - `attendance.spec.ts`: Arjun checks in on Home → state chip "Working", timer runs → Take a break → Resume → Check out → state "Checked out"; the Attendance page shows today with hours; Arjun requests a correction for a past absent day → signs out → Ananya (manager@) sees it in Approvals with the badge count, approves → Arjun's day shows as present.
  - `people.spec.ts`: HR adds "Test Person" → lands on the profile with the toast; employee@ opening Neha's profile sees no Personal or Job & pay tabs and the page source does not contain Neha's seeded PAN; the sidebar footer (`.me`) is in the viewport at 1280×720; org chart lists Vikas Malhotra at the top.

- [ ] **Step 1:** Write the specs; `npm run test:e2e` — Expected: all pass (auth 6 + new).
- [ ] **Step 2:** `npm test && npm run typecheck && npm run lint && npm run build` — all green.
- [ ] **Step 3: Commit** `test: add Phase 1a end-to-end tests and job docs`.
