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
  before a start date, keeping a buffer free. Admin and Comms prefer afternoons.
- **Today**: the lead block with a Pomodoro ring, schedule, must-dos 1–3 (4–5 unlock afterwards), quick wins and
  alerts.
- **Week** time grid (double-click a block to pin it), **Board** with WIP limit and drag & drop, **Table** with
  sorting, grouping, inline edit and bulk actions, **Timeline** Gantt with dependency arrows, **Calendar** with
  drag-to-reschedule, **Projects** with health, **Goals** with pace against a straight line, and **Insights**
  with a 12-week capacity forecast and off-the-job hours.
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

## Deploy

Push to GitHub, then import the repository in Vercel (or Cloudflare Pages). `adapter-auto` picks the right
adapter, and every push to `main` ships. Add your domain in the host's dashboard and create the DNS records it
shows.

## Next step: hosted accounts and sync

Accounts and plans are currently **local to each browser** (local mode). The screens already follow the
hosted flow from the design's build map (L.08). To make accounts work across devices:

1. Create a Supabase project, run the schema from L.08 (one table per type with row-level security), and enable
   the email and Google providers.
2. Add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to `.env` and to your host.
3. Swap the internals of `src/lib/stores/auth.svelte.ts` and the `#persist`/`load` methods of
   `workspace.svelte.ts` for `@supabase/ssr` calls. The public methods stay the same, so no screen changes.
