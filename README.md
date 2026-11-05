# Paceline

**Every hour, in formation.** Timeboxing, priorities and honest forecasts for people who build things.
Paceline ranks your work, fits it into your real working hours around meetings and lunch, and tells you
when each task and project will actually finish.

Built from the _Paceline — Web App Design_ canvas: identity, six colour themes, the component library
(L.01–L.08) and the screens (Login, Today, Week, Board, Insights, Mobile).

## Stack

| Layer    | Choice                                                             |
| -------- | ------------------------------------------------------------------ |
| App      | SvelteKit 3 · Svelte 5 runes (`$state`, `$derived`, `$props`)      |
| Language | TypeScript, `strict`                                               |
| Styling  | Tailwind CSS v4 — the L.01 `@theme` block in `src/app.css`         |
| Data     | Local-first: each account's plan lives in its own browser storage  |
| Tests    | Vitest for the domain logic (`parse`, `plan`, `forecast`, `stats`) |
| CI       | GitHub Actions: lint → type check → tests → build on every push    |

## Features

- **Login system**: sign up with a password-strength meter, 6-digit email verification, a 2-step check on
  new devices, "trust this device for 30 days", password reset, and a lockout after 5 wrong tries.
  Passwords are hashed with PBKDF2 (WebCrypto) and never stored in plain text.
- **Smart capture**: `Draft report !2 #deep @fri 90m +Test_Fixture ~weekly ^asap`, plus `qw …` for quick wins and
  `mtg … 10:00-10:30` for meetings, with live parse chips.
- **Auto-scheduler** (`src/lib/domain/plan.ts`): places work by score into free time, after dependencies, never
  before a start date, keeping a buffer free. Admin and Comms prefer afternoons. Reserved time
  (Settings) is kept for one category, and blocks dragged on Today or Week stay where they're dropped.
- **Today**: the lead block with a Pomodoro ring, schedule, must-dos 1–3 (4–5 unlock afterwards), quick wins and
  alerts.
- **Week** time grid (drag a block to move it, double-click to pin or release it), **Board** with WIP limit and drag & drop, **Table** with
  sorting, grouping, inline edit and bulk actions, **Timeline** Gantt with dependency arrows, **Calendar** with
  drag-to-reschedule, **Projects** with health, **Goals** with pace against a straight line, and **Insights**
  with this week against last, 14 days of focus, the week ahead and where the time went.
- Task drawer via a shareable `?task=T-014` URL, a command palette (`⌘K` / `Ctrl K`), a focus overlay, undo on
  every change (`⌘Z`) and keyboard navigation (`G` then `T/I/W/A/B/L/C/P/O/S`).
- **Six themes** (Carbon, Chalk, Midnight, Frost, Ember, Sand) plus Match system, with no flash on load.
- Responsive down to phones: an off-canvas sidebar and bottom tabs below 860 px. Installable through a web manifest.

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>, create an account and pick **Example plan** to see every view populated.

| Script           | What it does                    |
| ---------------- | ------------------------------- |
| `npm run dev`    | Dev server with hot reload      |
| `npm test`       | Unit tests (Vitest, single run) |
| `npm run check`  | `svelte-check` type check       |
| `npm run lint`   | Prettier check + ESLint         |
| `npm run format` | Prettier write                  |
| `npm run build`  | Production build                |

**Time travel (dev only):** append `?now=2026-10-28T10:19` to any URL to see the app at that moment.
It's kept for the browser tab; `?now=real` goes back to the real time.

## Working in WebStorm

1. **Open**: _File ▸ Open…_ and pick the `paceline` folder, or clone it with _Get from VCS_ on the Welcome screen.
   WebStorm offers to run `npm install` from the banner; accept it.
2. **Run configurations** are shared in `.run/`, so they appear in the run widget at the top right:
   _Dev server_, _Unit tests_, _Type check_, _Lint_ and _Build_. Pick _Dev server_ and press ▶ (`⌃R`).
3. **Svelte support**: _Settings ▸ Plugins_, then install **Svelte** (by JetBrains) if it isn't already. Tailwind
   class completion works out of the box with the bundled Tailwind CSS plugin, which reads `src/app.css`.
4. **Formatting**: _Settings ▸ Languages & Frameworks ▸ JavaScript ▸ Prettier_, then choose **Automatic Prettier
   configuration** and tick **Run on save**. ESLint: _…▸ Code Quality Tools ▸ ESLint_, then **Automatic ESLint
   configuration**.
5. **Tests**: open `src/lib/domain/domain.spec.ts` and click the gutter ▶ next to any `describe` or `it`.
6. **Git**: the _Commit_ tool window (`⌘0`) shows changes, and _Git ▸ Push_ (`⇧⌘K`) sends them to GitHub.

## Project layout

```
src/
  app.css                 L.01 six themes + Tailwind @theme
  app.html                fonts, theme set before first paint
  lib/
    types.ts              Task, Project, Meeting, Goal, Settings, Plan…
    domain/               pure logic, unit tested
      dates.ts parse.ts plan.ts forecast.ts stats.ts seed.ts
    stores/               Svelte 5 rune stores
      auth workspace clock focus theme filters toast ui
    ui/                   L.02–L.03 primitives (Button, Badge, Modal, Drawer…)
    shell/                L.04 AppShell, Sidebar, TopBar, CommandPalette…
    task/                 L.05–L.06 CaptureBar, TaskDrawer, NowCard, modals…
    plan/                 L.07 WeekGrid
    auth/                 L.05 login system screens
  routes/
    (auth)/login signup reset
    (app)/today inbox week table board timeline calendar
          projects projects/[id] goals insights settings onboarding
```

## Architecture (production)

```
browser ──https──▶ paceline (Worker, SvelteKit)      paceline.krxnkos.xyz, custom domain
                     │ /api/* : auth, sessions, workspace sync
                     ▼  Durable Object RPC (private, no public route)
                   paceline-db (Worker + Durable Object) ──TLS──▶ MongoDB Atlas
                     keeps one MongoDB connection warm
```

- **Accounts**: email + password (PBKDF2-SHA256 with a secret pepper), 6-digit email codes for new accounts and
  new devices, reset links, 5-try lockout, rate limits, sign-up allowlist. Sessions are httpOnly `__Host-` cookies;
  only a SHA-256 of the token is stored.
- **Data**: one versioned document per person in the `workspaces` collection. The app keeps an offline copy and
  syncs when the connection returns; if another device saved first, its copy wins.
- **Email**: Resend, from `no-reply@krxnkos.xyz`.

## Deploy to paceline.krxnkos.xyz

One-time setup (each secret command prompts for the value; nothing is stored in the repo):

```bash
npx wrangler login
npm run deploy:db
npx wrangler secret put MONGODB_URI --config workers/db/wrangler.jsonc
npm run deploy
openssl rand -base64 48 | npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SIGNUP_ALLOWLIST
```

After that, `npm run deploy` ships a new version and `npm run tail` streams live logs. In MongoDB Atlas, allow
network access from `0.0.0.0/0` (Workers have no fixed IP) and use a database user with a long generated password,
scoped to the `paceline` database.

`PASSWORD_PEPPER` must never change once accounts exist: every password hash depends on it.

## Usernames

After verifying their email, each person chooses a username before entering the app (existing accounts are asked
at their next visit). It can't be changed. The rules, reserved names and offensive-word checks are in
`src/lib/server/username.ts`, and uniqueness comes from the `usernames` collection.

## Plans, badges and the developer console

Every account shows one tier badge (Free, Pro or Ultimate) and, optionally, a Developer badge; both appear at
sign-in and in the sidebar. There's no billing yet. Limits live in `src/lib/tiers.ts`.

Give the first Developer the badge in MongoDB Atlas (_Browse Collections ▸ paceline ▸ users_): add `developer: true`
to the account, then reload. Developers then get **Console** in the sidebar:

```
help
users [text]
user <@username|email>
grant <@username|email> <pro|ultimate> <12h|30d|8w|6mo|1y|permanent>
revoke <@username|email>
dev <@username|email> <on|off>
audit [count]
```

Commands run on the server, are limited to Developer accounts, and every change is written to the `audit`
collection. Timed plans fall back to Free by themselves when they run out. Developers can't change their own badge
from the console.

Project and goal limits are enforced on the server. Theme, Timeline and export gates are in the app.

## Personal time (Pro and Ultimate)

Set a day to **Personal** under Settings ▸ Working pattern, then mark a task's Type as Personal (or add `#personal`
when capturing). Personal tasks run only on Personal days and non-working days (09:00–18:00); work tasks never do.

## Custom board (Pro and Ultimate)

**Customise** on the Board adds, renames, reorders and deletes columns, and manages coloured labels. Backlog,
In progress and Done can be renamed but not deleted. Labels can be filtered on the Board, Table, Timeline and Calendar.

## Local development

`npm run dev` needs nothing else: it uses an in-memory MongoDB and shows email codes on screen. To use a real
database, copy `.dev.vars.example` to `.env` and fill in `MONGODB_URI`.
