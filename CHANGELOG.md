# Changelog

All notable changes to sudowho will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Custom domain `sudowho.tarsusstudios.com` added to the Vercel project
  (pending DNS: `A sudowho.tarsusstudios.com → 76.76.21.21`).
- Dashboard Overview: donut chart of compute status, a "projects at risk"
  progress list (days left before auto-pause, sorted ascending), and a
  real activity heatmap built from actual `git log` history across every
  configured repo (GitHub-contribution-graph style, 70-day window).
- Loading states on every dashboard action button (wake, pause, wake-all,
  pause-idle, run heartbeat, fetch remotes, identity switch) — buttons now
  show a spinner and disable themselves while the request is in flight.
- `core.py`: `cmd_activity_heatmap()` and `cmd_status_breakdown()`, plus
  `sudowho activity-heatmap` / `sudowho status-breakdown` CLI commands and
  matching `/api/activity-heatmap` / `/api/status-breakdown` dashboard
  endpoints.

- Activity heatmap: project dropdown (all or a single project) and a
  30d/60d/all-time range control; grid now fills the full card width.
- Overview Compute/Heartbeat tables capped to 5 rows each with a
  "View all →" button that jumps straight to the corresponding tab.
- Project detail modal: click "View details" on any Projects row to see
  account, provider, whoami profile, ref, repo path, live compute status,
  heartbeat state, git activity, and env vault key names (values are
  never shown in the UI).
- "Stop server" button in the sidebar — gracefully shuts down the local
  dashboard server (with a confirm prompt) via a new `/api/shutdown`
  endpoint.
- `core.py`: `cmd_project_detail()` aggregates everything sudowho knows
  about a single project; `cmd_activity_heatmap()` now accepts a project
  filter.

### Fixed
- `core.py` `get_token()` now falls back to the legacy
  `ROOT/supabase/<account>/access-token` path, so accounts set up before
  the public release keep working without re-entering tokens.
- `cmd_switch_identity()` now also falls back to the legacy
  `ROOT/vercel/<profile>/` path for saved Vercel logins.
- Identity switch now returns a `vercelError` explaining *why* Vercel
  is `null` (expired session vs. never saved) instead of a silent
  `null`, since Vercel CLI session tokens expire ~2 hours after
  `vercel login` and there's no way to refresh them automatically.

### Added
- One-click "Reauthenticate Vercel" — a button on each profile card
  (and inline on the switch result whenever `vercelError` shows up) that
  starts Vercel's device-code login flow, auto-opens the approval URL,
  polls until confirmed, and saves the refreshed session automatically.
  No more manually running `vercel login` + `sudowho vercel-save`.
- `sudowho vercel-login <profile>` CLI command — the terminal equivalent
  of the dashboard button.

### Changed
- Overview activity heatmap: removed the project/range filter controls
  in favor of a simple, fixed 70-day/all-projects view; added month
  labels above the columns (GitHub-contribution-graph style).
- Project detail modal redesigned: colored section icons, a live status
  pill next to the project name, and a progress bar for heartbeat
  days-left matching the Overview "projects at risk" styling.

## [0.1.0] - 2026-09-12

### Added
- **CLI** (`cli/`): identity switching (git + `gh` + Vercel per repo),
  `sudowho init` setup wizard, project registry, Supabase compute
  wake/pause/heartbeat, `last-push` git activity tracking, env vault.
- **Installer**: `cli/install.sh` one-line curl installer, symlinks binary
  into `~/bin`, works whether run from a fresh clone or via curl.
- **Local dashboard** (`cli/dashboard/`): zero-build vanilla HTML/CSS/JS UI
  served by a stdlib Python HTTP server on `127.0.0.1` only. Sidebar nav
  (Overview, Identity, Projects, Compute, Heartbeat, Activity, Settings),
  dark/light theme toggle (persisted in localStorage), every action wired
  to a real local API call — no external network calls except to your own
  Supabase Management API / git remotes.
- **Marketing site** (`site/`): Next.js 16 + Tailwind v4, deployed to Vercel.
  - Landing page with hero, CLI-vs-dashboard section, and 8 USP cards
    (local-first, zero lock-in, no heavy deps, one-command identity switch,
    anti-auto-pause heartbeat, single-table visibility, multi-client fit,
    open source).
  - `/docs` — full command reference.
  - `/install` — curl one-liner + manual install steps.
  - `/api/subscribe` — email capture via Resend contacts API.
  - Dark/light theme toggle in the header (`next-themes`).
- **Repo**: public GitHub repo under `dibetars/sudowho`, MIT licensed,
  `cli/config.example.json` ships as an empty template (no real account data).

### Fixed
- `next.config.ts` Turbopack root warning when building outside a
  git-tracked parent directory.
- Bash entrypoint symlink resolution (`readlink` loop) so `sudowho` works
  correctly whether invoked directly or through the installer's symlink
  in `~/bin`.

---

## Personal setup history (pre-public-release)

These changes happened before this was turned into a public product, back
when it was the personal `whoami-switch` tool. Kept here for continuity.

- Renamed `whoami-switch` → `sudowho` everywhere (binary, config dir,
  `SUDOWHO_HOME` env var, LaunchAgent label, docs).
- Added automatic conventional-commit-style commit message generation from
  the staged diff (no LLM call, pure static analysis).
- Added Supabase account/project registry mapped to whoami profiles.
- Added `sync-refs` to fill in real Supabase project refs per account via
  the Management API, skipping non-Supabase (e.g. Neon) projects.
- Added `wake` / `wake-all` / `pause` / `pause-idle` / `compute-status` for
  Supabase compute management.
- Added heartbeat subsystem (`heartbeat`, `heartbeat-status`,
  `heartbeat-cron-install`, `heartbeat-cron-uninstall`) to prevent
  free-tier Supabase auto-pause, using the Management API SQL endpoint as
  the primary ping with a REST table-ping fallback.
  - Fixed an XML-escaping bug in the generated macOS LaunchAgent plist
    (`2>&1` needed `&amp;`).
- Added `last-push` to report last git push time/branch/ahead-behind/dirty
  state per project, scoped to projects with both a whoami profile and a
  Supabase/Neon mapping.
- Added env vault (`env`, `env-set`, `env-to`, `env-path`, `env-export`)
  for per-project `.env` files.
- Security check: found 9 Supabase personal access tokens leaked in
  plaintext in two local Cursor terminal log files. Remediated by deleting
  the logs and tightening `config.json`/`state.json` permissions to `600`
  (token rotation intentionally deferred by request).
