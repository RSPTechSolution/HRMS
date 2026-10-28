# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running LN People app where seeded employees sign in with email + password, land in the approved Nordic Calm shell (sidebar, command menu, notifications, dark mode, custom cursor), and where the shared foundations every later module needs — roles, approval engine, audit log, notifications, settings, seed data — exist and are tested.

**Architecture:** One Next.js 16 App Router app. Pure business rules live in `src/domain/**` (no Next/Prisma/React imports). `src/server/**` is the only code that touches Prisma; Next-specific wrappers (cookies, redirects) are kept in thin files so the rest is testable in Vitest. Pages and components never import Prisma.

**Tech Stack:** Next.js 16.4.3, React 19.3, TypeScript 5, Prisma 7.10.1 with `@prisma/adapter-better-sqlite3` (SQLite), zod 4, `@node-rs/argon2`, Vitest 5, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-28-ln-people-hrms-design.md` (§3 Architecture, §4 Cross-cutting foundations, §14 NFRs, §15 Testing). Visual reference: `.superpowers/brainstorm/307-1793173977/content/app-v2.html`.

**Scope note:** The approvals *inbox page* (`/approvals`) ships in Phase 1 together with the first real request type (leave). Phase 0 delivers the engine and its tests; with no request types registered there is nothing for an inbox to show. Likewise the per-employee audit history view (spec §4.5) ships with the employee profile in Phase 1; Phase 0 records audit entries and exposes `listAudit`.

## Global Constraints

- Node.js 24.x, npm 11.x (verified: Node v24.19.0, npm 11.1.0).
- Exact dependency versions: `next@16.4.3`, `react@19.3.0`, `react-dom@19.3.0`, `typescript@^5`, `prisma@7.10.1`, `@prisma/client@7.10.1`, `@prisma/adapter-better-sqlite3@7.10.1`, `better-sqlite3@12.11.1`, `zod@4.6.7`, `@node-rs/argon2@2.2.2`, `vitest@5.0.5`, `@playwright/test@1.64.1`, `@types/node@^24`. **Do not** install `prisma@latest` — npm's `latest` tag currently points at `8.0.0-rc`.
- `next.config.ts` must **not** enable `cacheComponents` or `partialPrefetching`; every page in this app is per-user and dynamic.
- Next.js 16 conventions: request interception lives in `src/proxy.ts` (exported `proxy` function, not `middleware`); `cookies()`, `params` and `searchParams` are async. Read `node_modules/next/dist/docs/` before using any Next API not shown in this plan.
- Prisma 7: generator `prisma-client` with output `../src/generated/prisma`; import the client from `@/generated/prisma/client`; the datasource URL lives in `prisma.config.ts`; `prisma generate` is **not** run automatically by `migrate dev` — run it explicitly (also wired to `postinstall`).
- Never run destructive Prisma CLI commands (`migrate reset`, `db push --force-reset`); Prisma blocks them for AI agents. Test and E2E databases are rebuilt with `prisma/apply-migrations.ts`.
- Layering: `src/domain/**` imports nothing from `next`, `react`, `@prisma/*` or `@/server`. `src/app/**` and `src/components/**` never import `@/lib/db` or `@/generated/prisma`.
- Status/kind columns are `String` in Prisma and typed by string-literal unions in `src/domain/**/types.ts`.
- Emails are stored and compared lowercase. Business timezone is `Asia/Kolkata`.
- UI copy: plain, friendly English; errors say what to do next ("Enter your work email and password.").
- Visual design: tokens, fonts (Bricolage Grotesque display, Manrope UI) and interactions from the approved prototype; `prefers-reduced-motion` disables movement; visible focus on every control.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Open redirect through `?next=` on login** — `/login?next=//evil.com` or `https://evil.com` must land on `/home`. Pinned in Task 3 (`safeNext` tests).
2. **Exited employee with live sessions** — once an employee is `EXITED`, existing session cookies stop working on the next request and password reset sends nothing. Pinned in Task 4 and Task 6.
3. **Requester without an active manager** — a MANAGER-only policy for someone with no manager (or an exited manager) must still route to HR rather than auto-approve or dead-end. Pinned in Task 10 (`planSteps`) and Task 11 (exited manager).
4. **One person approving twice / racing approvers** — a person who decided step 1 (including HR overriding a manager step) cannot also decide step 2, and a repeated decision is refused. Pinned in Task 10 and Task 11. Truly simultaneous decisions are guarded by the conditional `updateMany` claim in `decideApproval` ("Someone else already acted on this request."); SQLite serialises transactions so this path is covered by review, not a test.
5. **Bad settings data** — a corrupted stored setting value falls back to the default instead of crashing every page; a half-day threshold ≥ the full day is rejected. Pinned in Task 9.

---

## File Map

```
package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts
prisma.config.ts, .env.example
prisma/schema.prisma                     Phase 0 models
prisma/apply-migrations.ts               rebuilds a SQLite file from migrations (tests/E2E)
prisma/seed/{data,clear,seed,run}.ts     seed data + runner
src/proxy.ts                             optimistic auth redirect + cookie refresh
src/lib/{db,crypto,env,safe-next,avatar,time,session-config}.ts
src/domain/auth/{types,password-policy,lockout,permissions}.ts
src/domain/settings/settings.ts
src/domain/approvals/{types,routing,decide}.ts
src/server/db-types.ts
src/server/auth/{password,users,sessions,login,password-tokens,session-cookie,current-user}.ts
src/server/mail/mailer.ts
src/server/{audit,notifications,settings,profile,shell,home}.ts
src/server/approvals/{registry,engine}.ts
src/app/layout.tsx, globals.css, page.tsx
src/app/(auth)/{layout,actions}.tsx|ts, login/, forgot-password/, set-password/
src/app/(app)/{layout,actions}.tsx|ts, home/, profile/, settings/
src/components/ui/{icon-names.ts,Icon,IconSprite,Avatar,SubmitButton,WordReveal,Toaster}.tsx
src/components/shell/{nav.ts,Sidebar,Topbar,SearchTrigger,ThemeToggle,NotificationsBell,CommandMenu,Interactions}.tsx
src/components/settings/SettingRow.tsx
tests/stubs/empty.ts, tests/setup/global-setup.ts, tests/helpers/db.ts
tests/{lib,domain,server}/**.test.ts, tests/seed.test.ts, tests/proxy.test.ts
tests/e2e/{prepare-db.ts,auth.spec.ts}
```

---

### Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.env.example`, `.env`, `vitest.config.ts`, `tests/stubs/empty.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `tests/lib/sanity.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `db:generate`, `db:migrate`, `db:seed`, `test`, `test:watch`, `test:e2e`; Vitest config with `@` → `src` alias and `server-only` stubbed.

- [ ] **Step 1: Configure git identity for this repo**

```bash
git config user.name "Subodh"
git config user.email "subodh@lnwebworks.com"
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "ln-people",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed/run.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "tsx tests/e2e/prepare-db.ts && next build && playwright test",
    "postinstall": "prisma generate"
  }
}
```

- [ ] **Step 3: Install dependencies with pinned versions**

```bash
npm i next@16.4.3 react@19.3.0 react-dom@19.3.0 @prisma/client@7.10.1 @prisma/adapter-better-sqlite3@7.10.1 @node-rs/argon2@2.2.2 zod@4.6.7 server-only@0.0.1
npm i -D typescript@^5 @types/node@^24 @types/react@^19 @types/react-dom@^19 eslint@^9 eslint-config-next@16.4.3 prisma@7.10.1 better-sqlite3@12.11.1 @types/better-sqlite3 vitest@5.0.5 tsx dotenv @playwright/test@1.64.1
```

Expected: both installs finish with `found 0 vulnerabilities` (the `postinstall` `prisma generate` may warn that no schema exists yet — that is fine until Task 2).

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Write `next.config.ts` and `eslint.config.mjs`**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "playwright-report/**", "test-results/**"]),
]);
```

- [ ] **Step 6: Write env files and update `.gitignore`**

`.env.example` (committed) and `.env` (not committed) both contain:

```
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3000"
```

Replace `.gitignore` with:

```
.superpowers/
node_modules/
.next/
out/
.env
storage/
*.db
*.db-journal
*.db-wal
*.db-shm
/src/generated/
next-env.d.ts
*.tsbuildinfo
test-results/
playwright-report/
```

- [ ] **Step 7: Write Vitest config and the `server-only` stub**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    env: { DATABASE_URL: "file:./test.db" },
    fileParallelism: false,
  },
});
```

```ts
// tests/stubs/empty.ts
export {};
```

- [ ] **Step 8: Write a minimal root layout and page**

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
export default function Page() {
  return <main>LN People</main>;
}
```

- [ ] **Step 9: Write a sanity test, run it, typecheck and build**

```ts
// tests/lib/sanity.test.ts
import { describe, expect, it } from "vitest";

describe("tooling", () => {
  it("runs TypeScript tests", () => {
    const sum: number = [1, 2, 3].reduce((a, b) => a + b, 0);
    expect(sum).toBe(6);
  });
});
```

Run: `npm test`
Expected: `Test Files  1 passed`.

Run: `npm run typecheck && npm run build`
Expected: typecheck prints nothing; build ends with a route table containing `/`.

- [ ] **Step 10: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs .env.example vitest.config.ts tests src
git commit -m "chore: scaffold Next.js 16 app with Vitest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Database schema, client and test harness

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `prisma/apply-migrations.ts`, `prisma/seed/clear.ts`, `src/lib/db.ts`, `src/server/db-types.ts`, `tests/setup/global-setup.ts`, `tests/helpers/db.ts`, `tests/server/db.test.ts`
- Modify: `vitest.config.ts` (add `globalSetup`)

**Interfaces:**
- Produces: `db: PrismaClient` from `@/lib/db`; `type DbTx = Prisma.TransactionClient`, `type Db = PrismaClient | DbTx` from `@/server/db-types`; `applyMigrations(dbFile: string): void`; `clearAll(db: PrismaClient): Promise<void>`; test helpers `resetDb(): Promise<void>` and `makeEmployee(opts?): Promise<{ employee: Employee; user: User }>`.

- [ ] **Step 1: Write `prisma.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model Department {
  id        String     @id @default(cuid())
  name      String     @unique
  employees Employee[]
}

model Employee {
  id           String      @id @default(cuid())
  code         String      @unique
  fullName     String
  workEmail    String      @unique
  designation  String
  status       String      @default("ACTIVE") // ACTIVE | NOTICE | EXITED
  joinedOn     String // YYYY-MM-DD (IST calendar date)
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  managerId    String?
  manager      Employee?   @relation("Reports", fields: [managerId], references: [id])
  reports      Employee[]  @relation("Reports")
  user         User?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model User {
  id            String          @id @default(cuid())
  email         String          @unique
  passwordHash  String?
  isHR          Boolean         @default(false)
  isPayroll     Boolean         @default(false)
  isAdmin       Boolean         @default(false)
  employeeId    String          @unique
  employee      Employee        @relation(fields: [employeeId], references: [id])
  sessions      Session[]
  tokens        PasswordToken[]
  notifications Notification[]
  createdAt     DateTime        @default(now())
}

model Session {
  id        String   @id // sha256(token)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}

model PasswordToken {
  id        String    @id // sha256(token)
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  purpose   String // SET | RESET
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, purpose])
}

model LoginAttempt {
  id      String   @id @default(cuid())
  email   String
  success Boolean
  at      DateTime @default(now())

  @@index([email, at])
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  kind      String
  title     String
  link      String?
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, readAt])
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String
  entityId   String
  before     String? // JSON
  after      String? // JSON
  at         DateTime @default(now())

  @@index([entityType, entityId])
}

model Setting {
  key   String @id
  value String // JSON
}

model ApprovalPolicy {
  type  String @id
  steps String // JSON array of "MANAGER" | "HR"
}

model ApprovalRequest {
  id          String         @id @default(cuid())
  type        String
  subjectId   String
  requesterId String // Employee id
  status      String         @default("PENDING") // PENDING | APPROVED | DECLINED | WITHDRAWN
  currentStep Int            @default(0)
  summary     String
  steps       ApprovalStep[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([type, subjectId])
  @@index([status, type])
}

model ApprovalStep {
  id          String          @id @default(cuid())
  requestId   String
  request     ApprovalRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  order       Int
  role        String // MANAGER | HR
  approverId  String? // Employee id for MANAGER steps; null = any HR/Admin
  decision    String? // APPROVED | DECLINED
  decidedById String?
  comment     String?
  decidedAt   DateTime?

  @@unique([requestId, order])
}
```

- [ ] **Step 3: Create the first migration and generate the client**

Run: `npx prisma migrate dev --name foundation`
Expected: `prisma/migrations/<timestamp>_foundation/migration.sql` created and applied to `dev.db`; "Your database is now in sync with your schema."

Run: `npx prisma generate`
Expected: `Generated Prisma Client (7.10.1) to .\src\generated\prisma`.

- [ ] **Step 4: Write the DB client and shared DB types**

```ts
// src/lib/db.ts
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

```ts
// src/server/db-types.ts
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export type DbTx = Prisma.TransactionClient;
export type Db = PrismaClient | DbTx;
```

- [ ] **Step 5: Write the migration applier and the table-clearing helper**

```ts
// prisma/apply-migrations.ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/** Recreates a SQLite file from scratch by running every Prisma migration in order. Tests and E2E only. */
export function applyMigrations(dbFile: string, migrationsDir = path.resolve("prisma/migrations")): void {
  for (const f of [dbFile, `${dbFile}-journal`, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(f, { force: true });
  const sqlite = new Database(dbFile);
  try {
    const dirs = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) sqlite.exec(fs.readFileSync(path.join(migrationsDir, dir, "migration.sql"), "utf8"));
  } finally {
    sqlite.close();
  }
}
```

```ts
// prisma/seed/clear.ts
import type { PrismaClient } from "@/generated/prisma/client";

/** Deletes every row, children first. Later phases add their tables at the top of this list. */
export async function clearAll(db: PrismaClient): Promise<void> {
  await db.approvalStep.deleteMany();
  await db.approvalRequest.deleteMany();
  await db.approvalPolicy.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.setting.deleteMany();
  await db.passwordToken.deleteMany();
  await db.session.deleteMany();
  await db.loginAttempt.deleteMany();
  await db.user.deleteMany();
  await db.employee.updateMany({ data: { managerId: null } });
  await db.employee.deleteMany();
  await db.department.deleteMany();
}
```

- [ ] **Step 6: Write the Vitest global setup and test helpers**

```ts
// tests/setup/global-setup.ts
import { applyMigrations } from "../../prisma/apply-migrations";

export default function setup(): void {
  applyMigrations("./test.db");
}
```

Add `globalSetup` to `vitest.config.ts` inside `test`:

```ts
    globalSetup: ["tests/setup/global-setup.ts"],
```

```ts
// tests/helpers/db.ts
import { db } from "@/lib/db";
import { clearAll } from "../../prisma/seed/clear";

export async function resetDb(): Promise<void> {
  await clearAll(db);
}

let seq = 0;

export type MakeEmployeeOptions = {
  name?: string;
  managerId?: string | null;
  isHR?: boolean;
  isAdmin?: boolean;
  isPayroll?: boolean;
  status?: "ACTIVE" | "NOTICE" | "EXITED";
  passwordHash?: string | null;
};

export async function makeEmployee(opts: MakeEmployeeOptions = {}) {
  seq += 1;
  const name = opts.name ?? `Person ${seq}`;
  const email = `person${seq}.${Date.now()}@lnwebworks.test`;
  const employee = await db.employee.create({
    data: {
      code: `T-${seq}-${Date.now()}`,
      fullName: name,
      workEmail: email,
      designation: "Engineer",
      joinedOn: "2025-01-01",
      status: opts.status ?? "ACTIVE",
      managerId: opts.managerId ?? null,
    },
  });
  const user = await db.user.create({
    data: {
      email,
      employeeId: employee.id,
      isHR: !!opts.isHR,
      isAdmin: !!opts.isAdmin,
      isPayroll: !!opts.isPayroll,
      passwordHash: opts.passwordHash ?? null,
    },
  });
  return { employee, user };
}
```

- [ ] **Step 7: Write the failing DB harness test**

```ts
// tests/server/db.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeEmployee, resetDb } from "../helpers/db";

describe("database harness", () => {
  beforeEach(resetDb);

  it("creates an employee linked to a user account", async () => {
    const boss = await makeEmployee({ name: "Ananya Sharma" });
    const { employee, user } = await makeEmployee({ name: "Arjun Mehta", managerId: boss.employee.id });
    const loaded = await db.employee.findUniqueOrThrow({ where: { id: employee.id }, include: { manager: true, user: true } });
    expect(loaded.manager?.fullName).toBe("Ananya Sharma");
    expect(loaded.user?.id).toBe(user.id);
  });

  it("resetDb removes everything", async () => {
    await makeEmployee();
    await resetDb();
    expect(await db.employee.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  });
});
```

- [ ] **Step 8: Run the tests**

Run: `npm test`
Expected: `Test Files  2 passed`, `Tests  3 passed`. (If it fails with "no such table", check `globalSetup` was added and the migration folder exists.)

- [ ] **Step 9: Commit**

```bash
git add prisma prisma.config.ts src/lib/db.ts src/server/db-types.ts tests vitest.config.ts
git commit -m "feat: add Phase 0 database schema and test harness" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pure auth rules and small utilities

**Files:**
- Create: `src/lib/crypto.ts`, `src/lib/safe-next.ts`, `src/lib/avatar.ts`, `src/lib/time.ts`, `src/domain/auth/password-policy.ts`, `src/domain/auth/lockout.ts`
- Test: `tests/lib/utils.test.ts`, `tests/domain/auth-rules.test.ts`

**Interfaces:**
- Produces:
  - `generateToken(bytes?: number): string`, `sha256(value: string): string`
  - `safeNext(next: string | null | undefined, fallback?: string): string`
  - `initials(name: string): string`, `avatarColor(name: string): string`
  - `istHour(d: Date): number`, `greetingFor(d: Date): string`, `longDateIST(d: Date): string`, `timeAgo(d: Date, now: Date): string`, `formatIsoDate(iso: string): string` ("2025-01-01" → "1 January 2025")
  - `MIN_PASSWORD_LENGTH = 10`, `validateNewPassword(password: string, email: string): string | null`
  - `MAX_FAILURES = 5`, `LOCK_WINDOW_MS`, `type Attempt = { success: boolean; at: Date }`, `isLockedOut(attempts: Attempt[], now: Date): boolean`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/utils.test.ts
import { describe, expect, it } from "vitest";
import { generateToken, sha256 } from "@/lib/crypto";
import { safeNext } from "@/lib/safe-next";
import { avatarColor, initials } from "@/lib/avatar";
import { formatIsoDate, greetingFor, longDateIST, timeAgo } from "@/lib/time";

describe("crypto", () => {
  it("generates unique url-safe tokens", () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });
  it("hashes deterministically", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("safeNext", () => {
  it("keeps internal paths", () => {
    expect(safeNext("/settings")).toBe("/settings");
    expect(safeNext("/people/abc?tab=leave")).toBe("/people/abc?tab=leave");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "", null, undefined, "/login", "settings"])(
    "falls back to /home for %s",
    (value) => {
      expect(safeNext(value as string | null | undefined)).toBe("/home");
    },
  );
});

describe("avatar", () => {
  it("builds initials from first and last name", () => {
    expect(initials("Arjun Mehta")).toBe("AM");
    expect(initials("Neha")).toBe("N");
    expect(initials("  ananya   kumari sharma ")).toBe("AS");
    expect(initials("   ")).toBe("?");
  });
  it("picks a stable colour from the palette", () => {
    expect(avatarColor("Arjun Mehta")).toBe(avatarColor("Arjun Mehta"));
    expect(avatarColor("Arjun Mehta")).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("time (IST)", () => {
  it("greets by IST hour", () => {
    expect(greetingFor(new Date("2026-10-28T03:30:00Z"))).toBe("Good morning"); // 09:00 IST
    expect(greetingFor(new Date("2026-10-28T08:00:00Z"))).toBe("Good afternoon"); // 13:30 IST
    expect(greetingFor(new Date("2026-10-28T12:30:00Z"))).toBe("Good evening"); // 18:00 IST
  });
  it("formats the long date", () => {
    expect(longDateIST(new Date("2026-10-28T03:30:00Z"))).toBe("Wednesday 28 October");
  });
  it("describes relative time", () => {
    const now = new Date("2026-10-28T10:00:00Z");
    expect(timeAgo(new Date("2026-10-28T09:59:30Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-10-28T09:48:00Z"), now)).toBe("12 min ago");
    expect(timeAgo(new Date("2026-10-28T07:00:00Z"), now)).toBe("3 h ago");
    expect(timeAgo(new Date("2026-10-27T09:00:00Z"), now)).toBe("Yesterday");
    expect(timeAgo(new Date("2026-10-24T10:00:00Z"), now)).toBe("4 days ago");
    expect(timeAgo(new Date("2026-10-01T10:00:00Z"), now)).toBe("1 Oct");
  });
  it("formats calendar dates without timezone drift", () => {
    expect(formatIsoDate("2025-01-01")).toBe("1 January 2025");
    expect(formatIsoDate("2026-12-31")).toBe("31 December 2026");
  });
});
```

```ts
// tests/domain/auth-rules.test.ts
import { describe, expect, it } from "vitest";
import { validateNewPassword } from "@/domain/auth/password-policy";
import { isLockedOut, LOCK_WINDOW_MS, type Attempt } from "@/domain/auth/lockout";

describe("validateNewPassword", () => {
  it("accepts a reasonable password", () => {
    expect(validateNewPassword("Password@123", "arjun@lnwebworks.test")).toBeNull();
  });
  it("rejects short passwords", () => {
    expect(validateNewPassword("short", "a@b.test")).toBe("Use at least 10 characters.");
  });
  it("rejects the email as password, ignoring case", () => {
    expect(validateNewPassword("Arjun@LNWebworks.test", "arjun@lnwebworks.test")).toBe("Your password can't be your email address.");
  });
  it("rejects absurdly long passwords", () => {
    expect(validateNewPassword("x".repeat(201), "a@b.test")).toBe("That password is too long.");
  });
});

describe("isLockedOut", () => {
  const now = new Date("2026-10-28T10:00:00Z");
  const ago = (ms: number): Date => new Date(now.getTime() - ms);
  const fail = (ms: number): Attempt => ({ success: false, at: ago(ms) });

  it("is not locked with fewer than five consecutive failures", () => {
    expect(isLockedOut([fail(1000), fail(2000), fail(3000), fail(4000)], now)).toBe(false);
  });
  it("locks after five consecutive failures", () => {
    expect(isLockedOut([fail(1000), fail(2000), fail(3000), fail(4000), fail(5000)], now)).toBe(true);
  });
  it("a success resets the count", () => {
    const attempts = [fail(1000), fail(2000), { success: true, at: ago(3000) }, fail(4000), fail(5000), fail(6000)];
    expect(isLockedOut(attempts, now)).toBe(false);
  });
  it("unlocks 15 minutes after the last failure", () => {
    const old = [1, 2, 3, 4, 5].map((i) => fail(LOCK_WINDOW_MS + i * 1000));
    expect(isLockedOut(old, now)).toBe(false);
  });
  it("does not depend on input order", () => {
    expect(isLockedOut([fail(5000), fail(1000), fail(3000), fail(2000), fail(4000)], now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/utils.test.ts tests/domain/auth-rules.test.ts`
Expected: FAIL — "Failed to resolve import "@/lib/crypto"" (and the others).

- [ ] **Step 3: Implement the utilities**

```ts
// src/lib/crypto.ts
import { createHash, randomBytes } from "node:crypto";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
```

```ts
// src/lib/safe-next.ts
/** Only same-site absolute paths are allowed as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return fallback;
  return next;
}
```

```ts
// src/lib/avatar.ts
const PALETTE = ["#1E4D3A", "#D9603F", "#4A6FA5", "#8A6FB0", "#B7841B", "#2F7F7A"] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
```

```ts
// src/lib/time.ts
const IST = "Asia/Kolkata";

export function istHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: IST }).format(d));
}

export function greetingFor(d: Date): string {
  const h = istHour(d);
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function longDateIST(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: IST }).format(d);
}

export function timeAgo(d: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: IST }).format(d);
}

/** Formats a stored YYYY-MM-DD calendar date. Uses UTC on both sides so the day never shifts. */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
```

```ts
// src/domain/auth/password-policy.ts
export const MIN_PASSWORD_LENGTH = 10;

export function validateNewPassword(password: string, email: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) return "Your password can't be your email address.";
  return null;
}
```

```ts
// src/domain/auth/lockout.ts
export const MAX_FAILURES = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

export type Attempt = { success: boolean; at: Date };

/**
 * Locked when the most recent attempts contain at least MAX_FAILURES failures with no success in between,
 * and the latest of them happened less than LOCK_WINDOW_MS ago.
 */
export function isLockedOut(attempts: Attempt[], now: Date): boolean {
  const sorted = [...attempts].sort((a, b) => b.at.getTime() - a.at.getTime());
  let failures = 0;
  for (const attempt of sorted) {
    if (attempt.success) break;
    failures += 1;
  }
  if (failures < MAX_FAILURES) return false;
  return now.getTime() - sorted[0].at.getTime() < LOCK_WINDOW_MS;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/utils.test.ts tests/domain/auth-rules.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib src/domain tests
git commit -m "feat: add auth rules and shared utilities" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Password hashing, current-user loading and sessions

**Files:**
- Create: `src/domain/auth/types.ts`, `src/server/auth/password.ts`, `src/server/auth/users.ts`, `src/server/auth/sessions.ts`
- Test: `tests/server/sessions.test.ts`

**Interfaces:**
- Consumes: `db`, `generateToken`, `sha256`.
- Produces:
  - `type CurrentUser = { userId; employeeId; email; fullName; isHR; isPayroll; isAdmin; isManager }`
  - `hashPassword(password: string): Promise<string>`, `verifyPassword(hash: string, password: string): Promise<boolean>`
  - `loadCurrentUser(userId: string): Promise<CurrentUser | null>` (null when missing or `EXITED`)
  - `SESSION_TTL_MS`, `createSession(userId, now?): Promise<{ token: string; expiresAt: Date }>`, `validateSessionToken(token, now?): Promise<ValidSession | null>`, `revokeSession(token): Promise<void>`, `revokeAllSessions(userId): Promise<void>`; `type ValidSession = { sessionId: string; expiresAt: Date; user: CurrentUser }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/sessions.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { loadCurrentUser } from "@/server/auth/users";
import { createSession, revokeAllSessions, revokeSession, SESSION_TTL_MS, validateSessionToken } from "@/server/auth/sessions";
import { makeEmployee, resetDb } from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;

describe("passwords", () => {
  it("hashes with argon2id and verifies", async () => {
    const h = await hashPassword("Password@123");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "Password@123")).toBe(true);
    expect(await verifyPassword(h, "wrong")).toBe(false);
  });
  it("returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", "x")).toBe(false);
  });
});

describe("loadCurrentUser", () => {
  beforeEach(resetDb);

  it("derives isManager from active direct reports", async () => {
    const boss = await makeEmployee({ name: "Ananya Sharma", isHR: true });
    await makeEmployee({ managerId: boss.employee.id, status: "EXITED" });
    expect((await loadCurrentUser(boss.user.id))?.isManager).toBe(false);
    await makeEmployee({ managerId: boss.employee.id });
    const user = await loadCurrentUser(boss.user.id);
    expect(user).toMatchObject({ fullName: "Ananya Sharma", isHR: true, isAdmin: false, isManager: true });
  });

  it("returns null for exited employees", async () => {
    const { user } = await makeEmployee({ status: "EXITED" });
    expect(await loadCurrentUser(user.id)).toBeNull();
  });
});

describe("sessions", () => {
  beforeEach(resetDb);
  const now = new Date("2026-10-28T10:00:00Z");

  it("creates a session that validates to the user, storing only a hash", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    const { token, expiresAt } = await createSession(user.id, now);
    expect(expiresAt.getTime()).toBe(now.getTime() + SESSION_TTL_MS);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
    const valid = await validateSessionToken(token, now);
    expect(valid?.user.fullName).toBe("Arjun Mehta");
  });

  it("rejects unknown tokens", async () => {
    expect(await validateSessionToken("nope", now)).toBeNull();
  });

  it("rejects and deletes expired sessions", async () => {
    const { user } = await makeEmployee();
    const { token } = await createSession(user.id, now);
    const later = new Date(now.getTime() + SESSION_TTL_MS + 1);
    expect(await validateSessionToken(token, later)).toBeNull();
    expect(await db.session.count()).toBe(0);
  });

  it("slides the expiry when less than 15 days remain", async () => {
    const { user } = await makeEmployee();
    const { token } = await createSession(user.id, now);
    const day20 = new Date(now.getTime() + 20 * DAY);
    const valid = await validateSessionToken(token, day20);
    expect(valid?.expiresAt.getTime()).toBe(day20.getTime() + SESSION_TTL_MS);
    const day10 = new Date(now.getTime() + 10 * DAY);
    const notRenewed = await validateSessionToken(token, day10);
    expect(notRenewed?.expiresAt.getTime()).toBe(day20.getTime() + SESSION_TTL_MS);
  });

  it("stops working as soon as the employee exits", async () => {
    const { user, employee } = await makeEmployee();
    const { token } = await createSession(user.id, now);
    await db.employee.update({ where: { id: employee.id }, data: { status: "EXITED" } });
    expect(await validateSessionToken(token, now)).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("revokes one session or all of a user's sessions", async () => {
    const { user } = await makeEmployee();
    const a = await createSession(user.id, now);
    const b = await createSession(user.id, now);
    await revokeSession(a.token);
    expect(await validateSessionToken(a.token, now)).toBeNull();
    expect(await validateSessionToken(b.token, now)).not.toBeNull();
    await revokeAllSessions(user.id);
    expect(await validateSessionToken(b.token, now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/sessions.test.ts`
Expected: FAIL — cannot resolve `@/server/auth/password`.

- [ ] **Step 3: Implement**

```ts
// src/domain/auth/types.ts
export type CurrentUser = {
  userId: string;
  employeeId: string;
  email: string;
  fullName: string;
  isHR: boolean;
  isPayroll: boolean;
  isAdmin: boolean;
  isManager: boolean;
};
```

```ts
// src/server/auth/password.ts
import "server-only";
import { hash, verify } from "@node-rs/argon2";

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
```

```ts
// src/server/auth/users.ts
import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/domain/auth/types";

export async function loadCurrentUser(userId: string): Promise<CurrentUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      employee: { include: { _count: { select: { reports: { where: { status: { not: "EXITED" } } } } } } },
    },
  });
  if (!user || user.employee.status === "EXITED") return null;
  return {
    userId: user.id,
    employeeId: user.employeeId,
    email: user.email,
    fullName: user.employee.fullName,
    isHR: user.isHR,
    isPayroll: user.isPayroll,
    isAdmin: user.isAdmin,
    isManager: user.employee._count.reports > 0,
  };
}
```

```ts
// src/server/auth/sessions.ts
import "server-only";
import { db } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";
import type { CurrentUser } from "@/domain/auth/types";
import { loadCurrentUser } from "./users";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

export type ValidSession = { sessionId: string; expiresAt: Date; user: CurrentUser };

export async function createSession(userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(token: string, now = new Date()): Promise<ValidSession | null> {
  const id = sha256(token);
  const session = await db.session.findUnique({ where: { id } });
  if (!session) return null;
  if (session.expiresAt.getTime() <= now.getTime()) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  const user = await loadCurrentUser(session.userId);
  if (!user) {
    await db.session.deleteMany({ where: { userId: session.userId } });
    return null;
  }
  let expiresAt = session.expiresAt;
  if (expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD_MS) {
    expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await db.session.update({ where: { id }, data: { expiresAt } });
  }
  return { sessionId: id, expiresAt, user };
}

export async function revokeSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sha256(token) } });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/sessions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/auth/types.ts src/server/auth tests/server/sessions.test.ts
git commit -m "feat: add password hashing and database sessions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Login authentication with lockout

**Files:**
- Create: `src/server/auth/login.ts`
- Test: `tests/server/login.test.ts`

**Interfaces:**
- Consumes: `isLockedOut`, `hashPassword`, `verifyPassword`, `db`.
- Produces: `type AuthResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" }`; `authenticate(email: string, password: string, now?: Date): Promise<AuthResult>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/login.test.ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/server/auth/login";
import { hashPassword } from "@/server/auth/password";
import { makeEmployee, resetDb } from "../helpers/db";

const PASSWORD = "Password@123";

describe("authenticate", () => {
  let passwordHash = "";
  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });
  beforeEach(resetDb);
  const now = new Date("2026-10-28T10:00:00Z");
  const minutes = (m: number) => new Date(now.getTime() + m * 60_000);

  it("accepts the right password, ignoring email case and spaces", async () => {
    const { user } = await makeEmployee({ passwordHash });
    const result = await authenticate(`  ${user.email.toUpperCase()} `, PASSWORD, now);
    expect(result).toEqual({ ok: true, userId: user.id });
  });

  it("rejects a wrong password", async () => {
    const { user } = await makeEmployee({ passwordHash });
    expect(await authenticate(user.email, "wrong-password", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects unknown emails and users without a password the same way", async () => {
    const { user } = await makeEmployee({ passwordHash: null });
    expect(await authenticate("nobody@lnwebworks.test", PASSWORD, now)).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate(user.email, PASSWORD, now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects exited employees", async () => {
    const { user } = await makeEmployee({ passwordHash, status: "EXITED" });
    expect(await authenticate(user.email, PASSWORD, now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks after five failures, even for the right password, and records every attempt", async () => {
    const { user } = await makeEmployee({ passwordHash });
    for (let i = 0; i < 5; i++) await authenticate(user.email, "wrong-password", minutes(i));
    expect(await authenticate(user.email, PASSWORD, minutes(5))).toEqual({ ok: false, reason: "locked" });
    expect(await db.loginAttempt.count({ where: { email: user.email } })).toBe(5);
  });

  it("unlocks 15 minutes after the last failure", async () => {
    const { user } = await makeEmployee({ passwordHash });
    for (let i = 0; i < 5; i++) await authenticate(user.email, "wrong-password", minutes(i));
    expect(await authenticate(user.email, PASSWORD, minutes(4 + 15))).toEqual({ ok: true, userId: user.id });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/login.test.ts`
Expected: FAIL — cannot resolve `@/server/auth/login`.

- [ ] **Step 3: Implement**

```ts
// src/server/auth/login.ts
import "server-only";
import { db } from "@/lib/db";
import { isLockedOut } from "@/domain/auth/lockout";
import { hashPassword, verifyPassword } from "./password";

export type AuthResult = { ok: true; userId: string } | { ok: false; reason: "invalid" | "locked" };

let dummyHash: Promise<string> | null = null;
/** Verifying against a dummy hash keeps response time similar whether or not the email exists. */
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("dummy-password-for-timing-only");
  return dummyHash;
}

export async function authenticate(emailInput: string, password: string, now = new Date()): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase();
  const attempts = await db.loginAttempt.findMany({ where: { email }, orderBy: { at: "desc" }, take: 20 });
  if (isLockedOut(attempts, now)) return { ok: false, reason: "locked" };

  const user = await db.user.findUnique({ where: { email }, include: { employee: true } });
  let passwordOk = false;
  if (user?.passwordHash) passwordOk = await verifyPassword(user.passwordHash, password);
  else await verifyPassword(await getDummyHash(), password);

  const ok = !!user && passwordOk && user.employee.status !== "EXITED";
  await db.loginAttempt.create({ data: { email, success: ok, at: now } });
  return ok && user ? { ok: true, userId: user.id } : { ok: false, reason: "invalid" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/login.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/login.ts tests/server/login.test.ts
git commit -m "feat: add login authentication with lockout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mail and password set/reset tokens

**Files:**
- Create: `src/lib/env.ts`, `src/server/mail/mailer.ts`, `src/server/auth/password-tokens.ts`
- Test: `tests/server/password-tokens.test.ts`

**Interfaces:**
- Consumes: `generateToken`, `sha256`, `hashPassword`, `validateNewPassword`, `db`.
- Produces:
  - `APP_URL: string`
  - `type MailMessage = { to: string; subject: string; text: string }`, `outbox: MailMessage[]` (filled only when `NODE_ENV === "test"`), `sendMail(msg): Promise<void>`
  - `type TokenPurpose = "SET" | "RESET"`, `issuePasswordToken(userId, purpose, now?): Promise<string>`, `sendSetPasswordEmail(userId, now?): Promise<void>`, `requestPasswordReset(email, now?): Promise<void>`, `peekPasswordToken(token, now?): Promise<{ purpose: TokenPurpose; email: string } | null>`, `consumePasswordToken(token, newPassword, now?): Promise<{ ok: true; userId: string } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/password-tokens.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { outbox } from "@/server/mail/mailer";
import { createSession } from "@/server/auth/sessions";
import { verifyPassword } from "@/server/auth/password";
import {
  consumePasswordToken,
  issuePasswordToken,
  peekPasswordToken,
  requestPasswordReset,
  sendSetPasswordEmail,
} from "@/server/auth/password-tokens";
import { makeEmployee, resetDb } from "../helpers/db";

const tokenFrom = (text: string): string => /token=([A-Za-z0-9_-]+)/.exec(text)![1];
const now = new Date("2026-10-28T10:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("password tokens", () => {
  beforeEach(async () => {
    await resetDb();
    outbox.length = 0;
  });

  it("emails a set-password link that sets the password and revokes old sessions", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    await createSession(user.id, now);
    await sendSetPasswordEmail(user.id, now);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(user.email);
    expect(outbox[0].text).toContain("Hi Arjun");
    const token = tokenFrom(outbox[0].text);

    expect(await peekPasswordToken(token, now)).toEqual({ purpose: "SET", email: user.email });
    const result = await consumePasswordToken(token, "Brand-new-pass1", hours(1));
    expect(result).toEqual({ ok: true, userId: user.id });

    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(stored.passwordHash!, "Brand-new-pass1")).toBe(true);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("refuses a token twice", async () => {
    const { user } = await makeEmployee();
    const token = await issuePasswordToken(user.id, "SET", now);
    expect((await consumePasswordToken(token, "Brand-new-pass1", now)).ok).toBe(true);
    expect(await consumePasswordToken(token, "Another-pass-22", now)).toEqual({
      ok: false,
      error: "This link has expired or was already used. Ask for a new one.",
    });
  });

  it("expires reset links after one hour and set links after 72 hours", async () => {
    const { user } = await makeEmployee();
    const reset = await issuePasswordToken(user.id, "RESET", now);
    expect(await peekPasswordToken(reset, hours(1.01))).toBeNull();
    const set = await issuePasswordToken(user.id, "SET", now);
    expect(await peekPasswordToken(set, hours(71))).not.toBeNull();
    expect((await consumePasswordToken(set, "Brand-new-pass1", hours(73))).ok).toBe(false);
  });

  it("issuing a new token invalidates the previous one of the same purpose", async () => {
    const { user } = await makeEmployee();
    const first = await issuePasswordToken(user.id, "RESET", now);
    const second = await issuePasswordToken(user.id, "RESET", now);
    expect(await peekPasswordToken(first, now)).toBeNull();
    expect(await peekPasswordToken(second, now)).not.toBeNull();
  });

  it("keeps the token usable when the new password breaks the policy", async () => {
    const { user } = await makeEmployee();
    const token = await issuePasswordToken(user.id, "SET", now);
    expect(await consumePasswordToken(token, "short", now)).toEqual({ ok: false, error: "Use at least 10 characters." });
    expect((await consumePasswordToken(token, "Long-enough-pass", now)).ok).toBe(true);
  });

  it("sends reset mail only to active known accounts", async () => {
    await requestPasswordReset("nobody@lnwebworks.test", now);
    const exited = await makeEmployee({ status: "EXITED" });
    await requestPasswordReset(exited.user.email, now);
    expect(outbox).toHaveLength(0);

    const { user } = await makeEmployee();
    await requestPasswordReset(user.email.toUpperCase(), now);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toBe("Reset your LN People password");
    expect(await peekPasswordToken(tokenFrom(outbox[0].text), now)).toEqual({ purpose: "RESET", email: user.email });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/password-tokens.test.ts`
Expected: FAIL — cannot resolve `@/server/mail/mailer`.

- [ ] **Step 3: Implement**

```ts
// src/lib/env.ts
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
```

```ts
// src/server/mail/mailer.ts
import "server-only";

export type MailMessage = { to: string; subject: string; text: string };

/** In tests, sent mail is collected here instead of being delivered. */
export const outbox: MailMessage[] = [];

export async function sendMail(msg: MailMessage): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    outbox.push(msg);
    return;
  }
  // Console transport for local development. An SMTP transport replaces this before go-live.
  console.info(`\n[mail] to: ${msg.to}\n[mail] subject: ${msg.subject}\n${msg.text}\n`);
}
```

```ts
// src/server/auth/password-tokens.ts
import "server-only";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { generateToken, sha256 } from "@/lib/crypto";
import { validateNewPassword } from "@/domain/auth/password-policy";
import { sendMail } from "@/server/mail/mailer";
import { hashPassword } from "./password";

const TTL_MS = { SET: 72 * 3_600_000, RESET: 3_600_000 } as const;
export type TokenPurpose = keyof typeof TTL_MS;

const EXPIRED = "This link has expired or was already used. Ask for a new one.";

export async function issuePasswordToken(userId: string, purpose: TokenPurpose, now = new Date()): Promise<string> {
  const token = generateToken();
  await db.$transaction([
    db.passwordToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
    db.passwordToken.create({
      data: { id: sha256(token), userId, purpose, expiresAt: new Date(now.getTime() + TTL_MS[purpose]) },
    }),
  ]);
  return token;
}

export async function sendSetPasswordEmail(userId: string, now = new Date()): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { employee: true } });
  const token = await issuePasswordToken(userId, "SET", now);
  const firstName = user.employee.fullName.split(" ")[0];
  await sendMail({
    to: user.email,
    subject: "Welcome to LN People — set your password",
    text: `Hi ${firstName},\n\nYour LN People account is ready. Set your password here (the link works for 72 hours):\n${APP_URL}/set-password?token=${token}\n`,
  });
}

export async function requestPasswordReset(emailInput: string, now = new Date()): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email }, include: { employee: true } });
  if (!user || user.employee.status === "EXITED") return;
  const token = await issuePasswordToken(user.id, "RESET", now);
  await sendMail({
    to: user.email,
    subject: "Reset your LN People password",
    text: `Someone asked to reset your LN People password. If it was you, use this link within 1 hour:\n${APP_URL}/set-password?token=${token}\n\nIf it wasn't you, you can ignore this email.`,
  });
}

export async function peekPasswordToken(token: string, now = new Date()): Promise<{ purpose: TokenPurpose; email: string } | null> {
  const row = await db.passwordToken.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) return null;
  return { purpose: row.purpose as TokenPurpose, email: row.user.email };
}

export async function consumePasswordToken(
  token: string,
  newPassword: string,
  now = new Date(),
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const row = await db.passwordToken.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) return { ok: false, error: EXPIRED };
  const policyError = validateNewPassword(newPassword, row.user.email);
  if (policyError) return { ok: false, error: policyError };

  const passwordHash = await hashPassword(newPassword);
  const used = await db.$transaction(async (tx) => {
    const claim = await tx.passwordToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claim.count !== 1) return false;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return true;
  });
  return used ? { ok: true, userId: row.userId } : { ok: false, error: EXPIRED };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/password-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/server/mail src/server/auth/password-tokens.ts tests/server/password-tokens.test.ts
git commit -m "feat: add password set and reset tokens with console mailer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Permissions and navigation model

**Files:**
- Create: `src/domain/auth/permissions.ts`, `src/components/ui/icon-names.ts`, `src/components/shell/nav.ts`
- Test: `tests/domain/permissions.test.ts`

**Interfaces:**
- Consumes: `CurrentUser`.
- Produces:
  - `type Action = "settings.manage" | "audit.view" | "employees.manage" | "payroll.manage" | "approvals.hr"`; `can(user: RoleFlags, action: Action): boolean`; `primaryRoleLabel(user): "Admin" | "HR" | "Payroll" | "Manager" | "Employee"`
  - `ICON_NAMES` (readonly tuple), `type IconName`
  - `type NavLink = { href: string; label: string; icon: IconName }`; `navFor(user): NavLink[]`; `isActivePath(pathname: string, href: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/permissions.test.ts
import { describe, expect, it } from "vitest";
import { can, primaryRoleLabel } from "@/domain/auth/permissions";
import { isActivePath, navFor } from "@/components/shell/nav";
import type { CurrentUser } from "@/domain/auth/types";

const base: CurrentUser = {
  userId: "u",
  employeeId: "e",
  email: "a@lnwebworks.test",
  fullName: "A B",
  isHR: false,
  isPayroll: false,
  isAdmin: false,
  isManager: false,
};

describe("can", () => {
  it("gives employees no admin capabilities", () => {
    for (const action of ["settings.manage", "audit.view", "employees.manage", "payroll.manage", "approvals.hr"] as const) {
      expect(can(base, action)).toBe(false);
    }
  });
  it("lets HR manage people and act on HR approvals but not settings or payroll", () => {
    const hr = { ...base, isHR: true };
    expect(can(hr, "employees.manage")).toBe(true);
    expect(can(hr, "approvals.hr")).toBe(true);
    expect(can(hr, "audit.view")).toBe(true);
    expect(can(hr, "settings.manage")).toBe(false);
    expect(can(hr, "payroll.manage")).toBe(false);
  });
  it("lets payroll manage payroll only", () => {
    const p = { ...base, isPayroll: true };
    expect(can(p, "payroll.manage")).toBe(true);
    expect(can(p, "employees.manage")).toBe(false);
  });
  it("lets admins do everything", () => {
    const a = { ...base, isAdmin: true };
    for (const action of ["settings.manage", "audit.view", "employees.manage", "payroll.manage", "approvals.hr"] as const) {
      expect(can(a, action)).toBe(true);
    }
  });
});

describe("primaryRoleLabel", () => {
  it("picks the most senior role", () => {
    expect(primaryRoleLabel(base)).toBe("Employee");
    expect(primaryRoleLabel({ ...base, isManager: true })).toBe("Manager");
    expect(primaryRoleLabel({ ...base, isManager: true, isPayroll: true })).toBe("Payroll");
    expect(primaryRoleLabel({ ...base, isHR: true, isPayroll: true })).toBe("HR");
    expect(primaryRoleLabel({ ...base, isHR: true, isAdmin: true })).toBe("Admin");
  });
});

describe("navigation", () => {
  it("shows Settings to admins only", () => {
    expect(navFor(base).map((l) => l.href)).toEqual(["/home", "/profile"]);
    expect(navFor({ ...base, isAdmin: true }).map((l) => l.href)).toEqual(["/home", "/profile", "/settings"]);
  });
  it("matches nested paths but not prefixes of other words", () => {
    expect(isActivePath("/settings", "/settings")).toBe(true);
    expect(isActivePath("/settings/roles", "/settings")).toBe(true);
    expect(isActivePath("/settingsx", "/settings")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/permissions.test.ts`
Expected: FAIL — cannot resolve `@/domain/auth/permissions`.

- [ ] **Step 3: Implement**

```ts
// src/domain/auth/permissions.ts
import type { CurrentUser } from "./types";

export type Action = "settings.manage" | "audit.view" | "employees.manage" | "payroll.manage" | "approvals.hr";
type RoleFlags = Pick<CurrentUser, "isHR" | "isPayroll" | "isAdmin">;

const RULES: Record<Action, (u: RoleFlags) => boolean> = {
  "settings.manage": (u) => u.isAdmin,
  "audit.view": (u) => u.isHR || u.isAdmin,
  "employees.manage": (u) => u.isHR || u.isAdmin,
  "payroll.manage": (u) => u.isPayroll || u.isAdmin,
  "approvals.hr": (u) => u.isHR || u.isAdmin,
};

export function can(user: RoleFlags, action: Action): boolean {
  return RULES[action](user);
}

export function primaryRoleLabel(
  user: Pick<CurrentUser, "isHR" | "isPayroll" | "isAdmin" | "isManager">,
): "Admin" | "HR" | "Payroll" | "Manager" | "Employee" {
  if (user.isAdmin) return "Admin";
  if (user.isHR) return "HR";
  if (user.isPayroll) return "Payroll";
  if (user.isManager) return "Manager";
  return "Employee";
}
```

```ts
// src/components/ui/icon-names.ts
export const ICON_NAMES = [
  "home", "clock", "plane", "users", "wallet", "heart", "search", "bell", "moon", "sun",
  "check", "x", "arrow", "settings", "user", "logout", "inbox", "sparkle", "calendar",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
```

```ts
// src/components/shell/nav.ts
import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import type { IconName } from "@/components/ui/icon-names";

export type NavLink = { href: string; label: string; icon: IconName };

export function navFor(user: CurrentUser): NavLink[] {
  const links: NavLink[] = [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/profile", label: "My profile", icon: "user" },
  ];
  if (can(user, "settings.manage")) links.push({ href: "/settings", label: "Settings", icon: "settings" });
  return links;
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/auth/permissions.ts src/components tests/domain/permissions.test.ts
git commit -m "feat: add role permissions and navigation model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Audit log and notifications

**Files:**
- Create: `src/server/audit.ts`, `src/server/notifications.ts`
- Test: `tests/server/audit-notifications.test.ts`

**Interfaces:**
- Consumes: `Db`, `db`.
- Produces:
  - `type AuditEntry = { actorId: string | null; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown }`; `writeAudit(tx: Db, entry: AuditEntry): Promise<void>`; `listAudit(filter: { entityType?: string; entityId?: string; take?: number }): Promise<AuditLog[]>`
  - `type NewNotification = { kind: string; title: string; link?: string }`; `notifyEmployees(tx: Db, employeeIds: string[], n: NewNotification): Promise<void>`; `listNotifications(userId, take?)`; `unreadCount(userId): Promise<number>`; `markAllRead(userId, now?): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/audit-notifications.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/audit-notifications.test.ts`
Expected: FAIL — cannot resolve `@/server/audit`.

- [ ] **Step 3: Implement**

```ts
// src/server/audit.ts
import "server-only";
import { db } from "@/lib/db";
import type { Db } from "./db-types";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

const toJson = (v: unknown): string | null => (v === undefined ? null : JSON.stringify(v));

export async function writeAudit(tx: Db, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
    },
  });
}

export function listAudit(filter: { entityType?: string; entityId?: string; take?: number }) {
  return db.auditLog.findMany({
    where: { entityType: filter.entityType, entityId: filter.entityId },
    orderBy: { at: "desc" },
    take: filter.take ?? 100,
  });
}
```

```ts
// src/server/notifications.ts
import "server-only";
import { db } from "@/lib/db";
import type { Db } from "./db-types";

export type NewNotification = { kind: string; title: string; link?: string };

export async function notifyEmployees(tx: Db, employeeIds: string[], n: NewNotification): Promise<void> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return;
  const users = await tx.user.findMany({ where: { employeeId: { in: ids } }, select: { id: true } });
  if (users.length === 0) return;
  await tx.notification.createMany({
    data: users.map((u) => ({ userId: u.id, kind: n.kind, title: n.title, link: n.link ?? null })),
  });
}

export function listNotifications(userId: string, take = 20) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string, now = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/audit-notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/audit.ts src/server/notifications.ts tests/server/audit-notifications.test.ts
git commit -m "feat: add audit log and in-app notifications" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Settings

**Files:**
- Create: `src/domain/settings/settings.ts`, `src/server/settings.ts`
- Test: `tests/domain/settings.test.ts`, `tests/server/settings.test.ts`

**Interfaces:**
- Consumes: `can`, `writeAudit`, `db`, `CurrentUser`.
- Produces:
  - `SETTINGS_SCHEMA`, `type SettingKey`, `type Settings`, `SETTING_KEYS`, `SETTINGS_DEFAULTS`, `isSettingKey(k): k is SettingKey`, `type SettingInputKind`, `SETTING_META: Record<SettingKey, { label; help; kind }>`, `parseSettingInput(key, values: string[]): unknown`, `validateSettingChange(current, key, raw): { ok: true; value } | { ok: false; error }`
  - `getSettings(): Promise<Settings>`, `getSetting(key)`, `updateSetting(actor, key, raw): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/domain/settings.test.ts
import { describe, expect, it } from "vitest";
import { isSettingKey, parseSettingInput, SETTINGS_DEFAULTS, validateSettingChange } from "@/domain/settings/settings";

describe("settings rules", () => {
  it("knows its keys", () => {
    expect(isSettingKey("company.name")).toBe(true);
    expect(isSettingKey("toString")).toBe(false);
    expect(isSettingKey("nope")).toBe(false);
  });

  it("parses form input by kind", () => {
    expect(parseSettingInput("company.name", ["LN Webworks"])).toBe("LN Webworks");
    expect(parseSettingInput("attendance.requiredDailyMinutes", ["480"])).toBe(480);
    expect(Number.isNaN(parseSettingInput("attendance.requiredDailyMinutes", [""]))).toBe(true);
    expect(parseSettingInput("wfh.monthlyLimit", [""])).toBeNull();
    expect(parseSettingInput("wfh.monthlyLimit", ["4"])).toBe(4);
    expect(parseSettingInput("work.weekendDays", ["6", "0", "6"])).toEqual([0, 6]);
  });

  it("accepts valid changes", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", 480)).toEqual({ ok: true, value: 480 });
    expect(validateSettingChange(SETTINGS_DEFAULTS, "company.name", "  LN Webworks Pvt Ltd ")).toEqual({ ok: true, value: "LN Webworks Pvt Ltd" });
  });

  it("rejects out-of-range or wrong-type values", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", 5000).ok).toBe(false);
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", Number.NaN).ok).toBe(false);
    expect(validateSettingChange(SETTINGS_DEFAULTS, "company.name", "   ").ok).toBe(false);
  });

  it("refuses read-only settings", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "company.timezone", "Asia/Kolkata")).toEqual({ ok: false, error: "This setting can't be changed." });
  });

  it("keeps the half-day threshold below the full day", () => {
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.halfDayMinutes", 540)).toEqual({
      ok: false,
      error: "The half-day threshold must be shorter than the full day.",
    });
    expect(validateSettingChange(SETTINGS_DEFAULTS, "attendance.requiredDailyMinutes", 270).ok).toBe(false);
  });
});
```

```ts
// tests/server/settings.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getSetting, getSettings, updateSetting } from "@/server/settings";
import { loadCurrentUser } from "@/server/auth/users";
import { SETTINGS_DEFAULTS } from "@/domain/settings/settings";
import { makeEmployee, resetDb } from "../helpers/db";

describe("settings service", () => {
  beforeEach(resetDb);

  it("returns defaults when nothing is stored", async () => {
    expect(await getSettings()).toEqual(SETTINGS_DEFAULTS);
  });

  it("lets admins update a setting and audits it", async () => {
    const { user } = await makeEmployee({ isAdmin: true });
    const admin = (await loadCurrentUser(user.id))!;
    expect(await updateSetting(admin, "attendance.requiredDailyMinutes", 480)).toEqual({ ok: true });
    expect(await getSetting("attendance.requiredDailyMinutes")).toBe(480);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: "attendance.requiredDailyMinutes" } });
    expect(audit).toMatchObject({ actorId: user.id, action: "settings.update", before: "540", after: "480" });
  });

  it("refuses non-admins", async () => {
    const { user } = await makeEmployee({ isHR: true });
    const hr = (await loadCurrentUser(user.id))!;
    expect(await updateSetting(hr, "company.name", "X Corp")).toEqual({ ok: false, error: "Only admins can change settings." });
    expect(await getSetting("company.name")).toBe("LN Webworks");
  });

  it("falls back to the default when a stored value is corrupt or invalid", async () => {
    await db.setting.create({ data: { key: "attendance.requiredDailyMinutes", value: "{not json" } });
    await db.setting.create({ data: { key: "attendance.halfDayMinutes", value: JSON.stringify("ten") } });
    await db.setting.create({ data: { key: "retired.key", value: "1" } });
    const s = await getSettings();
    expect(s["attendance.requiredDailyMinutes"]).toBe(540);
    expect(s["attendance.halfDayMinutes"]).toBe(270);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/settings.test.ts tests/server/settings.test.ts`
Expected: FAIL — cannot resolve `@/domain/settings/settings`.

- [ ] **Step 3: Implement the domain rules**

```ts
// src/domain/settings/settings.ts
import { z } from "zod";

export const SETTINGS_SCHEMA = {
  "company.name": z.string().trim().min(1, "Enter a company name.").max(80),
  "company.timezone": z.literal("Asia/Kolkata"),
  "work.weekendDays": z.array(z.number().int().min(0).max(6)).max(6, "At least one day must be a working day."),
  "attendance.requiredDailyMinutes": z.number().int().min(60).max(960),
  "attendance.halfDayMinutes": z.number().int().min(30).max(720),
  "attendance.correctionWindowDays": z.number().int().min(1).max(90),
  "leave.backdateWindowDays": z.number().int().min(0).max(90),
  "wfh.monthlyLimit": z.number().int().min(1).max(31).nullable(),
  "offboarding.defaultNoticeDays": z.number().int().min(0).max(180),
};

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };
export const SETTING_KEYS = Object.keys(SETTINGS_SCHEMA) as SettingKey[];

export const SETTINGS_DEFAULTS: Settings = {
  "company.name": "LN Webworks",
  "company.timezone": "Asia/Kolkata",
  "work.weekendDays": [0, 6],
  "attendance.requiredDailyMinutes": 540,
  "attendance.halfDayMinutes": 270,
  "attendance.correctionWindowDays": 30,
  "leave.backdateWindowDays": 30,
  "wfh.monthlyLimit": null,
  "offboarding.defaultNoticeDays": 60,
};

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS_SCHEMA, key);
}

export type SettingInputKind = "text" | "number" | "nullable-number" | "weekdays" | "readonly";

export const SETTING_META: Record<SettingKey, { label: string; help: string; kind: SettingInputKind }> = {
  "company.name": { label: "Company name", help: "Shown in emails and page titles.", kind: "text" },
  "company.timezone": { label: "Timezone", help: "All dates and times use Indian Standard Time.", kind: "readonly" },
  "work.weekendDays": { label: "Weekend days", help: "Days nobody is expected to work.", kind: "weekdays" },
  "attendance.requiredDailyMinutes": { label: "Full day (minutes)", help: "Working time for a full day, breaks excluded. 540 = 9 hours.", kind: "number" },
  "attendance.halfDayMinutes": { label: "Half day below (minutes)", help: "Days shorter than this count as half days.", kind: "number" },
  "attendance.correctionWindowDays": { label: "Correction window (days)", help: "How far back people can ask to fix attendance.", kind: "number" },
  "leave.backdateWindowDays": { label: "Backdated leave window (days)", help: "How far back leave types that allow it can be applied.", kind: "number" },
  "wfh.monthlyLimit": { label: "WFH days per month", help: "Leave empty for no limit.", kind: "nullable-number" },
  "offboarding.defaultNoticeDays": { label: "Notice period (days)", help: "Default notice period after a resignation.", kind: "number" },
};

export function parseSettingInput(key: SettingKey, values: string[]): unknown {
  const first = values[0] ?? "";
  switch (SETTING_META[key].kind) {
    case "text":
      return first;
    case "number":
      return first.trim() === "" ? Number.NaN : Number(first);
    case "nullable-number":
      return first.trim() === "" ? null : Number(first);
    case "weekdays":
      return [...new Set(values.map(Number))].sort((a, b) => a - b);
    case "readonly":
      return undefined;
  }
}

export type ChangeResult<K extends SettingKey> = { ok: true; value: Settings[K] } | { ok: false; error: string };

export function validateSettingChange<K extends SettingKey>(current: Settings, key: K, raw: unknown): ChangeResult<K> {
  if (SETTING_META[key].kind === "readonly") return { ok: false, error: "This setting can't be changed." };
  const parsed = (SETTINGS_SCHEMA[key] as z.ZodType).safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That value isn't valid." };
  const next = { ...current, [key]: parsed.data } as Settings;
  if (next["attendance.halfDayMinutes"] >= next["attendance.requiredDailyMinutes"]) {
    return { ok: false, error: "The half-day threshold must be shorter than the full day." };
  }
  return { ok: true, value: parsed.data as Settings[K] };
}
```

- [ ] **Step 4: Implement the service**

```ts
// src/server/settings.ts
import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/domain/auth/permissions";
import type { CurrentUser } from "@/domain/auth/types";
import {
  isSettingKey,
  SETTINGS_DEFAULTS,
  SETTINGS_SCHEMA,
  validateSettingChange,
  type SettingKey,
  type Settings,
} from "@/domain/settings/settings";
import { writeAudit } from "./audit";

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out: Settings = { ...SETTINGS_DEFAULTS };
  for (const row of rows) {
    if (!isSettingKey(row.key)) continue;
    let value: unknown;
    try {
      value = JSON.parse(row.value);
    } catch {
      continue;
    }
    const parsed = (SETTINGS_SCHEMA[row.key] as z.ZodType).safeParse(value);
    if (parsed.success) (out as Record<string, unknown>)[row.key] = parsed.data;
  }
  return out;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

export async function updateSetting(actor: CurrentUser, key: SettingKey, raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "settings.manage")) return { ok: false, error: "Only admins can change settings." };
  const current = await getSettings();
  const result = validateSettingChange(current, key, raw);
  if (!result.ok) return result;
  const value = JSON.stringify(result.value);
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await writeAudit(tx, { actorId: actor.userId, action: "settings.update", entityType: "Setting", entityId: key, before: current[key], after: result.value });
  });
  return { ok: true };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/domain/settings.test.ts tests/server/settings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/settings src/server/settings.ts tests/domain/settings.test.ts tests/server/settings.test.ts
git commit -m "feat: add typed admin settings with validation and audit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Approval engine — pure rules

**Files:**
- Create: `src/domain/approvals/types.ts`, `src/domain/approvals/routing.ts`, `src/domain/approvals/decide.ts`
- Test: `tests/domain/approvals.test.ts`

**Interfaces:**
- Produces:
  - `STEP_ROLES`, `type StepRole = "MANAGER" | "HR"`, `type RequestStatus`, `type Decision = "APPROVED" | "DECLINED"`, `type PlannedStep = { order; role; approverId: string | null }`, `type StepState = PlannedStep & { decision: Decision | null; decidedById: string | null }`, `type RequestState = { status; currentStep; requesterId; steps: StepState[] }`, `type Actor = { employeeId; isHR; isAdmin }`, `type Outcome = { ok: true; state: RequestState } | { ok: false; error: string }`
  - `parsePolicySteps(json: string): StepRole[]` (throws on invalid), `planSteps(policy, requester: { employeeId; managerId: string | null }): PlannedStep[]`
  - `currentStepOf(state)`, `canAct(state, actor): boolean`, `applyDecision(state, actor, decision, comment?): Outcome`, `applyWithdraw(state, actorEmployeeId): Outcome`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domain/approvals.test.ts
import { describe, expect, it } from "vitest";
import { parsePolicySteps, planSteps } from "@/domain/approvals/routing";
import { applyDecision, applyWithdraw, canAct } from "@/domain/approvals/decide";
import type { Actor, RequestState } from "@/domain/approvals/types";

const requester = { employeeId: "emp", managerId: "mgr" };

describe("parsePolicySteps", () => {
  it("parses a valid policy", () => {
    expect(parsePolicySteps('["MANAGER","HR"]')).toEqual(["MANAGER", "HR"]);
  });
  it.each(["[]", '["CEO"]', '{"a":1}', "nope"])("rejects %s", (json) => {
    expect(() => parsePolicySteps(json)).toThrow();
  });
});

describe("planSteps", () => {
  it("routes to the manager, then HR", () => {
    expect(planSteps(["MANAGER", "HR"], requester)).toEqual([
      { order: 0, role: "MANAGER", approverId: "mgr" },
      { order: 1, role: "HR", approverId: null },
    ]);
  });
  it("skips the manager step when there is no manager", () => {
    expect(planSteps(["MANAGER", "HR"], { employeeId: "emp", managerId: null })).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
  it("never routes a request to the requester", () => {
    expect(planSteps(["MANAGER"], { employeeId: "emp", managerId: "emp" })).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
  it("falls back to HR when a manager-only policy has no manager", () => {
    expect(planSteps(["MANAGER"], { employeeId: "emp", managerId: null })).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
  it("does not duplicate HR steps", () => {
    expect(planSteps(["HR", "HR"], requester)).toEqual([{ order: 0, role: "HR", approverId: null }]);
  });
});

const twoStep = (): RequestState => ({
  status: "PENDING",
  currentStep: 0,
  requesterId: "emp",
  steps: [
    { order: 0, role: "MANAGER", approverId: "mgr", decision: null, decidedById: null },
    { order: 1, role: "HR", approverId: null, decision: null, decidedById: null },
  ],
});
const manager: Actor = { employeeId: "mgr", isHR: false, isAdmin: false };
const hr: Actor = { employeeId: "hr1", isHR: true, isAdmin: false };
const other: Actor = { employeeId: "x", isHR: false, isAdmin: false };

describe("canAct", () => {
  it("lets the named manager act on the manager step", () => {
    expect(canAct(twoStep(), manager)).toBe(true);
    expect(canAct(twoStep(), other)).toBe(false);
  });
  it("lets HR override the manager step", () => {
    expect(canAct(twoStep(), hr)).toBe(true);
  });
  it("never lets requesters act on their own request, even as HR", () => {
    expect(canAct(twoStep(), { employeeId: "emp", isHR: true, isAdmin: true })).toBe(false);
  });
  it("stops someone who decided an earlier step from deciding the next", () => {
    const afterHrOverride = applyDecision(twoStep(), hr, "APPROVED");
    if (!afterHrOverride.ok) throw new Error(afterHrOverride.error);
    expect(canAct(afterHrOverride.state, hr)).toBe(false);
    expect(canAct(afterHrOverride.state, { employeeId: "hr2", isHR: true, isAdmin: false })).toBe(true);
  });
});

describe("applyDecision", () => {
  it("moves through steps and approves after the last one", () => {
    const first = applyDecision(twoStep(), manager, "APPROVED");
    if (!first.ok) throw new Error(first.error);
    expect(first.state).toMatchObject({ status: "PENDING", currentStep: 1 });
    expect(first.state.steps[0]).toMatchObject({ decision: "APPROVED", decidedById: "mgr" });
    expect(canAct(first.state, manager)).toBe(false);

    const second = applyDecision(first.state, hr, "APPROVED");
    if (!second.ok) throw new Error(second.error);
    expect(second.state).toMatchObject({ status: "APPROVED", currentStep: 1 });
  });

  it("requires a reason to decline, then ends the request", () => {
    expect(applyDecision(twoStep(), manager, "DECLINED", "  ")).toEqual({ ok: false, error: "Add a short reason when declining." });
    const declined = applyDecision(twoStep(), manager, "DECLINED", "Release week");
    if (!declined.ok) throw new Error(declined.error);
    expect(declined.state.status).toBe("DECLINED");
  });

  it("rejects people who can't act and requests that are closed", () => {
    expect(applyDecision(twoStep(), other, "APPROVED")).toEqual({ ok: false, error: "You can't act on this request." });
    expect(applyDecision({ ...twoStep(), status: "WITHDRAWN" }, manager, "APPROVED")).toEqual({ ok: false, error: "This request is no longer pending." });
  });
});

describe("applyWithdraw", () => {
  it("lets only the requester withdraw a pending request", () => {
    expect(applyWithdraw(twoStep(), "mgr")).toEqual({ ok: false, error: "Only the person who asked can withdraw this request." });
    const done = applyWithdraw(twoStep(), "emp");
    expect(done.ok && done.state.status).toBe("WITHDRAWN");
    expect(applyWithdraw({ ...twoStep(), status: "APPROVED" }, "emp")).toEqual({ ok: false, error: "Only pending requests can be withdrawn." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/approvals.test.ts`
Expected: FAIL — cannot resolve `@/domain/approvals/routing`.

- [ ] **Step 3: Implement**

```ts
// src/domain/approvals/types.ts
export const STEP_ROLES = ["MANAGER", "HR"] as const;
export type StepRole = (typeof STEP_ROLES)[number];
export type RequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "WITHDRAWN";
export type Decision = "APPROVED" | "DECLINED";

export type PlannedStep = { order: number; role: StepRole; approverId: string | null };
export type StepState = PlannedStep & { decision: Decision | null; decidedById: string | null };
export type RequestState = { status: RequestStatus; currentStep: number; requesterId: string; steps: StepState[] };
export type Actor = { employeeId: string; isHR: boolean; isAdmin: boolean };
export type Outcome = { ok: true; state: RequestState } | { ok: false; error: string };
```

```ts
// src/domain/approvals/routing.ts
import { STEP_ROLES, type PlannedStep, type StepRole } from "./types";

export function parsePolicySteps(json: string): StepRole[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid approval policy steps: ${json}`);
  }
  const valid =
    Array.isArray(parsed) && parsed.length > 0 && parsed.every((s) => (STEP_ROLES as readonly unknown[]).includes(s));
  if (!valid) throw new Error(`Invalid approval policy steps: ${json}`);
  return parsed as StepRole[];
}

/**
 * Turns a policy into concrete steps for one requester. MANAGER steps are skipped when there is no
 * (other) manager; if nothing is left, a single HR step is used so every request has an approver.
 */
export function planSteps(policy: StepRole[], requester: { employeeId: string; managerId: string | null }): PlannedStep[] {
  const steps: { role: StepRole; approverId: string | null }[] = [];
  for (const role of policy) {
    if (role === "MANAGER") {
      if (requester.managerId && requester.managerId !== requester.employeeId) steps.push({ role, approverId: requester.managerId });
    } else if (!steps.some((s) => s.role === "HR")) {
      steps.push({ role, approverId: null });
    }
  }
  if (steps.length === 0) steps.push({ role: "HR", approverId: null });
  return steps.map((s, order) => ({ order, ...s }));
}
```

```ts
// src/domain/approvals/decide.ts
import type { Actor, Decision, Outcome, RequestState, StepState } from "./types";

export function currentStepOf(state: RequestState): StepState | undefined {
  return state.steps.find((s) => s.order === state.currentStep);
}

export function canAct(state: RequestState, actor: Actor): boolean {
  if (state.status !== "PENDING") return false;
  if (actor.employeeId === state.requesterId) return false;
  if (state.steps.some((s) => s.decidedById === actor.employeeId)) return false;
  const step = currentStepOf(state);
  if (!step) return false;
  const hrLike = actor.isHR || actor.isAdmin;
  return step.role === "MANAGER" ? step.approverId === actor.employeeId || hrLike : hrLike;
}

export function applyDecision(state: RequestState, actor: Actor, decision: Decision, comment?: string): Outcome {
  if (state.status !== "PENDING") return { ok: false, error: "This request is no longer pending." };
  if (!canAct(state, actor)) return { ok: false, error: "You can't act on this request." };
  if (decision === "DECLINED" && !comment?.trim()) return { ok: false, error: "Add a short reason when declining." };

  const steps = state.steps.map((s) => (s.order === state.currentStep ? { ...s, decision, decidedById: actor.employeeId } : s));
  if (decision === "DECLINED") return { ok: true, state: { ...state, steps, status: "DECLINED" } };

  const lastOrder = Math.max(...state.steps.map((s) => s.order));
  const isLast = state.currentStep === lastOrder;
  return {
    ok: true,
    state: { ...state, steps, status: isLast ? "APPROVED" : "PENDING", currentStep: isLast ? state.currentStep : state.currentStep + 1 },
  };
}

export function applyWithdraw(state: RequestState, actorEmployeeId: string): Outcome {
  if (state.status !== "PENDING") return { ok: false, error: "Only pending requests can be withdrawn." };
  if (actorEmployeeId !== state.requesterId) return { ok: false, error: "Only the person who asked can withdraw this request." };
  return { ok: true, state: { ...state, status: "WITHDRAWN" } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/domain/approvals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/approvals tests/domain/approvals.test.ts
git commit -m "feat: add approval routing and decision rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Approval engine — database service

**Files:**
- Create: `src/server/approvals/registry.ts`, `src/server/approvals/engine.ts`
- Test: `tests/server/approvals.test.ts`

**Interfaces:**
- Consumes: `planSteps`, `parsePolicySteps`, `applyDecision`, `applyWithdraw`, `canAct`, `writeAudit`, `notifyEmployees`, `db`, `DbTx`, `Db`, `CurrentUser`.
- Produces:
  - `type ApprovalRef = { id; type; subjectId; requesterId; summary }`; `type ApprovalHooks = { label: string; link?: (ref) => string; onApproved?: (tx: DbTx, ref) => Promise<void>; onClosed?: (tx: DbTx, ref, status: "DECLINED" | "WITHDRAWN") => Promise<void> }`; `registerApprovalType(type, hooks)`, `getApprovalHooks(type): ApprovalHooks`
  - `submitApproval(tx: Db, input: { type; subjectId; requesterId; summary }): Promise<ApprovalRequest & { steps: ApprovalStep[] }>`
  - `decideApproval(actor: CurrentUser, requestId, decision: Decision, comment?, now?): Promise<{ ok: true; status: RequestStatus } | { ok: false; error: string }>`
  - `withdrawApproval(actor: CurrentUser, requestId, now?): Promise<same>`
  - `listPendingFor(actor: CurrentUser): Promise<(ApprovalRequest & { steps: ApprovalStep[] })[]>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/approvals.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadCurrentUser } from "@/server/auth/users";
import { registerApprovalType } from "@/server/approvals/registry";
import { decideApproval, listPendingFor, submitApproval, withdrawApproval } from "@/server/approvals/engine";
import { makeEmployee, resetDb } from "../helpers/db";

const events: string[] = [];
registerApprovalType("TEST", {
  label: "Test",
  link: (ref) => `/test/${ref.subjectId}`,
  onApproved: async (_tx, ref) => {
    events.push(`approved:${ref.subjectId}`);
  },
  onClosed: async (_tx, ref, status) => {
    events.push(`${status.toLowerCase()}:${ref.subjectId}`);
  },
});

async function org() {
  const hr = await makeEmployee({ name: "Neha Verma", isHR: true });
  const hr2 = await makeEmployee({ name: "Sonia Grewal", isHR: true });
  const manager = await makeEmployee({ name: "Ananya Sharma" });
  const emp = await makeEmployee({ name: "Arjun Mehta", managerId: manager.employee.id });
  const me = async (u: { user: { id: string } }) => (await loadCurrentUser(u.user.id))!;
  return { hr, hr2, manager, emp, me };
}

const submit = (requesterId: string, subjectId = "s1") =>
  db.$transaction((tx) => submitApproval(tx, { type: "TEST", subjectId, requesterId, summary: "Test · 3 Nov" }));

describe("approval engine", () => {
  beforeEach(async () => {
    await resetDb();
    events.length = 0;
    await db.approvalPolicy.create({ data: { type: "TEST", steps: JSON.stringify(["MANAGER", "HR"]) } });
  });

  it("routes manager → HR, notifies each approver and the requester, and runs hooks", async () => {
    const { hr, manager, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect(req.steps.map((s) => s.role)).toEqual(["MANAGER", "HR"]);
    expect(await db.notification.count({ where: { userId: manager.user.id, kind: "approval.pending" } })).toBe(1);

    expect(await listPendingFor(await me(manager))).toHaveLength(1);
    expect(await decideApproval(await me(manager), req.id, "APPROVED")).toEqual({ ok: true, status: "PENDING" });
    expect(await db.notification.count({ where: { userId: hr.user.id, kind: "approval.pending" } })).toBe(1);
    expect(await listPendingFor(await me(manager))).toHaveLength(0);

    expect(await decideApproval(await me(hr), req.id, "APPROVED")).toEqual({ ok: true, status: "APPROVED" });
    expect(events).toEqual(["approved:s1"]);
    const done = await db.notification.findFirstOrThrow({ where: { userId: emp.user.id, kind: "approval.approved" } });
    expect(done.link).toBe("/test/s1");
    expect(await db.auditLog.count({ where: { entityId: req.id } })).toBe(2);
  });

  it("declines with a reason and runs the close hook", async () => {
    const { manager, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect(await decideApproval(await me(manager), req.id, "DECLINED")).toEqual({ ok: false, error: "Add a short reason when declining." });
    expect(await decideApproval(await me(manager), req.id, "DECLINED", "Release week")).toEqual({ ok: true, status: "DECLINED" });
    expect(events).toEqual(["declined:s1"]);
    const n = await db.notification.findFirstOrThrow({ where: { userId: emp.user.id, kind: "approval.declined" } });
    expect(n.title).toContain("Release week");
  });

  it("refuses a second decision from someone who already decided", async () => {
    const { manager, hr, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect((await decideApproval(await me(manager), req.id, "APPROVED")).ok).toBe(true);
    expect(await decideApproval(await me(manager), req.id, "APPROVED")).toEqual({ ok: false, error: "You can't act on this request." });
    expect((await decideApproval(await me(hr), req.id, "APPROVED")).ok).toBe(true);
    const steps = await db.approvalStep.findMany({ where: { requestId: req.id }, orderBy: { order: "asc" } });
    expect(steps.map((s) => s.decidedById)).toEqual([manager.employee.id, hr.employee.id]);
  });

  it("does not let one HR person approve both steps", async () => {
    const { hr, hr2, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect((await decideApproval(await me(hr), req.id, "APPROVED")).ok).toBe(true);
    expect(await decideApproval(await me(hr), req.id, "APPROVED")).toEqual({ ok: false, error: "You can't act on this request." });
    expect((await decideApproval(await me(hr2), req.id, "APPROVED")).ok).toBe(true);
  });

  it("skips an exited manager and routes straight to HR", async () => {
    const { hr, manager, emp, me } = await org();
    await db.employee.update({ where: { id: manager.employee.id }, data: { status: "EXITED" } });
    const req = await submit(emp.employee.id);
    expect(req.steps.map((s) => s.role)).toEqual(["HR"]);
    expect(await listPendingFor(await me(hr))).toHaveLength(1);
  });

  it("lets the requester withdraw while pending, and nobody else", async () => {
    const { manager, emp, me } = await org();
    const req = await submit(emp.employee.id);
    expect((await withdrawApproval(await me(manager), req.id)).ok).toBe(false);
    expect(await withdrawApproval(await me(emp), req.id)).toEqual({ ok: true, status: "WITHDRAWN" });
    expect(events).toEqual(["withdrawn:s1"]);
    expect(await decideApproval(await me(manager), req.id, "APPROVED")).toEqual({ ok: false, error: "This request is no longer pending." });
  });

  it("never lists people's own requests as waiting on them", async () => {
    const { hr, me } = await org();
    await submit(hr.employee.id);
    expect(await listPendingFor(await me(hr))).toHaveLength(0);
  });

  it("fails loudly for an unknown request type and a missing request", async () => {
    const { emp, me } = await org();
    await expect(
      db.$transaction((tx) => submitApproval(tx, { type: "NOPE", subjectId: "x", requesterId: emp.employee.id, summary: "x" })),
    ).rejects.toThrow('No approval policy configured for "NOPE"');
    expect(await decideApproval(await me(emp), "missing", "APPROVED")).toEqual({ ok: false, error: "Request not found." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/approvals.test.ts`
Expected: FAIL — cannot resolve `@/server/approvals/registry`.

- [ ] **Step 3: Implement the registry**

```ts
// src/server/approvals/registry.ts
import "server-only";
import type { DbTx } from "@/server/db-types";

export type ApprovalRef = { id: string; type: string; subjectId: string; requesterId: string; summary: string };

export type ApprovalHooks = {
  label: string;
  link?: (ref: ApprovalRef) => string;
  onApproved?: (tx: DbTx, ref: ApprovalRef) => Promise<void>;
  onClosed?: (tx: DbTx, ref: ApprovalRef, status: "DECLINED" | "WITHDRAWN") => Promise<void>;
};

const registry = new Map<string, ApprovalHooks>();

export function registerApprovalType(type: string, hooks: ApprovalHooks): void {
  registry.set(type, hooks);
}

export function getApprovalHooks(type: string): ApprovalHooks {
  return registry.get(type) ?? { label: type };
}
```

- [ ] **Step 4: Implement the engine**

```ts
// src/server/approvals/engine.ts
import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/domain/auth/types";
import { applyDecision, applyWithdraw, canAct } from "@/domain/approvals/decide";
import { parsePolicySteps, planSteps } from "@/domain/approvals/routing";
import type { Actor, Decision, RequestState, RequestStatus, StepRole } from "@/domain/approvals/types";
import { writeAudit } from "@/server/audit";
import { notifyEmployees } from "@/server/notifications";
import type { Db, DbTx } from "@/server/db-types";
import { getApprovalHooks, type ApprovalRef } from "./registry";

type RequestWithSteps = Prisma.ApprovalRequestGetPayload<{ include: { steps: true } }>;
type EngineResult = { ok: true; status: RequestStatus } | { ok: false; error: string };

const actorOf = (u: CurrentUser): Actor => ({ employeeId: u.employeeId, isHR: u.isHR, isAdmin: u.isAdmin });

function toState(r: RequestWithSteps): RequestState {
  return {
    status: r.status as RequestStatus,
    currentStep: r.currentStep,
    requesterId: r.requesterId,
    steps: [...r.steps]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        order: s.order,
        role: s.role as StepRole,
        approverId: s.approverId,
        decision: s.decision as Decision | null,
        decidedById: s.decidedById,
      })),
  };
}

const refOf = (r: RequestWithSteps): ApprovalRef => ({ id: r.id, type: r.type, subjectId: r.subjectId, requesterId: r.requesterId, summary: r.summary });

async function notifyNextApprovers(tx: Db, r: RequestWithSteps): Promise<void> {
  const step = r.steps.find((s) => s.order === r.currentStep);
  if (!step) return;
  const requester = await tx.employee.findUniqueOrThrow({ where: { id: r.requesterId }, select: { fullName: true } });
  let employeeIds: string[];
  if (step.role === "MANAGER" && step.approverId) {
    employeeIds = [step.approverId];
  } else {
    const hrUsers = await tx.user.findMany({
      where: { OR: [{ isHR: true }, { isAdmin: true }], employeeId: { not: r.requesterId }, employee: { status: { not: "EXITED" } } },
      select: { employeeId: true },
    });
    const alreadyDecided = new Set(r.steps.map((s) => s.decidedById).filter(Boolean));
    employeeIds = hrUsers.map((u) => u.employeeId).filter((id) => !alreadyDecided.has(id));
  }
  const label = getApprovalHooks(r.type).label;
  await notifyEmployees(tx, employeeIds, { kind: "approval.pending", title: `${requester.fullName} needs your approval · ${label}: ${r.summary}`, link: "/approvals" });
}

export async function submitApproval(tx: Db, input: { type: string; subjectId: string; requesterId: string; summary: string }): Promise<RequestWithSteps> {
  const policy = await tx.approvalPolicy.findUnique({ where: { type: input.type } });
  if (!policy) throw new Error(`No approval policy configured for "${input.type}"`);
  const requester = await tx.employee.findUniqueOrThrow({
    where: { id: input.requesterId },
    select: { id: true, manager: { select: { id: true, status: true } } },
  });
  const activeManagerId = requester.manager && requester.manager.status !== "EXITED" ? requester.manager.id : null;
  const steps = planSteps(parsePolicySteps(policy.steps), { employeeId: requester.id, managerId: activeManagerId });
  const created = await tx.approvalRequest.create({
    data: {
      type: input.type,
      subjectId: input.subjectId,
      requesterId: input.requesterId,
      summary: input.summary,
      steps: { create: steps.map((s) => ({ order: s.order, role: s.role, approverId: s.approverId })) },
    },
    include: { steps: true },
  });
  await notifyNextApprovers(tx, created);
  return created;
}

async function finish(tx: DbTx, r: RequestWithSteps, status: RequestStatus, comment: string | undefined): Promise<void> {
  const hooks = getApprovalHooks(r.type);
  const ref = refOf(r);
  const link = hooks.link?.(ref) ?? "/home";
  if (status === "APPROVED") {
    await hooks.onApproved?.(tx, ref);
    await notifyEmployees(tx, [r.requesterId], { kind: "approval.approved", title: `Approved · ${hooks.label}: ${r.summary}`, link });
  } else if (status === "DECLINED") {
    await hooks.onClosed?.(tx, ref, "DECLINED");
    await notifyEmployees(tx, [r.requesterId], { kind: "approval.declined", title: `Declined · ${hooks.label}: ${r.summary} — "${comment?.trim()}"`, link });
  } else if (status === "WITHDRAWN") {
    await hooks.onClosed?.(tx, ref, "WITHDRAWN");
  }
}

export function decideApproval(actor: CurrentUser, requestId: string, decision: Decision, comment?: string, now = new Date()): Promise<EngineResult> {
  return db.$transaction(async (tx): Promise<EngineResult> => {
    const r = await tx.approvalRequest.findUnique({ where: { id: requestId }, include: { steps: true } });
    if (!r) return { ok: false, error: "Request not found." };
    const state = toState(r);
    const outcome = applyDecision(state, actorOf(actor), decision, comment);
    if (!outcome.ok) return outcome;

    const claim = await tx.approvalRequest.updateMany({
      where: { id: r.id, status: "PENDING", currentStep: state.currentStep },
      data: { status: outcome.state.status, currentStep: outcome.state.currentStep },
    });
    if (claim.count !== 1) return { ok: false, error: "Someone else already acted on this request." };

    const step = r.steps.find((s) => s.order === state.currentStep)!;
    await tx.approvalStep.update({
      where: { id: step.id },
      data: { decision, decidedById: actor.employeeId, comment: comment?.trim() || null, decidedAt: now },
    });
    await writeAudit(tx, {
      actorId: actor.userId,
      action: `approval.${decision.toLowerCase()}`,
      entityType: "ApprovalRequest",
      entityId: r.id,
      before: { status: state.status, currentStep: state.currentStep },
      after: { status: outcome.state.status, currentStep: outcome.state.currentStep },
    });

    const updated = await tx.approvalRequest.findUniqueOrThrow({ where: { id: r.id }, include: { steps: true } });
    if (outcome.state.status === "PENDING") await notifyNextApprovers(tx, updated);
    else await finish(tx, updated, outcome.state.status, comment);
    return { ok: true, status: outcome.state.status };
  });
}

export function withdrawApproval(actor: CurrentUser, requestId: string, now = new Date()): Promise<EngineResult> {
  return db.$transaction(async (tx): Promise<EngineResult> => {
    const r = await tx.approvalRequest.findUnique({ where: { id: requestId }, include: { steps: true } });
    if (!r) return { ok: false, error: "Request not found." };
    const outcome = applyWithdraw(toState(r), actor.employeeId);
    if (!outcome.ok) return outcome;
    const claim = await tx.approvalRequest.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "WITHDRAWN", updatedAt: now } });
    if (claim.count !== 1) return { ok: false, error: "Someone else already acted on this request." };
    await writeAudit(tx, { actorId: actor.userId, action: "approval.withdrawn", entityType: "ApprovalRequest", entityId: r.id, before: { status: "PENDING" }, after: { status: "WITHDRAWN" } });
    await finish(tx, r, "WITHDRAWN", undefined);
    return { ok: true, status: "WITHDRAWN" };
  });
}

export async function listPendingFor(actor: CurrentUser): Promise<RequestWithSteps[]> {
  const rows = await db.approvalRequest.findMany({
    where: { status: "PENDING", requesterId: { not: actor.employeeId } },
    include: { steps: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((r) => canAct(toState(r), actorOf(actor)));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/server/approvals.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all test files pass; typecheck prints nothing.

- [ ] **Step 7: Commit**

```bash
git add src/server/approvals tests/server/approvals.test.ts
git commit -m "feat: add approval engine with hooks, notifications and audit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Design system — tokens, fonts, root layout and shared UI

**Files:**
- Create: `src/app/globals.css`, `src/components/ui/Icon.tsx`, `src/components/ui/IconSprite.tsx`, `src/components/ui/Avatar.tsx`, `src/components/ui/SubmitButton.tsx`, `src/components/ui/WordReveal.tsx`, `src/components/ui/Toaster.tsx`, `src/components/shell/Interactions.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `ICON_NAMES`, `IconName`, `initials`, `avatarColor`.
- Produces: `<Icon name className? label? />`, `<IconSprite />`, `<Avatar name size? />` (`size: "xs" | "md" | "lg"`), `<SubmitButton className?>`, `<WordReveal text accentLast? as? />`, `<ToastProvider>`, `useToast(): (message: string) => void`, `<Interactions />` (cursor, magnetic `[data-magnetic]`, ripple on `.btn`, spotlight `.spot`, tilt `[data-tilt]`); theme cookie `lnp_theme` (`"light" | "dark"`) read by the root layout.

- [ ] **Step 1: Write `src/app/globals.css`**

```css
/* ===== Tokens (approved "Nordic Calm" prototype) ===== */
:root {
  --bg: #f2f4f1; --surface: #fff; --surface-2: #f6f8f5; --ink: #13221a; --muted: #5f6d64; --line: #e2e7e2;
  --brand: #1e4d3a; --on-brand: #fff; --brand-soft: #dcebe1;
  --sun: #f2b33d; --sun-soft: #fcefd3; --sun-ink: #5a3f07;
  --coral: #c9573a; --coral-soft: #fbe4dc; --sky: #3f659c; --sky-soft: #e2eaf5; --ok: #2e8b57;
  --side: #15382a; --side-ink: #a8c5b5; --hero: #1e4d3a;
  --shadow: 0 1px 2px rgba(19, 34, 26, 0.05), 0 0 0 1px var(--line);
  --shadow-hi: 0 20px 40px -20px rgba(19, 34, 26, 0.3), 0 0 0 1px var(--line);
  --ease: cubic-bezier(0.2, 0.75, 0.2, 1); --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --display: var(--font-bricolage), "Bricolage Grotesque", sans-serif;
  --ui: var(--font-manrope), "Manrope", system-ui, sans-serif;
  color-scheme: light;
}
[data-theme="dark"] {
  --bg: #0e1411; --surface: #151d19; --surface-2: #1a231f; --ink: #e6eee9; --muted: #93a198; --line: #25302a;
  --brand: #86cfa6; --on-brand: #0e1411; --brand-soft: #1d3328;
  --sun-soft: #33291a; --sun-ink: #f2c670; --coral: #f08a6c; --coral-soft: #3a2019; --sky: #8fb0e0; --sky-soft: #1b2638; --ok: #7fd3a0;
  --side: #0a0f0c; --side-ink: #7f9488; --hero: #173628;
  --shadow: 0 0 0 1px var(--line); --shadow-hi: 0 20px 40px -20px rgba(0, 0, 0, 0.7), 0 0 0 1px #34433b;
  color-scheme: dark;
}

/* ===== Base ===== */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--ui); background: var(--bg); color: var(--ink); -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.45; }
a { color: inherit; text-decoration: none; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
button:disabled { cursor: not-allowed; }
:focus-visible { outline: 2.5px solid var(--sun); outline-offset: 2px; border-radius: 8px; }
.i { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.muted { color: var(--muted); }

@keyframes rise { from { opacity: 0; transform: translateY(18px); } }
@keyframes pop { from { opacity: 0; transform: translateY(10px) scale(0.97); } }
@keyframes wordup { from { transform: translateY(110%); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes rip { to { transform: scale(16); opacity: 0; } }
@keyframes tin { from { opacity: 0; transform: translateY(18px) scale(0.95); } }
@keyframes tout { to { opacity: 0; transform: translateX(40px); } }
.rv { animation: rise 0.7s var(--ease) backwards; animation-delay: calc(var(--i, 0) * 70ms); }

/* ===== Type ===== */
.eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.h1 { font: 700 42px/1.05 var(--display); letter-spacing: -0.04em; margin-top: 8px; }
.h1 .w { display: inline-block; overflow: hidden; vertical-align: bottom; padding-bottom: 0.1em; margin-bottom: -0.1em; }
.h1 .w > span { display: inline-block; animation: wordup 0.9s var(--ease) backwards; animation-delay: calc(var(--w) * 70ms + 120ms); }
.h1 .acc { color: var(--brand); }
.lede { color: var(--muted); font-size: 15px; margin-top: 10px; max-width: 560px; font-weight: 500; }

/* ===== Surfaces & controls ===== */
.card { background: var(--surface); border-radius: 20px; padding: 20px; box-shadow: var(--shadow); position: relative; transition: box-shadow 0.35s var(--ease), transform 0.35s var(--ease); }
@media (hover: hover) { .card.lift:hover { transform: translateY(-3px); box-shadow: var(--shadow-hi); } }
.card-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.card-t { font-weight: 800; font-size: 14.5px; }
.card-a { font-size: 12.5px; font-weight: 700; color: var(--muted); }
.spot::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; background: radial-gradient(260px circle at var(--mx, -200px) var(--my, -200px), color-mix(in srgb, var(--brand) 11%, transparent), transparent 60%); opacity: 0; transition: opacity 0.3s; }
.spot:hover::after { opacity: 1; }
.link { color: var(--brand); font-weight: 800; font-size: 13px; background: linear-gradient(currentColor 0 0) 0 100% / 0 1.5px no-repeat; transition: background-size 0.3s var(--ease); padding-bottom: 1px; }
.link:hover, .link:focus-visible { background-size: 100% 1.5px; }
.btn { position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 18px; border-radius: 14px; font-weight: 800; font-size: 14px; transition: transform 0.35s var(--ease), box-shadow 0.3s var(--ease), background 0.25s, opacity 0.2s, scale 0.15s; }
.btn:active:not(:disabled) { scale: 0.96; }
.btn:disabled { opacity: 0.5; }
.btn-primary { background: var(--brand); color: var(--on-brand); }
@media (hover: hover) { .btn-primary:not(:disabled):hover { box-shadow: 0 14px 26px -12px color-mix(in srgb, var(--brand) 80%, transparent); } }
.btn-ghost { background: var(--surface); color: var(--ink); box-shadow: var(--shadow); }
.btn-ghost:hover { box-shadow: 0 0 0 1.5px var(--brand); }
.btn-sun { background: var(--sun); color: #2b1f04; }
.btn .spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: spin 0.7s linear infinite; }
.rip { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; background: currentColor; opacity: 0.25; transform: scale(0); animation: rip 0.6s var(--ease) forwards; pointer-events: none; }
.label { display: block; font-weight: 700; font-size: 13px; margin: 16px 0 6px; }
.field { width: 100%; border: 0; border-radius: 14px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); padding: 12px 14px; font: 500 14px var(--ui); color: var(--ink); transition: box-shadow 0.2s; }
.field:focus { outline: none; box-shadow: inset 0 0 0 2px var(--brand); }
.help { font-size: 12.5px; color: var(--muted); margin-top: 4px; }
.form-error { margin-top: 14px; padding: 10px 12px; border-radius: 12px; background: var(--coral-soft); color: var(--coral); font-weight: 700; font-size: 13.5px; animation: pop 0.35s var(--ease); }
.form-msg { margin-top: 14px; padding: 10px 12px; border-radius: 12px; background: var(--brand-soft); color: var(--brand); font-weight: 700; font-size: 13.5px; animation: pop 0.35s var(--ease); }
.av { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font: 800 12.5px var(--ui); color: #fff; flex: none; }
.av.xs { width: 26px; height: 26px; font-size: 10px; }
.av.lg { width: 54px; height: 54px; font-size: 17px; }
.pill { font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 99px; white-space: nowrap; background: var(--brand-soft); color: var(--brand); }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 0; }
.row + .row { border-top: 1px solid var(--line); }
.row .t { font-weight: 700; font-size: 14px; }
.row .s { font-size: 12.5px; color: var(--muted); margin-top: 1px; }
.nt-ic { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); color: var(--muted); flex: none; }
.grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.s4 { grid-column: span 4; } .s6 { grid-column: span 6; } .s8 { grid-column: span 8; } .s12 { grid-column: span 12; }

/* ===== Shell ===== */
.app { display: grid; grid-template-columns: 244px 1fr; min-height: 100vh; }
.side { position: sticky; top: 0; height: 100vh; background: var(--side); color: var(--side-ink); padding: 22px 14px; display: flex; flex-direction: column; z-index: 30; }
.brand { display: flex; align-items: center; gap: 10px; color: #fff; font: 700 19px var(--display); letter-spacing: -0.02em; padding: 2px 10px 28px; }
.brand-mark { width: 30px; height: 30px; border-radius: 50% 50% 50% 6px; background: var(--sun); display: grid; place-items: center; color: #15382a; font: 800 13px var(--display); }
.nav { position: relative; display: flex; flex-direction: column; gap: 2px; }
.nav-pill { position: absolute; top: 0; left: 0; border-radius: 12px; background: rgba(255, 255, 255, 0.1); transition: transform 0.5s var(--spring), width 0.3s, height 0.3s, opacity 0.2s; pointer-events: none; }
.nav-btn { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 12px; border-radius: 12px; font-weight: 600; font-size: 14.5px; color: var(--side-ink); transition: color 0.2s; }
.nav-btn:hover, .nav-btn[aria-current="page"] { color: #fff; }
.side-foot { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
.hint { font-size: 12px; padding: 0 12px; }
.hint kbd { font: 700 11px var(--ui); padding: 2px 6px; border-radius: 5px; background: rgba(255, 255, 255, 0.1); color: #fff; }
.me { display: flex; gap: 10px; align-items: center; padding: 10px; border-radius: 14px; background: rgba(0, 0, 0, 0.18); font-size: 13px; color: #fff; }
.me small { display: block; color: var(--side-ink); font-size: 11.5px; }
.main { min-width: 0; display: flex; flex-direction: column; }
.top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 12px; padding: 16px 32px; background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.search-trigger { display: flex; align-items: center; gap: 10px; width: min(420px, 100%); padding: 10px 12px 10px 14px; border-radius: 12px; background: var(--surface); box-shadow: var(--shadow); color: var(--muted); font-weight: 500; transition: box-shadow 0.25s; }
.search-trigger:hover { box-shadow: 0 0 0 1.5px var(--brand); }
.search-trigger kbd { margin-left: auto; font: 700 11px var(--ui); padding: 3px 7px; border-radius: 6px; background: var(--surface-2); box-shadow: 0 0 0 1px var(--line); }
.top-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.icon-btn { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--surface); box-shadow: var(--shadow); position: relative; transition: transform 0.25s var(--ease); }
@media (hover: hover) { .icon-btn:hover { transform: translateY(-2px); } }
.dot-badge { position: absolute; top: 9px; right: 10px; width: 8px; height: 8px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 2px var(--surface); }
[data-theme="dark"] .ic-moon, :root:not([data-theme="dark"]) .ic-sun { display: none; }
.page { padding: 6px 32px 56px; }
.ph { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin: 12px 0 24px; flex-wrap: wrap; }

/* ===== Popover (notifications) ===== */
.bell-wrap { position: relative; }
.pop { position: absolute; top: 50px; right: 0; width: 350px; background: var(--surface); border-radius: 18px; box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--line); padding: 8px; opacity: 0; transform: translateY(-6px) scale(0.97); transform-origin: top right; pointer-events: none; visibility: hidden; transition: opacity 0.2s var(--ease), transform 0.25s var(--ease), visibility 0.25s; z-index: 40; }
.pop.open { opacity: 1; transform: none; pointer-events: auto; visibility: visible; }
.pop-h { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px 10px; }
.pop-empty { padding: 18px 10px; color: var(--muted); text-align: center; }
.nt { display: flex; gap: 12px; padding: 10px; border-radius: 12px; position: relative; }
.nt:hover { background: var(--surface-2); }
.nt.unread::after { content: ""; position: absolute; right: 12px; top: 16px; width: 7px; height: 7px; border-radius: 50%; background: var(--coral); }
.nt p { font-size: 13.5px; font-weight: 600; padding-right: 14px; }
.nt small { color: var(--muted); font-size: 12px; }

/* ===== Command menu ===== */
.cmdk { position: fixed; inset: 0; z-index: 100; display: grid; place-items: start center; padding-top: 12vh; }
.cmdk-bg { position: absolute; inset: 0; background: rgba(8, 18, 13, 0.4); backdrop-filter: blur(3px); opacity: 0; transition: opacity 0.2s; }
.cmdk-panel { position: relative; width: min(580px, 92vw); background: var(--surface); border-radius: 18px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--line); overflow: hidden; opacity: 0; transform: translateY(-10px) scale(0.98); transition: opacity 0.2s var(--ease), transform 0.3s var(--ease); }
.cmdk.open .cmdk-bg, .cmdk.open .cmdk-panel { opacity: 1; transform: none; }
.cmdk-in { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--line); color: var(--muted); }
.cmdk-in input { flex: 1; border: 0; background: none; font: 600 16px var(--ui); color: var(--ink); outline: none; }
.cmdk kbd { font: 700 11px var(--ui); padding: 2px 6px; border-radius: 5px; background: var(--surface-2); box-shadow: 0 0 0 1px var(--line); }
.cmdk-list { list-style: none; max-height: 340px; overflow: auto; padding: 8px; }
.cmdk-g { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 10px 10px 6px; }
.cmdk-it { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; }
.cmdk-it[aria-selected="true"] { background: var(--brand-soft); color: var(--brand); }
.cmdk-empty { padding: 28px; text-align: center; color: var(--muted); }
.cmdk-foot { display: flex; gap: 16px; padding: 10px 18px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); font-weight: 600; }

/* ===== Toasts ===== */
.toasts { position: fixed; right: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 120; }
.toast { display: flex; align-items: center; gap: 10px; background: var(--ink); color: var(--bg); padding: 10px 16px 10px 10px; border-radius: 14px; font-weight: 700; box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.45); animation: tin 0.55s var(--spring) backwards; max-width: 380px; }
.toast.out { animation: tout 0.3s var(--ease) forwards; }
.t-ic { width: 28px; height: 28px; border-radius: 9px; background: var(--sun); color: #2e2104; display: grid; place-items: center; flex: none; }

/* ===== Custom cursor ===== */
.cur-dot, .cur-ring { position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999; opacity: 0; transition: opacity 0.3s; }
.cur-dot { width: 6px; height: 6px; margin: -3px 0 0 -3px; border-radius: 50%; background: var(--brand); }
.cur-ring { width: 36px; height: 36px; margin: -18px 0 0 -18px; }
.cur-ring span { display: block; width: 100%; height: 100%; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--brand) 55%, transparent); transition: transform 0.35s var(--ease), background 0.3s, border-color 0.3s; }
.cur-ring.hover span { transform: scale(1.55); background: color-mix(in srgb, var(--brand) 9%, transparent); border-color: color-mix(in srgb, var(--brand) 25%, transparent); }
.cur-ring.down span { transform: scale(0.7); }
.cur-ring.dark span { border-color: rgba(242, 179, 61, 0.7); }
.cursor-on .cur-dot, .cursor-on .cur-ring { opacity: 1; }
.cursor-dark .cur-dot { background: var(--sun); }
[data-magnetic] { transition: transform 0.35s var(--ease); }
[data-tilt] { transition: transform 0.25s ease-out; }

/* ===== Auth screens ===== */
.auth { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100vh; }
.auth-art { position: relative; overflow: hidden; background: var(--hero); color: #eaf4ee; padding: 40px; display: flex; flex-direction: column; justify-content: space-between; }
.auth-art::before { content: ""; position: absolute; width: 520px; height: 520px; right: -180px; top: -200px; border-radius: 50%; background: radial-gradient(circle, rgba(242, 179, 61, 0.32), transparent 65%); }
.auth-art::after { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px); background-size: 14px 14px; mask-image: linear-gradient(200deg, #000, transparent 70%); }
.auth-art > * { position: relative; z-index: 1; }
.auth-quote { font: 600 38px/1.1 var(--display); letter-spacing: -0.03em; max-width: 440px; }
.auth-foot { opacity: 0.6; font-weight: 600; }
.auth-main { display: grid; place-items: center; padding: 32px; }
.auth-card { width: min(400px, 100%); }
.auth-card .h1 { font-size: 34px; }
.auth-card .btn { width: 100%; margin-top: 20px; }
.auth-card .after { margin-top: 18px; text-align: center; }

/* ===== Responsive & motion ===== */
@media (max-width: 1100px) { .s4, .s6 { grid-column: span 6; } .s8 { grid-column: span 12; } }
@media (max-width: 820px) {
  .app { grid-template-columns: 1fr; }
  .side { position: fixed; inset: auto 0 0 0; height: auto; padding: 8px; flex-direction: row; }
  .brand, .side-foot { display: none; }
  .nav { flex-direction: row; width: 100%; justify-content: space-around; }
  .nav-btn { flex-direction: column; gap: 3px; font-size: 11px; padding: 8px 6px; width: auto; flex: 1; }
  .main { padding-bottom: 84px; }
  .top { padding: 12px 16px; } .page { padding: 4px 16px 40px; }
  .s4, .s6, .s8 { grid-column: span 12; }
  .h1 { font-size: 32px; }
  .search-trigger span { display: none; }
  .toasts { bottom: 84px; left: 16px; right: 16px; }
  .pop { width: min(350px, 92vw); }
  .auth { grid-template-columns: 1fr; } .auth-art { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
@media (prefers-reduced-transparency: reduce) { .top { backdrop-filter: none; background: var(--bg); } }
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
```

- [ ] **Step 2: Write the icon components**

```tsx
// src/components/ui/Icon.tsx
import type { IconName } from "./icon-names";

export function Icon({ name, className = "i", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg className={className} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
```

```tsx
// src/components/ui/IconSprite.tsx
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
      <symbol id="i-plane" viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></symbol>
      <symbol id="i-wallet" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></symbol>
      <symbol id="i-heart" viewBox="0 0 24 24"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></symbol>
      <symbol id="i-moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" /></symbol>
      <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></symbol>
      <symbol id="i-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></symbol>
      <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></symbol>
      <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3l1.9 5.8L20 10.5l-6.1 1.7L12 18l-1.9-5.8L4 10.5l6.1-1.7z" /></symbol>
      <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></symbol>
    </svg>
  );
}
```

- [ ] **Step 3: Write Avatar, SubmitButton and WordReveal**

```tsx
// src/components/ui/Avatar.tsx
import { avatarColor, initials } from "@/lib/avatar";

export function Avatar({ name, size = "md" }: { name: string; size?: "xs" | "md" | "lg" }) {
  return (
    <span className={`av${size === "md" ? "" : ` ${size}`}`} style={{ background: avatarColor(name) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
```

```tsx
// src/components/ui/SubmitButton.tsx
"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn btn-primary", label }: { children: React.ReactNode; className?: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} aria-label={label} data-magnetic>
      {pending ? <span className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
```

```tsx
// src/components/ui/WordReveal.tsx
import { Fragment } from "react";

export function WordReveal({ text, accentLast = false, className = "h1" }: { text: string; accentLast?: boolean; className?: string }) {
  const words = text.split(" ");
  return (
    <h1 className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="w" aria-hidden="true">
            <span style={{ "--w": i } as React.CSSProperties} className={accentLast && i === words.length - 1 ? "acc" : undefined}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </h1>
  );
}
```

- [ ] **Step 4: Write the toast provider**

```tsx
// src/components/ui/Toaster.tsx
"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./Icon";

type Toast = { id: number; message: string; leaving: boolean };
const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const toast = useCallback((message: string) => {
    const id = ++nextId.current;
    setToasts((t) => [...t, { id, message, leaving: false }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3800);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.leaving ? " out" : ""}`}>
            <span className="t-ic"><Icon name="check" /></span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Step 5: Write the global interactions component**

```tsx
// src/components/shell/Interactions.tsx
"use client";
import { useEffect, useRef } from "react";

/** Custom cursor, magnetic buttons, ripples, card spotlight and tilt — fine pointers only, off for reduced motion. */
export function Interactions() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const root = document.documentElement;

    const onDown = (e: PointerEvent) => {
      const b = (e.target as Element).closest?.<HTMLButtonElement>(".btn");
      if (!b || reduce || b.disabled) return;
      const r = b.getBoundingClientRect();
      const s = document.createElement("span");
      s.className = "rip";
      s.style.left = `${e.clientX - r.left}px`;
      s.style.top = `${e.clientY - r.top}px`;
      b.append(s);
      s.addEventListener("animationend", () => s.remove());
    };
    document.addEventListener("pointerdown", onDown);
    if (!fine || reduce) return () => document.removeEventListener("pointerdown", onDown);

    const dot = dotRef.current!;
    const ring = ringRef.current!;
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    let mag: HTMLElement | null = null;
    let tilt: HTMLElement | null = null;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.transform = `translate(${x}px,${y}px)`;
      root.classList.add("cursor-on");
      const t = e.target as Element;
      const m = t.closest?.<HTMLElement>("[data-magnetic]") ?? null;
      if (mag && mag !== m) mag.style.transform = "";
      mag = m;
      if (m && !(m as HTMLButtonElement).disabled) {
        const r = m.getBoundingClientRect();
        m.style.transform = `translate(${(x - r.left - r.width / 2) * 0.28}px,${(y - r.top - r.height / 2) * 0.4}px)`;
      }
      const tc = t.closest?.<HTMLElement>("[data-tilt]") ?? null;
      if (tilt && tilt !== tc) tilt.style.transform = "";
      tilt = tc;
      if (tc) {
        const r = tc.getBoundingClientRect();
        const px = (x - r.left) / r.width - 0.5;
        const py = (y - r.top) / r.height - 0.5;
        tc.style.transform = `perspective(800px) rotateX(${-py * 7}deg) rotateY(${px * 7}deg) translateY(-3px)`;
      }
      const sp = t.closest?.<HTMLElement>(".spot");
      if (sp) {
        const r = sp.getBoundingClientRect();
        sp.style.setProperty("--mx", `${x - r.left}px`);
        sp.style.setProperty("--my", `${y - r.top}px`);
      }
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element;
      ring.classList.toggle("hover", !!t.closest?.("a,button,input,textarea,select,label,[data-cursor]"));
      const dark = !!t.closest?.(".side,.auth-art,.toast");
      ring.classList.toggle("dark", dark);
      root.classList.toggle("cursor-dark", dark);
    };
    const onLeave = () => root.classList.remove("cursor-on");
    const onPress = () => ring.classList.add("down");
    const onRelease = () => ring.classList.remove("down");
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver);
    root.addEventListener("mouseleave", onLeave);
    window.addEventListener("pointerdown", onPress);
    window.addEventListener("pointerup", onRelease);
    raf = requestAnimationFrame(loop);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      root.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("pointerup", onRelease);
      cancelAnimationFrame(raf);
      root.classList.remove("cursor-on", "cursor-dark");
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className="cur-ring" aria-hidden="true"><span /></div>
      <div ref={dotRef} className="cur-dot" aria-hidden="true" />
    </>
  );
}
```

- [ ] **Step 6: Replace the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { cookies } from "next/headers";
import { IconSprite } from "@/components/ui/IconSprite";
import { Interactions } from "@/components/shell/Interactions";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["500", "600", "700", "800"] });
const ui = Manrope({ subsets: ["latin"], variable: "--font-manrope", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "LN People", template: "%s · LN People" },
  description: "LN Webworks' people and HR system",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("lnp_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme} className={`${display.variable} ${ui.variable}`}>
      <body>
        <IconSprite />
        {children}
        <Interactions />
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: typecheck clean; build succeeds (the font download needs internet access the first time).

- [ ] **Step 8: Commit**

```bash
git add src/app src/components
git commit -m "feat: add Nordic Calm design system, fonts and global interactions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Auth wiring — cookie, current user, proxy and auth screens

**Files:**
- Create: `src/lib/session-config.ts`, `src/server/auth/session-cookie.ts`, `src/server/auth/current-user.ts`, `src/proxy.ts`, `src/app/(auth)/layout.tsx`, `src/app/(auth)/actions.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/LoginForm.tsx`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/forgot-password/ForgotForm.tsx`, `src/app/(auth)/set-password/page.tsx`, `src/app/(auth)/set-password/SetPasswordForm.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/proxy.test.ts`

**Interfaces:**
- Consumes: `authenticate`, `createSession`, `validateSessionToken`, `revokeSession`, `revokeAllSessions`, `requestPasswordReset`, `peekPasswordToken`, `consumePasswordToken`, `safeNext`, `SubmitButton`.
- Produces:
  - `SESSION_COOKIE = "lnp_session"`, `SESSION_COOKIE_MAX_AGE_S`, `PUBLIC_PATHS`
  - `setSessionCookie(token, expiresAt)`, `clearSessionCookie()`, `readSessionCookie(): Promise<string | null>`
  - `getCurrentUser(): Promise<CurrentUser | null>` (request-cached), `requireUser(): Promise<CurrentUser>` (redirects to `/login`)
  - `proxy(req: NextRequest): NextResponse`
  - Server actions: `loginAction`, `forgotPasswordAction`, `setPasswordAction` (all `(prev: FormState, formData: FormData) => Promise<FormState>`), `logoutAction()`, `logoutEverywhereAction()`; `type FormState = { error?: string; message?: string; email?: string } | undefined`

- [ ] **Step 1: Write the failing proxy test**

```ts
// tests/proxy.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/proxy.test.ts`
Expected: FAIL — cannot resolve `@/proxy`.

- [ ] **Step 3: Implement the session config and proxy**

```ts
// src/lib/session-config.ts
export const SESSION_COOKIE = "lnp_session";
export const SESSION_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;
export const PUBLIC_PATHS = ["/login", "/forgot-password", "/set-password"] as const;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
```

```ts
// src/proxy.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/proxy.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement cookie helpers and current user**

```ts
// src/server/auth/session-cookie.ts
import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-config";

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: expiresAt });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}
```

```ts
// src/server/auth/current-user.ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { CurrentUser } from "@/domain/auth/types";
import { validateSessionToken } from "./sessions";
import { readSessionCookie } from "./session-cookie";

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionCookie();
  if (!token) return null;
  return (await validateSessionToken(token))?.user ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
```

- [ ] **Step 6: Implement the auth server actions**

```ts
// src/app/(auth)/actions.ts
"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { authenticate } from "@/server/auth/login";
import { createSession, revokeAllSessions, revokeSession } from "@/server/auth/sessions";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "@/server/auth/session-cookie";
import { consumePasswordToken, requestPasswordReset } from "@/server/auth/password-tokens";
import { requireUser } from "@/server/auth/current-user";

export type FormState = { error?: string; message?: string; email?: string } | undefined;

const loginSchema = z.object({ email: z.email(), password: z.string().min(1), next: z.string().optional() });

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email: email.trim(), password: formData.get("password"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { error: "Enter your work email and password.", email };
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return {
      error: result.reason === "locked" ? "Too many attempts. Try again in 15 minutes." : "That email and password don't match.",
      email,
    };
  }
  const { token, expiresAt } = await createSession(result.userId);
  await setSessionCookie(token, expiresAt);
  redirect(safeNext(parsed.data.next));
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.email().safeParse(email).success) return { error: "Enter a valid email address.", email };
  await requestPasswordReset(email);
  return { message: "If that email belongs to an LN People account, a reset link is on its way. It works for 1 hour." };
}

export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const result = await consumePasswordToken(token, password);
  if (!result.ok) return { error: result.error };
  const { token: sessionToken, expiresAt } = await createSession(result.userId);
  await setSessionCookie(sessionToken, expiresAt);
  redirect("/home");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionCookie();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function logoutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await revokeAllSessions(user.userId);
  await clearSessionCookie();
  redirect("/login");
}
```

- [ ] **Step 7: Write the auth layout and screens**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-hidden="true">
        <div className="brand"><span className="brand-mark">ln</span><span>LN People</span></div>
        <p className="auth-quote">Everything about work here, in one calm place.</p>
        <p className="auth-foot">LN Webworks · Mohali</p>
      </section>
      <main className="auth-main">{children}</main>
    </div>
  );
}
```

```tsx
// src/app/(auth)/login/page.tsx
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/current-user";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (await getCurrentUser()) redirect("/home");
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}
```

```tsx
// src/app/(auth)/login/LoginForm.tsx
"use client";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="auth-card rv" noValidate>
      <div className="eyebrow">LN People</div>
      <h1 className="h1">Welcome back</h1>
      <p className="lede">Sign in with your LN Webworks email.</p>
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="label" htmlFor="email">Work email</label>
      <input className="field" id="email" name="email" type="email" autoComplete="username" defaultValue={state?.email} required autoFocus />
      <label className="label" htmlFor="password">Password</label>
      <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <SubmitButton>Sign in</SubmitButton>
      <p className="after"><Link className="link" href="/forgot-password">Forgot your password?</Link></p>
    </form>
  );
}
```

```tsx
// src/app/(auth)/forgot-password/page.tsx
import type { Metadata } from "next";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
```

```tsx
// src/app/(auth)/forgot-password/ForgotForm.tsx
"use client";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { forgotPasswordAction } from "../actions";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="auth-card rv" noValidate>
      <h1 className="h1">Reset your password</h1>
      <p className="lede">We'll email you a link to choose a new one.</p>
      <label className="label" htmlFor="email">Work email</label>
      <input className="field" id="email" name="email" type="email" autoComplete="username" defaultValue={state?.email} required autoFocus />
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      {state?.message ? <p className="form-msg">{state.message}</p> : null}
      <SubmitButton>Send reset link</SubmitButton>
      <p className="after"><Link className="link" href="/login">Back to sign in</Link></p>
    </form>
  );
}
```

```tsx
// src/app/(auth)/set-password/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { peekPasswordToken } from "@/server/auth/password-tokens";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata: Metadata = { title: "Set your password" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const info = typeof token === "string" ? await peekPasswordToken(token) : null;
  if (typeof token !== "string" || !info) {
    return (
      <div className="auth-card rv">
        <h1 className="h1">This link has expired</h1>
        <p className="lede">Links work once and only for a limited time. Ask for a fresh one and you'll be back in a minute.</p>
        <Link className="btn btn-primary" href="/forgot-password">Get a new link</Link>
      </div>
    );
  }
  return <SetPasswordForm token={token} purpose={info.purpose} email={info.email} />;
}
```

```tsx
// src/app/(auth)/set-password/SetPasswordForm.tsx
"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { setPasswordAction } from "../actions";

export function SetPasswordForm({ token, purpose, email }: { token: string; purpose: "SET" | "RESET"; email: string }) {
  const [state, action] = useActionState(setPasswordAction, undefined);
  return (
    <form action={action} className="auth-card rv" noValidate>
      <h1 className="h1">{purpose === "SET" ? "Welcome to LN People" : "Choose a new password"}</h1>
      <p className="lede">For {email}. Use at least 10 characters.</p>
      <input type="hidden" name="token" value={token} />
      <label className="label" htmlFor="password">New password</label>
      <input className="field" id="password" name="password" type="password" autoComplete="new-password" required autoFocus />
      <label className="label" htmlFor="confirm">Type it again</label>
      <input className="field" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      {state?.error ? <p className="form-error">{state.error}</p> : null}
      <SubmitButton>Save and sign in</SubmitButton>
    </form>
  );
}
```

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Root() {
  redirect("/home");
}
```

- [ ] **Step 8: Run tests, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass; no type or lint errors.

- [ ] **Step 9: Commit**

```bash
git add src tests/proxy.test.ts
git commit -m "feat: add login, password reset screens and auth proxy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: App shell — sidebar, top bar, notifications and command menu

**Files:**
- Create: `src/server/shell.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/actions.ts`, `src/components/shell/Sidebar.tsx`, `src/components/shell/SearchTrigger.tsx`, `src/components/shell/ThemeToggle.tsx`, `src/components/shell/NotificationsBell.tsx`, `src/components/shell/CommandMenu.tsx`
- Test: `tests/server/shell.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `navFor`, `isActivePath`, `primaryRoleLabel`, `listNotifications`, `unreadCount`, `markAllRead`, `logoutAction`, `Icon`, `Avatar`, `ToastProvider`, `timeAgo`.
- Produces: `toggleTheme(origin?: { x: number; y: number }): void`; window event `"lnp:open-command"`; `markAllNotificationsReadAction(): Promise<void>`; `type BellItem = { id: string; title: string; link: string | null; ago: string; read: boolean }` (exported from `NotificationsBell.tsx`); `getShellView(userId: string, now?: Date): Promise<{ items: BellItem[]; unread: number }>`.

Components never call `new Date()` during render (Next's React lint flags impure calls); time-dependent text is prepared on the server.

- [ ] **Step 0: Write and pass a test for the shell data**

```ts
// tests/server/shell.test.ts
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
```

Run: `npx vitest run tests/server/shell.test.ts` — Expected: FAIL (cannot resolve `@/server/shell`). Then implement:

```ts
// src/server/shell.ts
import "server-only";
import { timeAgo } from "@/lib/time";
import type { BellItem } from "@/components/shell/NotificationsBell";
import { listNotifications, unreadCount } from "./notifications";

export async function getShellView(userId: string, now = new Date()): Promise<{ items: BellItem[]; unread: number }> {
  const [notes, unread] = await Promise.all([listNotifications(userId, 15), unreadCount(userId)]);
  return {
    unread,
    items: notes.map((n) => ({ id: n.id, title: n.title, link: n.link, ago: timeAgo(n.createdAt, now), read: n.readAt !== null })),
  };
}
```

(`BellItem` is a type-only import, so the client component module is not loaded on the server.) The test passes once Step 3 below creates `NotificationsBell.tsx`; run it again after Step 3.

- [ ] **Step 1: Write the theme toggle**

```tsx
// src/components/shell/ThemeToggle.tsx
"use client";
import { Icon } from "@/components/ui/Icon";

export function toggleTheme(origin?: { x: number; y: number }): void {
  const root = document.documentElement;
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  const apply = () => {
    root.dataset.theme = next;
    document.cookie = `lnp_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("startViewTransition" in document) || reduce) {
    apply();
    return;
  }
  const x = origin?.x ?? innerWidth - 80;
  const y = origin?.y ?? 40;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(apply).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(.2,.75,.2,1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Switch light or dark theme"
      onClick={(e) => toggleTheme(e.clientX ? { x: e.clientX, y: e.clientY } : undefined)}
    >
      <Icon name="moon" className="i ic-moon" />
      <Icon name="sun" className="i ic-sun" />
    </button>
  );
}
```

- [ ] **Step 2: Write the sidebar and search trigger**

```tsx
// src/components/shell/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { isActivePath, type NavLink } from "./nav";

export function Sidebar({ links, fullName, role }: { links: NavLink[]; fullName: string; role: string }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const move = () => {
      const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const pill = pillRef.current;
      if (!pill) return;
      if (!active) {
        pill.style.opacity = "0";
        return;
      }
      pill.style.opacity = "1";
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.height = `${active.offsetHeight}px`;
      pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [pathname]);

  return (
    <aside className="side" aria-label="Sidebar">
      <div className="brand"><span className="brand-mark">ln</span><span>LN People</span></div>
      <nav ref={navRef} className="nav" aria-label="Main">
        <span ref={pillRef} className="nav-pill" aria-hidden="true" />
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="nav-btn" aria-current={isActivePath(pathname, l.href) ? "page" : undefined}>
            <Icon name={l.icon} />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <p className="hint">Press <kbd>Ctrl K</kbd> to jump anywhere</p>
        <div className="me">
          <Avatar name={fullName} />
          <div>{fullName}<small>{role}</small></div>
        </div>
      </div>
    </aside>
  );
}
```

```tsx
// src/components/shell/SearchTrigger.tsx
"use client";
import { Icon } from "@/components/ui/Icon";

export function SearchTrigger() {
  return (
    <button type="button" className="search-trigger" aria-label="Open command menu" onClick={() => window.dispatchEvent(new Event("lnp:open-command"))}>
      <Icon name="search" />
      <span>Search pages and actions…</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
```

- [ ] **Step 3: Write the notifications action and bell**

```ts
// src/app/(app)/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { markAllRead } from "@/server/notifications";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markAllRead(user.userId);
  revalidatePath("/", "layout");
}
```

```tsx
// src/components/shell/NotificationsBell.tsx
"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { markAllNotificationsReadAction } from "@/app/(app)/actions";

export type BellItem = { id: string; title: string; link: string | null; ago: string; read: boolean };

export function NotificationsBell({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="bell-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls="notif-pop"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" />
        {unread > 0 ? <span className="dot-badge" /> : null}
      </button>
      <div id="notif-pop" className={`pop${open ? " open" : ""}`} role="dialog" aria-label="Notifications">
        <div className="pop-h">
          <span className="card-t">Notifications</span>
          {unread > 0 ? (
            <button type="button" className="link" disabled={pending} onClick={() => startTransition(() => markAllNotificationsReadAction())}>
              Mark all read
            </button>
          ) : null}
        </div>
        {items.length === 0 ? <p className="pop-empty">You're all caught up.</p> : null}
        {items.map((n) => {
          const body = (
            <>
              <span className="nt-ic"><Icon name="bell" /></span>
              <div>
                <p>{n.title}</p>
                <small>{n.ago}</small>
              </div>
            </>
          );
          const className = `nt${n.read ? "" : " unread"}`;
          return n.link ? (
            <Link key={n.id} href={n.link} className={className} onClick={() => setOpen(false)}>{body}</Link>
          ) : (
            <div key={n.id} className={className}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the command menu**

```tsx
// src/components/shell/CommandMenu.tsx
"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/icon-names";
import { logoutAction } from "@/app/(auth)/actions";
import type { NavLink } from "./nav";
import { toggleTheme } from "./ThemeToggle";

type Command = { group: string; label: string; icon: IconName; run: () => void };

export function CommandMenu({ links }: { links: NavLink[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const commands = useMemo<Command[]>(
    () => [
      ...links.map((l) => ({ group: "Go to", label: l.label, icon: l.icon, run: () => router.push(l.href) })),
      { group: "Actions", label: "Switch light / dark theme", icon: "moon", run: () => toggleTheme() },
      { group: "Actions", label: "Sign out", icon: "logout", run: () => void logoutAction() },
    ],
    [links, router],
  );
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));
  const active = Math.min(index, Math.max(0, filtered.length - 1));

  const show = useCallback(() => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setIndex(0);
    setOpen(true);
    requestAnimationFrame(() => {
      setVisible(true);
      inputRef.current?.focus();
    });
  }, []);
  const hide = useCallback(() => {
    setVisible(false);
    setTimeout(() => setOpen(false), 200);
    lastFocus.current?.focus?.({ preventScroll: true });
  }, []);
  const run = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    hide();
    c.run();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as HTMLElement | null)?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) hide();
        else show();
      } else if (e.key === "/" && !open && !typing) {
        e.preventDefault();
        show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener("lnp:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lnp:open-command", onOpen);
    };
  }, [open, show, hide]);

  if (!open) return null;
  return (
    <div className={`cmdk${visible ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Command menu">
      <div className="cmdk-bg" onClick={hide} />
      <div className="cmdk-panel">
        <div className="cmdk-in">
          <Icon name="search" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={filtered.length ? `cmd-${active}` : undefined}
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((active + 1) % Math.max(1, filtered.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((active - 1 + filtered.length) % Math.max(1, filtered.length));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(active);
              } else if (e.key === "Escape") {
                e.preventDefault();
                hide();
              } else if (e.key === "Tab") {
                e.preventDefault();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox">
          {filtered.length === 0 ? <li className="cmdk-empty">Nothing found for “{query}”</li> : null}
          {filtered.map((c, i) => {
            const header = i === 0 || filtered[i - 1].group !== c.group ? c.group : null;
            return (
              <li key={`${c.group}-${c.label}`} role="presentation">
                {header ? <div className="cmdk-g">{header}</div> : null}
                <div
                  id={`cmd-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className="cmdk-it"
                  onPointerMove={() => setIndex(i)}
                  onClick={() => run(i)}
                >
                  <Icon name={c.icon} />
                  <span>{c.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>/</kbd> also opens this</span></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write the app layout**

```tsx
// src/app/(app)/layout.tsx
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toaster";
import { CommandMenu } from "@/components/shell/CommandMenu";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { SearchTrigger } from "@/components/shell/SearchTrigger";
import { Sidebar } from "@/components/shell/Sidebar";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { navFor } from "@/components/shell/nav";
import { primaryRoleLabel } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { getShellView } from "@/server/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { items, unread } = await getShellView(user.userId);
  const links = navFor(user);

  return (
    <ToastProvider>
      <div className="app">
        <Sidebar links={links} fullName={user.fullName} role={primaryRoleLabel(user)} />
        <div className="main">
          <header className="top">
            <SearchTrigger />
            <div className="top-actions">
              <ThemeToggle />
              <NotificationsBell items={items} unread={unread} />
              <Avatar name={user.fullName} />
            </div>
          </header>
          {children}
        </div>
      </div>
      <CommandMenu links={links} />
    </ToastProvider>
  );
}
```

- [ ] **Step 6: Run the shell test, typecheck and lint**

Run: `npx vitest run tests/server/shell.test.ts && npm run typecheck && npm run lint`
Expected: test PASS; typecheck and lint clean.

- [ ] **Step 7: Commit**

```bash
git add src tests/server/shell.test.ts
git commit -m "feat: add app shell with sidebar, notifications and command menu" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Pages — home, profile and settings

**Files:**
- Create: `src/server/profile.ts`, `src/server/home.ts`, `src/app/(app)/home/page.tsx`, `src/app/(app)/profile/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/actions.ts`, `src/components/settings/SettingRow.tsx`
- Test: `tests/server/profile.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `listNotifications`, `getSettings`, `updateSetting`, `can`, `SETTING_META`, `SETTING_KEYS`, `isSettingKey`, `parseSettingInput`, `greetingFor`, `longDateIST`, `timeAgo`, `formatIsoDate`, `WordReveal`, `Avatar`, `useToast`, `logoutAction`, `logoutEverywhereAction`.
- Produces: `getMyProfile(userId: string): Promise<{ fullName; email; code; designation; department: string | null; managerName: string | null; joinedOn: string } | null>`; `getHomeView(user: CurrentUser, now?: Date): Promise<{ dateLabel: string; heading: string; notes: { id: string; title: string; ago: string }[] }>`; `updateSettingAction(prev: SettingFormState, formData: FormData): Promise<SettingFormState>`; `type SettingFormState = { error?: string; savedAt?: number } | undefined`.

- [ ] **Step 1: Write the failing profile and home tests**

```ts
// tests/server/profile.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getMyProfile } from "@/server/profile";
import { getHomeView } from "@/server/home";
import { loadCurrentUser } from "@/server/auth/users";
import { makeEmployee, resetDb } from "../helpers/db";

describe("getHomeView", () => {
  beforeEach(resetDb);

  it("greets by first name in IST and lists the latest notifications", async () => {
    const { user } = await makeEmployee({ name: "Arjun Mehta" });
    await db.notification.create({ data: { userId: user.id, kind: "k", title: "Hello", createdAt: new Date("2026-10-28T03:18:00Z") } });
    const view = await getHomeView((await loadCurrentUser(user.id))!, new Date("2026-10-28T03:30:00Z"));
    expect(view).toEqual({
      dateLabel: "Wednesday 28 October",
      heading: "Good morning, Arjun.",
      notes: [{ id: expect.any(String), title: "Hello", ago: "12 min ago" }],
    });
  });
});

describe("getMyProfile", () => {
  beforeEach(resetDb);

  it("returns job details with manager and department names", async () => {
    const dept = await db.department.create({ data: { name: "Engineering" } });
    const boss = await makeEmployee({ name: "Ananya Sharma" });
    const { user, employee } = await makeEmployee({ name: "Arjun Mehta", managerId: boss.employee.id });
    await db.employee.update({ where: { id: employee.id }, data: { departmentId: dept.id, designation: "Senior Developer" } });
    expect(await getMyProfile(user.id)).toMatchObject({
      fullName: "Arjun Mehta",
      designation: "Senior Developer",
      department: "Engineering",
      managerName: "Ananya Sharma",
      joinedOn: "2025-01-01",
    });
  });

  it("returns null for an unknown user", async () => {
    expect(await getMyProfile("missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/profile.test.ts`
Expected: FAIL — cannot resolve `@/server/profile`.

- [ ] **Step 3: Implement the profile and home queries**

```ts
// src/server/home.ts
import "server-only";
import type { CurrentUser } from "@/domain/auth/types";
import { greetingFor, longDateIST, timeAgo } from "@/lib/time";
import { listNotifications } from "./notifications";

export async function getHomeView(user: CurrentUser, now = new Date()) {
  const notes = await listNotifications(user.userId, 5);
  return {
    dateLabel: longDateIST(now),
    heading: `${greetingFor(now)}, ${user.fullName.split(" ")[0]}.`,
    notes: notes.map((n) => ({ id: n.id, title: n.title, ago: timeAgo(n.createdAt, now) })),
  };
}
```

```ts
// src/server/profile.ts
import "server-only";
import { db } from "@/lib/db";

export async function getMyProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { employee: { include: { department: true, manager: true } } },
  });
  if (!user) return null;
  const e = user.employee;
  return {
    fullName: e.fullName,
    email: user.email,
    code: e.code,
    designation: e.designation,
    department: e.department?.name ?? null,
    managerName: e.manager?.fullName ?? null,
    joinedOn: e.joinedOn,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/profile.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the home page**

```tsx
// src/app/(app)/home/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { WordReveal } from "@/components/ui/WordReveal";
import { primaryRoleLabel } from "@/domain/auth/permissions";
import { requireUser } from "@/server/auth/current-user";
import { getHomeView } from "@/server/home";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const { dateLabel, heading, notes } = await getHomeView(user);

  return (
    <main className="page" aria-label="Home">
      <header className="ph">
        <div className="rv" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="eyebrow">{dateLabel}</div>
          <WordReveal text={heading} accentLast />
          <p className="lede">Welcome to LN People. Attendance, time off and your team will show up here as they go live.</p>
        </div>
      </header>
      <section className="grid">
        <div className="card s8 rv" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Latest for you</span><span className="card-a">{notes.length ? `${notes.length} recent` : ""}</span></div>
          {notes.length === 0 ? <p className="muted">Nothing new right now.</p> : null}
          {notes.map((n) => (
            <div className="row" key={n.id}>
              <span className="nt-ic"><Icon name="bell" /></span>
              <div>
                <div className="t">{n.title}</div>
                <div className="s">{n.ago}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card s4 spot rv" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Your account</span><span className="pill">{primaryRoleLabel(user)}</span></div>
          <p className="muted">Signed in as {user.email}.</p>
          <p style={{ marginTop: 16 }}><Link className="link" href="/profile">View your profile</Link></p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Write the profile page**

```tsx
// src/app/(app)/profile/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { WordReveal } from "@/components/ui/WordReveal";
import { primaryRoleLabel } from "@/domain/auth/permissions";
import { formatIsoDate } from "@/lib/time";
import { logoutAction, logoutEverywhereAction } from "@/app/(auth)/actions";
import { requireUser } from "@/server/auth/current-user";
import { getMyProfile } from "@/server/profile";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getMyProfile(user.userId);
  if (!profile) notFound();
  const rows: [string, string][] = [
    ["Employee code", profile.code],
    ["Work email", profile.email],
    ["Designation", profile.designation],
    ["Department", profile.department ?? "—"],
    ["Reports to", profile.managerName ?? "—"],
    ["Joined", formatIsoDate(profile.joinedOn)],
  ];

  return (
    <main className="page" aria-label="My profile">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">{primaryRoleLabel(user)}</div>
          <WordReveal text={profile.fullName} />
        </div>
      </header>
      <section className="grid">
        <div className="card s8 rv" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Job details</span><Avatar name={profile.fullName} size="lg" /></div>
          {rows.map(([label, value]) => (
            <div className="row" key={label}>
              <div className="s" style={{ width: 140 }}>{label}</div>
              <div className="t">{value}</div>
            </div>
          ))}
        </div>
        <div className="card s4 rv" style={{ "--i": 2 } as React.CSSProperties}>
          <div className="card-h"><span className="card-t">Security</span></div>
          <p className="muted">Signed in on a shared computer? Sign out everywhere to end every session, including this one.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <form action={logoutAction}><button type="submit" className="btn btn-ghost">Sign out</button></form>
            <form action={logoutEverywhereAction}><button type="submit" className="btn btn-ghost">Sign out everywhere</button></form>
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Write the settings action, row component and page**

```ts
// src/app/(app)/settings/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { isSettingKey, parseSettingInput } from "@/domain/settings/settings";
import { requireUser } from "@/server/auth/current-user";
import { updateSetting } from "@/server/settings";

export type SettingFormState = { error?: string; savedAt?: number } | undefined;

export async function updateSettingAction(_prev: SettingFormState, formData: FormData): Promise<SettingFormState> {
  const user = await requireUser();
  const key = String(formData.get("key") ?? "");
  if (!isSettingKey(key)) return { error: "Unknown setting." };
  const result = await updateSetting(user, key, parseSettingInput(key, formData.getAll("value").map(String)));
  if (!result.ok) return { error: result.error };
  revalidatePath("/settings");
  return { savedAt: Date.now() };
}
```

```tsx
// src/components/settings/SettingRow.tsx
"use client";
import { useActionState, useEffect } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toaster";
import type { SettingInputKind } from "@/domain/settings/settings";
import { updateSettingAction } from "@/app/(app)/settings/actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingRow({ settingKey, label, help, kind, value }: { settingKey: string; label: string; help: string; kind: SettingInputKind; value: unknown }) {
  const [state, action] = useActionState(updateSettingAction, undefined);
  const toast = useToast();
  useEffect(() => {
    if (state?.savedAt) toast(`${label} saved`);
  }, [state?.savedAt, label, toast]);

  const id = `setting-${settingKey}`;
  return (
    <form action={action} className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
      <input type="hidden" name="key" value={settingKey} />
      <div style={{ flex: "1 1 260px" }}>
        <label className="t" htmlFor={id}>{label}</label>
        <p className="help">{help}</p>
        {state?.error ? <p className="form-error">{state.error}</p> : null}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "1 1 280px", justifyContent: "flex-end", flexWrap: "wrap" }}>
        {kind === "weekdays" ? (
          <fieldset id={id} style={{ border: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <legend className="sr">{label}</legend>
            {DAYS.map((d, i) => (
              <label key={d} className="pill" style={{ display: "inline-flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" name="value" value={i} defaultChecked={(value as number[]).includes(i)} /> {d}
              </label>
            ))}
          </fieldset>
        ) : (
          <input
            id={id}
            className="field"
            style={{ maxWidth: 220 }}
            name="value"
            type={kind === "text" || kind === "readonly" ? "text" : "number"}
            defaultValue={value === null ? "" : String(value)}
            readOnly={kind === "readonly"}
            aria-readonly={kind === "readonly"}
          />
        )}
        {kind === "readonly" ? null : <SubmitButton className="btn btn-ghost" label={`Save ${label}`}>Save</SubmitButton>}
      </div>
    </form>
  );
}
```

```tsx
// src/app/(app)/settings/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingRow } from "@/components/settings/SettingRow";
import { WordReveal } from "@/components/ui/WordReveal";
import { can } from "@/domain/auth/permissions";
import { SETTING_KEYS, SETTING_META } from "@/domain/settings/settings";
import { requireUser } from "@/server/auth/current-user";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, "settings.manage")) notFound();
  const settings = await getSettings();
  return (
    <main className="page" aria-label="Settings">
      <header className="ph">
        <div className="rv">
          <div className="eyebrow">Admin</div>
          <WordReveal text="Settings" />
          <p className="lede">Company-wide rules. Every change is recorded in the audit log.</p>
        </div>
      </header>
      <section className="card rv" style={{ "--i": 1 } as React.CSSProperties}>
        {SETTING_KEYS.map((key) => (
          <SettingRow key={key} settingKey={key} label={SETTING_META[key].label} help={SETTING_META[key].help} kind={SETTING_META[key].kind} value={settings[key]} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 8: Run tests, typecheck, lint and build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: everything passes; the build route table lists `/home`, `/profile`, `/settings`, `/login`, `/forgot-password`, `/set-password`.

- [ ] **Step 9: Commit**

```bash
git add src tests/server/profile.test.ts
git commit -m "feat: add home, profile and admin settings pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Seed data

**Files:**
- Create: `prisma/seed/data.ts`, `prisma/seed/seed.ts`, `prisma/seed/run.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: `clearAll`, `PrismaClient`, `@node-rs/argon2`.
- Produces: `DEMO_PASSWORD`, `DEMO_LOGINS`, `PEOPLE: SeedPerson[]`, `APPROVAL_POLICIES`, `emailFor(p)`, `joinedOnFor(i)`, `seed(db: PrismaClient): Promise<{ employees: number }>`; `npm run db:seed`.

- [ ] **Step 1: Write the seed data**

```ts
// prisma/seed/data.ts
export type SeedPerson = {
  name: string;
  designation: string;
  dept: string;
  manager: string | null;
  email?: string;
  isHR?: boolean;
  isPayroll?: boolean;
  isAdmin?: boolean;
  status?: "ACTIVE" | "NOTICE";
};

export const DEMO_PASSWORD = "Password@123";

export const DEPARTMENTS = ["Leadership", "Engineering", "Design", "QA", "Sales", "People"] as const;

export const PEOPLE: SeedPerson[] = [
  { name: "Vikas Malhotra", designation: "Chief Executive Officer", dept: "Leadership", manager: null, email: "admin@lnwebworks.test", isAdmin: true },
  // Engineering
  { name: "Ananya Sharma", designation: "Engineering Manager", dept: "Engineering", manager: "Vikas Malhotra", email: "manager@lnwebworks.test" },
  { name: "Rahul Verma", designation: "Engineering Manager", dept: "Engineering", manager: "Vikas Malhotra" },
  { name: "Arjun Mehta", designation: "Senior Developer", dept: "Engineering", manager: "Ananya Sharma", email: "employee@lnwebworks.test" },
  { name: "Karan Joshi", designation: "Drupal Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Simran Kaur", designation: "Frontend Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Vikram Rathore", designation: "DevOps Engineer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Aditya Singh", designation: "Backend Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Manish Gupta", designation: "Drupal Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Sneha Reddy", designation: "Frontend Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Rohan Das", designation: "Full Stack Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Kavya Iyer", designation: "Software Engineer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Nikhil Bhatia", designation: "Software Engineer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Tanvi Shah", designation: "Associate Developer", dept: "Engineering", manager: "Ananya Sharma" },
  { name: "Harpreet Gill", designation: "Senior Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Gaurav Saini", designation: "Drupal Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Deepak Yadav", designation: "Backend Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Shreya Kapoor", designation: "Frontend Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Amit Chauhan", designation: "Mobile Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Pallavi Jain", designation: "Software Engineer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Saurabh Mishra", designation: "Full Stack Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Jaspreet Sandhu", designation: "Drupal Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Varun Thakur", designation: "Associate Developer", dept: "Engineering", manager: "Rahul Verma" },
  { name: "Ritika Bose", designation: "Software Engineer", dept: "Engineering", manager: "Rahul Verma" },
  // Design
  { name: "Ishita Gupta", designation: "Design Lead", dept: "Design", manager: "Vikas Malhotra" },
  { name: "Riya Kapoor", designation: "UI Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Mehak Arora", designation: "Product Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Kunal Sethi", designation: "UX Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Divya Nair", designation: "Visual Designer", dept: "Design", manager: "Ishita Gupta" },
  { name: "Abhinav Rao", designation: "Motion Designer", dept: "Design", manager: "Ishita Gupta" },
  // QA
  { name: "Priya Singh", designation: "QA Lead", dept: "QA", manager: "Vikas Malhotra" },
  { name: "Aman Thakur", designation: "QA Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Neeraj Kumar", designation: "Automation Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Swati Pandey", designation: "QA Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Rajat Sharma", designation: "QA Engineer", dept: "QA", manager: "Priya Singh" },
  { name: "Komal Bajwa", designation: "QA Analyst", dept: "QA", manager: "Priya Singh" },
  { name: "Yash Agarwal", designation: "Automation Engineer", dept: "QA", manager: "Priya Singh" },
  // Sales
  { name: "Meera Nair", designation: "Sales Lead", dept: "Sales", manager: "Vikas Malhotra" },
  { name: "Rohit Bansal", designation: "Business Analyst", dept: "Sales", manager: "Meera Nair" },
  { name: "Ankit Tiwari", designation: "Business Development Executive", dept: "Sales", manager: "Meera Nair" },
  { name: "Sakshi Dhillon", designation: "Account Manager", dept: "Sales", manager: "Meera Nair" },
  { name: "Mohit Khurana", designation: "Business Development Executive", dept: "Sales", manager: "Meera Nair", status: "NOTICE" },
  // People
  { name: "Neha Verma", designation: "HR Generalist", dept: "People", manager: "Vikas Malhotra", email: "hr@lnwebworks.test", isHR: true },
  { name: "Pooja Arora", designation: "Payroll Executive", dept: "People", manager: "Neha Verma", email: "payroll@lnwebworks.test", isPayroll: true },
  { name: "Sonia Grewal", designation: "HR Executive", dept: "People", manager: "Neha Verma", isHR: true },
  { name: "Tarun Batra", designation: "IT Administrator", dept: "People", manager: "Neha Verma" },
  { name: "Lakshmi Menon", designation: "Office Administrator", dept: "People", manager: "Neha Verma" },
  { name: "Ravi Prakash", designation: "Recruiter", dept: "People", manager: "Neha Verma" },
];

export const DEMO_LOGINS = PEOPLE.filter((p) => p.email).map((p) => ({ email: p.email!, name: p.name }));

export const APPROVAL_POLICIES: Record<string, ("MANAGER" | "HR")[]> = {
  LEAVE: ["MANAGER", "HR"],
  WFH: ["MANAGER", "HR"],
  ATTENDANCE_CORRECTION: ["MANAGER"],
  TIMESHEET_WEEK: ["MANAGER"],
  RESIGNATION: ["MANAGER", "HR"],
  GOAL_SET: ["MANAGER"],
};
```

- [ ] **Step 2: Write the failing seed test**

```ts
// tests/seed.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/server/auth/login";
import { DEMO_LOGINS, DEMO_PASSWORD, PEOPLE } from "../prisma/seed/data";
import { seed } from "../prisma/seed/seed";

describe("seed", () => {
  beforeAll(async () => {
    await seed(db);
  }, 60_000);

  it("creates 48 employees with unique codes and lowercase emails", async () => {
    expect(PEOPLE).toHaveLength(48);
    const employees = await db.employee.findMany();
    expect(employees).toHaveLength(48);
    expect(new Set(employees.map((e) => e.code)).size).toBe(48);
    for (const e of employees) expect(e.workEmail).toBe(e.workEmail.toLowerCase());
  });

  it("links every manager and has exactly one person without a manager", async () => {
    const employees = await db.employee.findMany();
    expect(employees.filter((e) => e.managerId === null).map((e) => e.fullName)).toEqual(["Vikas Malhotra"]);
    const ids = new Set(employees.map((e) => e.id));
    for (const e of employees) if (e.managerId) expect(ids.has(e.managerId)).toBe(true);
  });

  it("lets every demo login sign in", async () => {
    for (const login of DEMO_LOGINS) {
      expect((await authenticate(login.email, DEMO_PASSWORD)).ok).toBe(true);
    }
  });

  it("seeds all approval policies and is safe to run twice", async () => {
    expect(await db.approvalPolicy.count()).toBe(6);
    await seed(db);
    expect(await db.employee.count()).toBe(48);
  }, 60_000);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/seed.test.ts`
Expected: FAIL — cannot resolve `../prisma/seed/seed`.

- [ ] **Step 4: Implement the seed**

```ts
// prisma/seed/seed.ts
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "@/generated/prisma/client";
import { clearAll } from "./clear";
import { APPROVAL_POLICIES, DEMO_PASSWORD, DEPARTMENTS, PEOPLE, type SeedPerson } from "./data";

export function emailFor(p: SeedPerson): string {
  if (p.email) return p.email.toLowerCase();
  return `${p.name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@lnwebworks.test`;
}

export function joinedOnFor(index: number): string {
  return new Date(Date.UTC(2020, 3, 1) + index * 37 * 86_400_000).toISOString().slice(0, 10);
}

export async function seed(db: PrismaClient): Promise<{ employees: number }> {
  await clearAll(db);
  const passwordHash = await hash(DEMO_PASSWORD);

  const deptIds = new Map<string, string>();
  for (const name of DEPARTMENTS) deptIds.set(name, (await db.department.create({ data: { name } })).id);

  const empIds = new Map<string, string>();
  for (const [i, p] of PEOPLE.entries()) {
    const email = emailFor(p);
    const deptId = deptIds.get(p.dept);
    if (!deptId) throw new Error(`Unknown department "${p.dept}" for ${p.name}`);
    const e = await db.employee.create({
      data: {
        code: `LNW-${String(i + 1).padStart(4, "0")}`,
        fullName: p.name,
        workEmail: email,
        designation: p.designation,
        status: p.status ?? "ACTIVE",
        joinedOn: joinedOnFor(i),
        departmentId: deptId,
      },
    });
    empIds.set(p.name, e.id);
    await db.user.create({ data: { email, passwordHash, employeeId: e.id, isHR: !!p.isHR, isPayroll: !!p.isPayroll, isAdmin: !!p.isAdmin } });
  }

  for (const p of PEOPLE) {
    if (!p.manager) continue;
    const managerId = empIds.get(p.manager);
    if (!managerId) throw new Error(`Unknown manager "${p.manager}" for ${p.name}`);
    await db.employee.update({ where: { id: empIds.get(p.name)! }, data: { managerId } });
  }

  for (const [type, steps] of Object.entries(APPROVAL_POLICIES)) {
    await db.approvalPolicy.create({ data: { type, steps: JSON.stringify(steps) } });
  }

  const arjun = await db.user.findUniqueOrThrow({ where: { email: "employee@lnwebworks.test" } });
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
  await db.notification.createMany({
    data: [
      { userId: arjun.id, kind: "welcome", title: "Welcome to LN People — your HR, all in one place", link: "/home", createdAt: minutesAgo(12) },
      { userId: arjun.id, kind: "kudos", title: "Rohit gave you kudos for the client call", link: "/home", createdAt: minutesAgo(65) },
      { userId: arjun.id, kind: "announcement", title: "Diwali celebration · Fri 6 Nov, 4 pm", createdAt: minutesAgo(60 * 26), readAt: minutesAgo(60 * 20) },
    ],
  });

  return { employees: PEOPLE.length };
}
```

```ts
// prisma/seed/run.ts
import "dotenv/config";
import { db } from "../../src/lib/db";
import { DEMO_LOGINS, DEMO_PASSWORD } from "./data";
import { seed } from "./seed";

async function main(): Promise<void> {
  const { employees } = await seed(db);
  console.info(`Seeded ${employees} employees.\n\nDemo logins (password ${DEMO_PASSWORD}):`);
  for (const l of DEMO_LOGINS) console.info(`  ${l.email.padEnd(28)} ${l.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 5: Run the test and seed the dev database**

Run: `npx vitest run tests/seed.test.ts`
Expected: PASS.

Run: `npm run db:seed`
Expected: `Seeded 48 employees.` followed by five demo logins (admin, manager, employee, hr, payroll).

- [ ] **Step 6: Commit**

```bash
git add prisma/seed tests/seed.test.ts
git commit -m "feat: seed LN Webworks demo company with 48 employees" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: End-to-end smoke tests and final verification

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/prepare-db.ts`, `tests/e2e/auth.spec.ts`
- Modify: `README.md` (create)

**Interfaces:**
- Consumes: `applyMigrations`, `seed`, seeded demo logins, the whole app.
- Produces: `npm run test:e2e`.

- [ ] **Step 1: Write the Playwright config and DB preparation**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: "file:./e2e.db" },
  },
});
```

```ts
// tests/e2e/prepare-db.ts
import { applyMigrations } from "../../prisma/apply-migrations";

async function main(): Promise<void> {
  process.env.DATABASE_URL = "file:./e2e.db";
  applyMigrations("./e2e.db");
  const { db } = await import("../../src/lib/db");
  const { seed } = await import("../../prisma/seed/seed");
  await seed(db);
  await db.$disconnect();
  console.info("E2E database ready.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Write the E2E specs**

```ts
// tests/e2e/auth.spec.ts
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "Password@123";

async function signIn(page: Page, email: string, path = "/login"): Promise<void> {
  await page.goto(path);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});

test("employee signs in, uses the command menu and signs out", async ({ page }) => {
  await signIn(page, "employee@lnwebworks.test");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Arjun");
  await expect(page.getByRole("button", { name: /Notifications, 2 unread/ })).toBeVisible();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("profile");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Ananya Sharma")).toBeVisible();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});

test("returns people to the page they asked for, but never off-site", async ({ page }) => {
  await signIn(page, "manager@lnwebworks.test", "/login?next=%2Fprofile");
  await expect(page).toHaveURL(/\/profile$/);
  await page.context().clearCookies();
  await signIn(page, "manager@lnwebworks.test", "/login?next=%2F%2Fevil.example");
  await expect(page).toHaveURL(/localhost:3100\/home$/);
});

test("wrong passwords show an error and five failures lock the account", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Work email").fill("payroll@lnwebworks.test");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".form-error")).toHaveText("That email and password don't match.");
  }
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".form-error")).toHaveText("Too many attempts. Try again in 15 minutes.");
});

test("only admins can open settings, and changes save", async ({ page }) => {
  await signIn(page, "admin@lnwebworks.test");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Settings");
  await page.getByLabel("Company name").fill("LN Webworks Pvt Ltd");
  await page.getByRole("button", { name: "Save Company name" }).click();
  await expect(page.getByText("Company name saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Company name")).toHaveValue("LN Webworks Pvt Ltd");

  await page.context().clearCookies();
  await signIn(page, "employee@lnwebworks.test");
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("theme choice survives a reload", async ({ page }) => {
  await signIn(page, "hr@lnwebworks.test");
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
```

- [ ] **Step 3: Install the browser and run the E2E suite**

Run: `npx playwright install chromium`
Expected: Chromium downloaded (or "already installed").

Run: `npm run test:e2e`
Expected: "E2E database ready.", a successful build, then `6 passed`.

- [ ] **Step 4: Write the README**

```markdown
# LN People

LN Webworks' internal HR system. Design spec: `docs/superpowers/specs/2026-10-28-ln-people-hrms-design.md`.

## Run it locally

1. `npm install`
2. `cp .env.example .env`
3. `npx prisma migrate dev` — creates `dev.db`
4. `npm run db:seed` — builds the demo company (48 employees)
5. `npm run dev` and open http://localhost:3000

Demo logins (password `Password@123`): `admin@`, `hr@`, `payroll@`, `manager@`, `employee@` — all `@lnwebworks.test`.
Password emails are printed to the terminal in development.

## Checks

- `npm test` — unit and integration tests (uses a throwaway `test.db`)
- `npm run test:e2e` — Playwright smoke tests (uses `e2e.db`)
- `npm run typecheck`, `npm run lint`
```

- [ ] **Step 5: Final verification**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all green.

Manual check: `npm run dev`, sign in as `employee@lnwebworks.test`, confirm the greeting animates, the sidebar pill slides when moving between Home and My profile, Ctrl K opens the menu, the bell shows two unread, dark mode reveals in a circle, and the custom cursor ring grows over buttons.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e README.md
git commit -m "test: add end-to-end smoke tests and README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
