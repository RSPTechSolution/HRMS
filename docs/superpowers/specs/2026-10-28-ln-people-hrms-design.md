# LN People — HRMS Design Spec

**Date:** 2026-10-28
**Owner:** Subodh (LN Webworks)
**Status:** Draft for review
**Visual reference:** `.superpowers/brainstorm/307-1793173977/content/app-v2.html` (approved theme prototype)

---

## 1. Purpose

LN People is LN Webworks' internal HR system. It replaces spreadsheets and chat threads for everyday HR work: who works here, who is in today, who is on leave, what people are paid, what equipment they hold, and how they grow.

**Users:** every LN Webworks employee (self-service), reporting managers (approvals, team views), HR (administration, policies, payroll), and Admins (system settings).

**Success looks like:**
- Employees check in, apply for leave/WFH and download payslips without contacting HR.
- Managers and HR approve requests from one inbox, in two clicks.
- HR closes a monthly payroll from attendance and leave data with no re-keying.
- The interface feels like the approved prototype: calm, fast, animated, not template-like.

### 1.1 What the user decided vs what is assumed

| Topic | Decision | Source |
|---|---|---|
| Theme | "Nordic Calm": forest green / sun yellow / coral, Bricolage Grotesque + Manrope, custom cursor, micro-interactions, dark mode | User approved prototype |
| Modules | All 11: Employees & org, Attendance, Leave, WFH, Payroll, Onboarding/offboarding, Performance, Recruitment, Engagement, Assets, Timesheets/projects | User |
| Stack | Next.js full-stack (TypeScript) | User |
| Database | SQLite for now, seeded with realistic test data | User |
| Login | Email + password | User |
| Check-in | Web button, no restrictions | User |
| Approvals (leave, WFH) | Reporting manager, then HR | User |
| Leave accrual | Monthly | User |
| Leave rules | Carry forward, sandwich rule | User |
| Working hours | Flexible hours (no fixed start time) | User |
| Everything in §13 | Assumed defaults | Needs your confirmation |

---

## 2. Delivery phases

Each phase gets its own implementation plan and ships working software. A phase only depends on earlier phases.

| Phase | Contents | Depends on |
|---|---|---|
| **0. Foundation** | Project setup, auth, roles/permissions, app shell + design system, notifications, audit log, approval engine, settings, seed framework | — |
| **1. Core HR** | Employees & org, Documents, Attendance, Leave, Holidays, WFH, Engagement, Home dashboard | 0 |
| **2. Operations** | Assets, Onboarding/offboarding, Projects & timesheets | 1 |
| **3. Payroll** | Salary structures, statutory deductions, payroll runs, payslips, F&F | 1 (attendance + leave), 2 (offboarding) |
| **4. Talent** | Performance (goals, appraisal cycles), Recruitment (openings, pipeline, offers) | 1, 2 (onboarding hand-off) |

Plans are written one phase at a time, in order. Phases 0 and 1 are planned first.

---

## 3. Architecture

### 3.1 Approach

A single **Next.js App Router** application. Pages are server-rendered React Server Components; mutations go through **Server Actions**. All HR business rules live in a framework-free **domain layer** (`src/domain/`) of pure TypeScript functions that take plain data and return plain data, so they are unit-testable without a database or browser.

```
Browser ──► Next.js page (RSC) ──► src/server/<module>/queries.ts ──► Prisma ──► SQLite
        └─► form / button ──► Server Action (src/server/<module>/actions.ts)
                                 ├─ authorize (src/server/auth/permissions.ts)
                                 ├─ validate (zod schema)
                                 ├─ decide (src/domain/<module>/*.ts — pure)
                                 ├─ write (Prisma transaction) + audit log + notifications
                                 └─ revalidatePath
```

Rules of the layers:
- `src/domain/**` imports nothing from Next.js, Prisma or React.
- `src/server/**` is the only code that touches Prisma. Every exported action calls `requireUser()` and a permission check first.
- `src/app/**` (pages) and `src/components/**` never import Prisma.

### 3.2 Tech stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (latest stable, App Router), React, TypeScript `strict` | User choice |
| Database | SQLite via Prisma ORM | User choice; Prisma lets us switch to PostgreSQL by changing the provider and running migrations |
| Validation | zod | Shared schemas for forms and actions |
| Passwords | `@node-rs/argon2` (argon2id) | Modern password hashing, no native build issues on Windows |
| Sessions | Own DB-backed sessions (random token in httpOnly cookie, SHA-256 hash stored) | Simple, revocable, no JWT pitfalls |
| Styling | Global CSS design tokens (ported from the prototype) + CSS Modules | Keeps the approved look exactly; no utility-class soup |
| Dates | `date-fns` + `date-fns-tz`, timezone `Asia/Kolkata` | All business dates are IST |
| PDFs | `@react-pdf/renderer` | Payslips, offer letters, reports |
| Charts | Hand-built SVG components (as in prototype) | Small, on-brand, animatable |
| Files | Local disk `storage/` behind a `FileStore` interface | Swap to S3/R2 later without touching modules |
| Email | `Mailer` interface; console mailer in dev, SMTP (nodemailer) in prod | Password set/reset emails |
| Scheduled jobs | Idempotent job functions run by `npm run jobs:<name>` (OS cron / Task Scheduler) and an admin "Run now" button | No queue infrastructure needed at this size |
| Unit/integration tests | Vitest | Fast, TS-native |
| E2E tests | Playwright | One smoke suite per phase |

Money is always stored as **integer paise** (`Int`). Hours are stored as **integer minutes**. Calendar dates (work dates, leave dates, holidays) are stored as `YYYY-MM-DD` strings in IST; instants (check-in time, approvals) are stored as UTC `DateTime`.

SQLite note: Prisma's SQLite connector has limited enum support, so status/kind fields are `String` columns validated by zod and typed by TypeScript string-literal unions defined in `src/domain/**/types.ts`.

### 3.3 Folder structure

```
prisma/
  schema.prisma
  seed/                    # seed scripts, one file per module + index.ts
src/
  app/
    (auth)/login, set-password, forgot-password
    (app)/layout.tsx       # shell: sidebar, topbar, command menu, toasts
    (app)/home, attendance, time-off, team, people/[id], approvals,
          announcements, kudos, assets, projects, timesheets, payroll,
          payslips, performance, recruitment, onboarding, settings, reports
    api/files/[id]/route.ts   # authorised file download
  components/
    ui/                    # Button, Card, Pill, Avatar, Ring, Meter, Calendar, Toast, CommandMenu, Cursor…
    charts/                # BarChart, HeatCalendar, Sparkline
  domain/                  # pure business rules, one folder per module
  server/                  # auth, permissions, audit, notify, approvals, and one folder per module
  jobs/                    # scheduled job entry points
  lib/                     # dates, money, ids, env
tests/
  domain/  server/  e2e/
storage/                   # uploaded files (gitignored)
```

---

## 4. Cross-cutting foundations (Phase 0)

### 4.1 Authentication
- HR creates an employee → system creates a `User` with no password and emails a **set-password link** (token valid 72 h, single use).
- Login with work email + password. Wrong credentials show one generic message.
- **Rate limit:** 5 failed attempts per email per 15 min → locked for 15 min (stored in DB).
- **Forgot password:** emails a reset link (valid 1 h, single use); all existing sessions are revoked on reset.
- **Sessions:** 30-day sliding expiry; cookie `httpOnly`, `secure` in production, `SameSite=Lax`. "Sign out everywhere" in profile.
- Password policy: minimum 10 characters, not equal to email; checked with zod.
- Exited employees cannot log in (status check on every request).

### 4.2 Roles and permissions
Roles are additive. Everyone is an **Employee**. **Manager** is derived: anyone with at least one direct report. **HR**, **Payroll** and **Admin** are assigned flags.

| Capability | Employee | Manager | HR | Payroll | Admin |
|---|---|---|---|---|---|
| Own profile, attendance, leave, payslips | ✓ | ✓ | ✓ | ✓ | ✓ |
| View team (direct + indirect reports) attendance/leave | | ✓ | all | | all |
| First-step approvals for own reports | | ✓ | | | |
| Second-step (HR) approvals, overrides | | | ✓ | | ✓ |
| Create/edit employees, documents, policies, holidays | | | ✓ | | ✓ |
| Salary structures, payroll runs, bank files | | | | ✓ | ✓ |
| System settings, role assignment | | | | | ✓ |

Permissions are enforced in `src/server/auth/permissions.ts` via `can(user, action, resource)`; the UI hides what you cannot do, but the server is the authority.

### 4.3 Approval engine
One generic engine serves every request type, so approval behaviour is consistent.

- `ApprovalPolicy` (per request type) = ordered list of steps, each `MANAGER` or `HR`. Defaults:

| Request type | Steps |
|---|---|
| Leave | MANAGER → HR |
| WFH | MANAGER → HR |
| Attendance correction | MANAGER |
| Timesheet week | MANAGER |
| Resignation | MANAGER → HR |
| Goal set (performance) | MANAGER |

- **Routing rules:**
  - Requester has no manager, or the manager is the requester → MANAGER step is skipped.
  - A person never approves their own request. If the HR step would land on the requester (an HR employee), any *other* HR or Admin can act.
  - Any HR/Admin can act on the HR step; the first decision wins.
  - Decline at any step ends the request (`DECLINED`) with a required comment.
  - Requester can **withdraw** while `PENDING`.
- On final approval the engine calls the module's `onApproved(requestId)` hook (e.g. leave posts a ledger debit); on decline/withdraw, `onClosed`.
- **Approvals inbox** (`/approvals`): everything waiting on me, grouped by type, approve/decline inline (as on the prototype home card), bulk approve for HR.

### 4.4 Notifications
Stored in `Notification` (recipient, kind, title, link, readAt). Shown in the bell popover and on the home page. Events: request submitted (to next approver), approved/declined (to requester), kudos received, announcement posted, document verified, payslip published, task assigned (onboarding), interview assigned. Email is used only for auth in Phases 0–1; per-event email can be added later behind the same `notify()` call.

### 4.5 Audit log
`AuditLog(actorId, action, entityType, entityId, before JSON, after JSON, at)`. Written inside the same transaction as the change for: every approval decision, every leave-ledger entry, employee/profile edits by HR, salary changes, payroll finalisation, role changes, settings changes. HR/Admin can view and filter it per employee.

### 4.6 Settings
Admin-editable key/value settings with typed defaults:

| Key | Default |
|---|---|
| `company.name` | LN Webworks |
| `company.timezone` | Asia/Kolkata |
| `work.weekendDays` | Sat, Sun |
| `attendance.requiredDailyMinutes` | 540 (9 h) |
| `attendance.halfDayMinutes` | 270 (4 h 30 m) |
| `attendance.correctionWindowDays` | 30 |
| `leave.backdateWindowDays` | 30 |
| `wfh.monthlyLimit` | none |
| `offboarding.defaultNoticeDays` | 60 |

### 4.7 App shell and design system
Port the prototype to components with identical tokens (light + dark), fonts (Bricolage Grotesque for display, Manrope for UI, loaded via `next/font`), and interactions: sliding nav pill, Ctrl K command menu (pages, actions, people search), circular theme reveal, toasts, tooltips, count-up numbers, word-reveal headings, magnetic primary buttons, ripple, card spotlight/tilt, custom cursor (fine pointers only).

Non-negotiables carried from the prototype:
- `prefers-reduced-motion` disables movement; content is visible without JS.
- Keyboard reachable with visible focus; WCAG AA contrast in both themes.
- Mobile (≤ 820 px): sidebar becomes a bottom bar; cursor/tilt/magnetic effects off on touch.

### 4.8 Seed data
`npm run db:seed` resets the SQLite DB and builds a believable LN Webworks:
- 48 employees across Engineering, Design, QA, Sales, People; 6 managers; 2 HR; 1 Admin; 1 Payroll user. Indian names, realistic designations, join dates spread over 5 years, birthdays, a few on probation, 1 on notice.
- Known demo logins (printed after seeding), all with password `Password@123`: `admin@lnwebworks.test`, `hr@lnwebworks.test`, `manager@lnwebworks.test`, `employee@lnwebworks.test`.
- From Phase 1: 2026 holiday calendar, 3 months of attendance (with short days, corrections, WFH days), leave ledgers with accruals and taken leave, pending requests in every approval state, announcements, kudos.
- Each later phase extends the seed for its own data (assets, projects, timesheets, salary structures + 2 finalised payroll months, an appraisal cycle, open jobs with candidates).

---

## 5. Phase 1 — Employees & org

### 5.1 Data
- **Employee:** employee code (`LNW-0001`, auto), full name, preferred name, work email (unique, login), personal email, phone, date of birth, gender, blood group, joining date, probation end date, employment type (`FULL_TIME | INTERN | CONTRACT`), status (`ACTIVE | NOTICE | EXITED`), department, designation, reporting manager, work location, current + permanent address, emergency contact (name, relation, phone), bank account (holder, number, IFSC; HR/Payroll only), PAN and Aadhaar (stored masked except last 4 for everyone but HR/Payroll), photo, `showBirthday` (default true).
- **Department:** name, head (employee). **Designation:** title, level.

### 5.2 Behaviour
- HR creates/edits employees; creation triggers the set-password email (and, from Phase 2, the onboarding checklist).
- Employees can edit their own phone, personal email, addresses, emergency contact, photo, `showBirthday`; everything else is HR-only.
- Reporting manager changes are validated: no self-reporting and **no cycles** (A → B → A).
- **People directory** (prototype Team page): search, department filters, status dot (in office / WFH / on leave), profile page with tabs: Overview, Job, Documents, Attendance, Leave, Assets (Phase 2), Payslips (Phase 3, self/HR only).
- **Org chart:** collapsible tree from the CEO down, built from reporting managers.
- Exiting an employee (status `EXITED`) revokes sessions and hides them from the directory (still searchable by HR).

### 5.3 Documents
- Upload PDF/JPG/PNG, ≤ 10 MB, categories: ID proof, Address proof, Education, Experience, Offer/Appointment letter, Other.
- Visible to the employee and HR; managers do not see personal documents.
- HR can mark **Verified** (notifies employee). Files are stored outside the web root and served only through `/api/files/[id]` after a permission check.

---

## 6. Phase 1 — Attendance (flexible hours)

### 6.1 Model
- `AttendanceEvent(employeeId, at, kind: IN | OUT | BREAK_START | BREAK_END, source: WEB | CORRECTION | SYSTEM)`.
- `AttendanceDay(employeeId, workDate, firstInAt, lastOutAt, workedMinutes, breakMinutes, status, flags)` — derived from events, recomputed whenever events for that day change.
- **Work date** = IST calendar date of the first `IN`. A session that crosses midnight belongs to the day it started.

### 6.2 Check-in flow (prototype clock card)
States: `NOT_STARTED → WORKING ⇄ ON_BREAK → CHECKED_OUT`, and `CHECKED_OUT → WORKING` ("check in again", new session same day). No location or IP restriction.
- Invalid transitions (e.g. `BREAK_START` while not working) are rejected by the domain function `nextAttendanceState(state, kind)`.
- `workedMinutes` = sum of IN→OUT spans minus breaks.

### 6.3 Day status (pure function `computeDayStatus`)
Evaluated per employee per day, in this priority order:
1. Holiday → `HOLIDAY`
2. Weekend → `WEEKEND`
3. Approved full-day leave → `LEAVE` (half-day leave lowers the required minutes by half)
4. Has events but no final `OUT` after the day ends → `MISSING_CHECKOUT` (flag; needs a correction)
5. `workedMinutes ≥ required` → `PRESENT`
6. `workedMinutes ≥ halfDayMinutes` → `SHORT` (flagged; no automatic deduction)
7. `workedMinutes > 0` → `HALF_DAY`
8. No events on a past working day → `ABSENT`

Approved WFH adds the flag `WFH` without changing the status logic. "Late marks" do not exist under flexible hours; **short-day flags** replace them.

A nightly job (`jobs:close-attendance-day`, 00:30 IST) finalises yesterday: sets `MISSING_CHECKOUT` / `ABSENT` and notifies the employee.

### 6.4 Corrections
Employee picks a past date (within `attendance.correctionWindowDays`), enters actual in/out times (and optional breaks) and a reason → approval (MANAGER). On approval the day's events are replaced by `CORRECTION` events and the day is recomputed. One open correction per day.

### 6.5 Views and reports
- **My attendance** (prototype): month heat calendar, stats (average day, short days, absences, leave), today timeline.
- **Team attendance** (managers/HR): today's board (in / on break / not in / on leave / WFH), month grid per person.
- **Monthly report** (HR, managers for their team): per employee present, short, half, absent, leave, WFH, holidays, missing check-outs, total and average hours; CSV export. This report is the input to payroll LOP in Phase 3.

---

## 7. Phase 1 — Leave & holidays

### 7.1 Leave types (seeded defaults; HR-editable)

| Type | Annual quota | Accrual | Carry forward cap | Half day | Sandwich applies |
|---|---|---|---|---|---|
| Casual (CL) | 12 | 1.0 / month | 0 (lapses) | Yes | Yes |
| Sick (SL) | 8 | 0.67 / month (tracked exactly, usable balance floored to 0.5 — see 7.2) | 0 | Yes | No |
| Earned (EL) | 15 | 1.25 / month | 10 days | No | Yes |
| Leave Without Pay (LWP) | Unlimited | — | — | Yes | Yes |

Additional fields per type: `eligibleAfterProbation` (EL: true), `allowBackdated` (SL: true, others: false), `active`.

### 7.2 Balance ledger
Balances are never stored as a single number; they are the sum of `LeaveLedgerEntry(employeeId, leaveTypeId, amount, kind, refId, period, note)`:
`ACCRUAL | CARRY_FORWARD | LAPSE | DEBIT | REVERSAL | ADJUSTMENT`.

- **Monthly accrual** (`jobs:accrue-leave`, 1st of month 01:00 IST): credits each active employee the monthly amount per type. Idempotent via a unique key on `(employeeId, leaveTypeId, kind, period)`. Fractional accruals are tracked exactly in hundredths; the *displayed* and *usable* balance is floored to the nearest 0.5.
- **Joiners:** accrue for the joining month only if they joined on or before the 15th.
- **Year end** (`jobs:year-end-leave`, 1 Jan 00:30 IST): for each type, `CARRY_FORWARD` = min(balance, cap) into the new year and `LAPSE` the rest.
- **HR adjustment:** signed amount + mandatory note, audited.
- **Available** = balance − days in `PENDING` requests (pending requests reserve balance).

### 7.3 Applying
Inputs: leave type, start date, end date, half-day on start and/or end (if allowed), reason (required for > 2 days), optional attachment (e.g. medical certificate).

`calculateLeaveDays(request, calendar, adjacentRequests)` (pure):
1. Count working days in the range (not weekend, not holiday); half-day flags subtract 0.5 each.
2. **Sandwich rule** (types with `sandwich=true`): weekend/holiday days that lie *between* two leave days are counted as leave. This applies inside one request and across an adjacent request of a sandwich type that is pending or approved (e.g. Fri approved + Mon requested → Sat and Sun are added to the Monday request). Non-working days at the outer edges of a range are never counted.
3. Return `{ days, breakdown[] }` so the UI can show exactly which dates are charged and why.

Validation (all server-side, also shown live in the prototype's summary bar):
- End ≥ start; range ≤ 60 calendar days.
- No overlap with the employee's pending/approved leave or WFH on the same dates.
- Start date not in the past unless the type allows backdating (within `leave.backdateWindowDays`).
- Probation: type not available until probation end if `eligibleAfterProbation`.
- `days ≤ available`; otherwise blocked with a suggestion to apply the remainder as LWP.
- `days > 0` (a range of only weekends/holidays is rejected).

Flow: submit → approval engine (MANAGER → HR) → on final approval post `DEBIT` → attendance days become `LEAVE`.

### 7.4 Cancelling
- `PENDING`: requester withdraws; reservation released.
- `APPROVED` and start date in the future: requester cancels → `REVERSAL` posted, approvers notified.
- `APPROVED` and already started: only HR can cancel (full or remaining days), posting a partial `REVERSAL`.

### 7.5 Holidays
HR manages a holiday list per year (date, name). Seeded with the 2026 list used in the prototype (Republic Day, Holi, Independence Day, Gandhi Jayanti, Dussehra, Diwali, Govardhan Puja, Guru Nanak Jayanti, Christmas, etc.). Holidays feed leave day counting, attendance status and the "Coming up" card. Adding a holiday after leave was approved triggers a recalculation proposal shown to HR (not silent changes).

### 7.6 Views
Time off page as in the prototype: type selector with balances, range calendar with hover preview, half-day switch, live summary, request history with status pills, balances with meters. Team calendar for managers/HR showing who is away per day.

---

## 8. Phase 1 — Work from home

- Request one or more dates (or a range) with a reason → approval engine (MANAGER → HR).
- Validation: not on weekends/holidays/approved leave; no duplicates; optional `wfh.monthlyLimit` per calendar month (default: no limit).
- Approved WFH flags the attendance day `WFH` and shows on the "Away today" board and directory status dot.
- Withdraw/cancel rules mirror leave (§7.4), without ledger entries.

---

## 9. Phase 1 — Engagement & home dashboard

- **Announcements:** HR posts title + body (markdown subset), audience (everyone or chosen departments), optional pin and expiry date. Shown as the dismissible banner (pinned) and in an announcements list. Dismissal is per user.
- **Kudos:** any employee → another (not self), message ≤ 280 chars, optional tag (Teamwork, Ownership, Client love, Craft). Public kudos wall, the home carousel (with pause control), and a notification to the receiver.
- **Birthdays & work anniversaries:** derived from profile dates; shown in "Coming up" for the next 14 days, respecting `showBirthday`. No year of birth is ever displayed.
- **Home dashboard** (prototype): greeting, clock card, KPI tiles (leave left, average day, full days this month — replaces the prototype's "On time" since there is no fixed start time — and requests to review for managers), hours chart (last 10 working days, 9 h target line), time-off ring, kudos carousel, away today, approvals card (managers/HR), coming up.

---

## 10. Phase 2 — Operations

### 10.1 Assets
- **Asset:** tag (`LNW-LAP-001`, auto per category), category (Laptop, Monitor, Phone, Accessory, Other), brand, model, serial number (unique), purchase date, cost (paise), vendor, warranty end, status `IN_STOCK | ASSIGNED | IN_REPAIR | RETIRED | LOST`, notes.
- **Assignment history:** assign to employee (date, condition), employee **acknowledges** in-app, return (date, condition, notes). One active assignment per asset.
- Employees see "My assets" and can **report an issue** (creates a note + notifies HR/IT owner).
- Alerts: warranty ending in 30 days (HR dashboard list).
- Assets tab on employee profile; asset return is a blocking item in offboarding (§10.2).

### 10.2 Onboarding & offboarding
- **Checklist templates** (HR-managed): ordered tasks, each with owner role (`HR | IT | MANAGER | EMPLOYEE`), due offset in days relative to the joining date or last working day, and optional "blocking" flag.
- **Onboarding:** creating an employee (or hiring a candidate in Phase 4) instantiates the onboarding template. Default tasks: send welcome email, collect documents, assign laptop, create accounts, buddy assigned, first-week 1:1, probation review reminder. The new joiner sees a friendly progress page; owners see their tasks in the approvals inbox.
- **Offboarding:**
  1. Employee submits resignation (reason, proposed last working day) → approval engine (MANAGER → HR). HR sets the final last working day (default: resignation date + `offboarding.defaultNoticeDays`; HR can shorten or extend).
  2. Status becomes `NOTICE`; exit checklist instantiated: asset return (auto-generated, one task per assigned asset, blocking), knowledge transfer, access revocation, exit interview, experience letter, F&F ready for payroll.
  3. Exit interview: short form (reason category, rating 1–5 on manager/team/growth, free text), visible only to HR.
  4. On the last working day the nightly job sets status `EXITED` and revokes access — **only if** all blocking tasks are done; otherwise HR is alerted and the employee remains `NOTICE` (access ends regardless at LWD + 1).
- HR may also initiate an exit (termination) directly with the same checklist.

### 10.3 Projects & timesheets
- **Client:** name, country, active. **Project:** code, name, client, billable flag, status (`ACTIVE | ON_HOLD | CLOSED`), project manager (an employee), members.
- **Timesheet entry:** date, project, task description, minutes (15-min steps), billable (defaults from project). Employees log against projects they're members of.
- **Week:** Monday–Sunday. Employee **submits** the week → approval (MANAGER of the employee). Approved weeks are locked; declined weeks reopen with the comment.
- Validation: daily total ≤ 24 h; entries not in the future; can't log on a closed project; warning (not block) when the day's logged time exceeds the attendance worked time by > 30 min, or is below 75% of it.
- Reminders: Friday 17:00 IST notification if the week isn't submitted; Monday list of missing timesheets to managers.
- **Reports:** hours by project, client, employee and period; billable vs non-billable; utilisation (billable hours ÷ worked hours); CSV export.

---

## 11. Phase 3 — Payroll (India)

> Statutory rates and tax slabs below are **seed configuration**, not hard-coded logic. HR and the company's CA must verify them before the first live run.

### 11.1 Salary structure
Per employee, effective-dated (`SalaryStructure(employeeId, effectiveFrom, annualCtcPaise, components[])`). Changing salary creates a new structure; history is kept.

Default template (configurable components with formulas):

| Component | Rule |
|---|---|
| Basic | 50% of monthly CTC (excluding employer PF) |
| HRA | 40% of Basic (non-metro) |
| Special allowance | Balancing figure so that gross + employer PF = monthly CTC |
| Employer PF | 12% of PF wages, capped at PF wage ceiling ₹15,000 → max ₹1,800 |

### 11.2 Deductions
| Deduction | Default rule |
|---|---|
| Employee PF | 12% of Basic, capped at ₹1,800/month (opt-in for full basic per employee) |
| ESI | If monthly gross ≤ ₹21,000: employee 0.75%, employer 3.25% |
| Professional / development tax | State slab table; default Punjab: ₹200/month when annual taxable income exceeds ₹2.5 lakh |
| TDS | New tax regime only (v1): annual projection → slab tax → rebate → 4% cess → spread over remaining months of the FY |
| LOP | (Monthly gross ÷ calendar days in month) × LOP days |

LOP days for a month = LWP days + `ABSENT` days + 0.5 × `HALF_DAY` days, read from the locked attendance month. `SHORT` days do not cause LOP.

### 11.3 Payroll run
1. **Create run** for a month → snapshot active employees, structures and attendance summary (attendance for that month is locked; corrections after lock go to next month as arrears).
2. **Compute** (pure `computePayslip(input)` per employee): earnings, prorations for mid-month joiners/leavers, LOP, deductions, employer contributions, net pay. All arithmetic in paise; each component rounded to the nearest rupee.
3. **Review:** HR/Payroll sees a table with variance vs last month (highlight > 10% change), can add one-off lines (bonus, arrears, recovery) with notes, and re-compute.
4. **Finalise:** immutable; payslips published (notification + PDF), bank transfer CSV (account, IFSC, amount, reference) and statutory summaries (PF, ESI, PT, TDS totals) exported. Corrections after finalisation are made as adjustment lines in the next run.
- **Payslips page:** employees see/download their own; nobody else except Payroll/Admin.
- **F&F settlement:** for an exiting employee, computes pending salary to LWD, earned-leave encashment (balance × Basic ÷ 26), notice-period shortfall recovery (if HR marks it), and asset recovery amounts entered by HR; produces an F&F statement PDF.
- **Annual:** Form 16 data export (CSV) for the CA — not the official form generation.

---

## 12. Phase 4 — Talent

### 12.1 Performance
- **Appraisal cycle** (HR): name, period (default half-yearly: Apr–Sep, Oct–Mar), phase dates: goal setting → mid-cycle check-in → self review → manager review → calibration → release.
- **Goals:** employee drafts 3–7 goals with weight % (must total 100) and success measure → MANAGER approval (approval engine). Goals can be updated with progress notes during the cycle.
- **Reviews:** self rating (1–5 per goal + overall comment), then manager rating (1–5 per goal + strengths + improvements + overall). Weighted score computed by `computeAppraisalScore`.
- **Calibration:** HR sees the distribution per department, can adjust the final rating with a mandatory note (audited).
- **Release:** employee sees final rating and manager comments; acknowledges. Ratings feed an optional increment recommendation % that Payroll can apply as a new salary structure.
- Kudos received in the period are shown alongside the review as context.

### 12.2 Recruitment
- **Job opening:** title, department, designation, positions, location, employment type, description, hiring manager, status (`DRAFT | OPEN | ON_HOLD | CLOSED`).
- **Candidate:** name, email, phone, resume (file), source (Referral, LinkedIn, Naukri, Website, Other), current/expected CTC, notice period, tags. Duplicate check by email/phone.
- **Pipeline** (kanban with drag and drop, keyboard alternative): Applied → Screening → Interview 1 → Interview 2 → HR round → Offer → Hired | Rejected (with reason). Stage changes are logged.
- **Interviews:** schedule (date/time, interviewer, mode/link), interviewer gets a notification and submits a scorecard (rating 1–5, strengths, concerns, recommend yes/no).
- **Offer:** generate offer letter PDF from an HR template with merge fields; mark accepted/declined.
- **Hire:** converting a candidate creates the Employee (prefilled), triggers the set-password email and the onboarding checklist.
- Referral: employees can refer a candidate to an open job (appears as source = Referral with referrer).
- No public careers page in v1.

---

## 13. Assumptions to confirm

These are defaults chosen to keep moving. Each is configuration or a small change if wrong.

1. Weekends are Saturday and Sunday for everyone.
2. Required day under flexible hours is **9 h** of work (breaks excluded); under 4 h 30 m is a half day; short days are flagged, never auto-deducted.
3. Attendance corrections need **manager approval only** (not HR).
4. Leave quotas: CL 12, SL 8, EL 15/year; EL carry-forward cap 10; CL and SL lapse at year end; leave year = calendar year.
5. Sandwich rule applies to CL, EL and LWP, not SL.
6. Insufficient balance **blocks** the request (user did not choose "negative → unpaid"); the UI suggests LWP for the remainder.
7. EL is available only after probation; SL can be backdated up to 30 days.
8. No WFH monthly limit by default.
9. Default notice period 60 days.
10. Payroll: new tax regime only; non-metro HRA (40%); PF capped at ₹15,000 wage ceiling; Punjab PT; EL encashment on exit at Basic ÷ 26 per day.
11. Appraisal cycle is half-yearly.
12. Managers see their direct **and indirect** reports.
13. A single company and office (Mohali) — no multi-entity or multi-location payroll.
14. English UI only; INR currency only.

---

## 14. Non-functional requirements

- **Performance:** with 200 employees and 3 years of data, every page renders server-side in < 500 ms on the dev machine; the attendance check-in action responds in < 200 ms.
- **Security:** argon2id hashing; session tokens hashed at rest; every server action authorised; PII (bank, PAN, Aadhaar, salary) visible only to permitted roles and never sent to the client for others; uploads type- and size-checked and served via authorised route; no secrets in the repo (`.env`, `.env.example` committed).
- **Data integrity:** multi-row changes in Prisma transactions; jobs idempotent; money in paise; balances derived from ledgers.
- **Backups:** nightly copy of the SQLite file + `storage/` (dev/staging). Moving to PostgreSQL before production go-live is recommended.
- **Accessibility:** WCAG 2.2 AA; reduced motion; keyboard support for every action including the kanban and calendar.
- **Browsers:** current Chrome, Edge, Firefox, Safari; responsive down to 375 px.

---

## 15. Testing strategy

- **Domain unit tests (Vitest)** — the core of the suite, written test-first: approval routing, attendance state machine and day status, leave day calculation (sandwich cases, half days, holidays, cross-request), accrual/carry-forward/lapse, timesheet validation, payslip computation (PF cap, ESI threshold, LOP, proration, TDS slabs, rounding), appraisal score, manager-cycle detection.
- **Server integration tests (Vitest + temp SQLite per test file):** each server action's permission checks (forbidden for wrong role), validation errors, and the database effects (ledger rows, audit rows, notifications).
- **E2E (Playwright):** one smoke suite per phase using seeded logins — e.g. Phase 1: employee logs in → checks in → applies leave; manager approves; HR approves; balance drops; attendance shows LEAVE.
- `npm test` runs unit + integration; `npm run test:e2e` runs Playwright against a freshly seeded DB.

---

## 16. Out of scope (all phases, v1)

Native mobile apps, biometric device integration, geofencing, multi-company/multi-currency, old tax regime and investment declarations, official Form 16/ECR file generation, expense reimbursements, public careers site, Slack/Teams integrations, SSO. Each can be added later without restructuring.
