# LN People

LN Webworks' internal HR system. Design spec: `docs/superpowers/specs/2026-10-28-ln-people-hrms-design.md`.

## Run it locally

1. `npm install`
2. `cp .env.example .env`
3. `npx prisma migrate dev` — creates `dev.db`
4. `npm run db:seed` — builds the demo company (48 employees)
5. `npm run dev` and open http://localhost:3000

Demo logins (password `Password@123`): `admin@`, `hr@`, `payroll@`, `manager@`, `employee@` — all `@lnwebworks.test`.

## Email

Password emails are printed to the terminal in development (`npm run dev`). A production build (`npm start`) refuses to send mail until a real transport is configured, so password links never end up in server logs. To try "Forgot password" on a production build locally, set `MAIL_TRANSPORT=console` in `.env`.

## Nightly job

`npm run jobs:close-day` closes yesterday's attendance: it flags missed check-outs and absences and notifies the people concerned. It is safe to run more than once. Schedule it daily at 00:30 IST (on Windows: Task Scheduler → Create Basic Task → Daily 00:30 → Start a program `npm` with arguments `run jobs:close-day` and "Start in" set to this folder). Admins can also run it from **Settings → Scheduled jobs**.

## Checks

- `npm test` — unit and integration tests (uses a throwaway `test.db`)
- `npm run test:e2e` — Playwright smoke tests (uses `e2e.db`; run `npx playwright install chromium` once first)
- `npm run typecheck`, `npm run lint`
