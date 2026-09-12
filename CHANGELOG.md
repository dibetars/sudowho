# Changelog

All notable changes to sudowho will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Custom domain `sudowho.tarsusstudios.com` added to the Vercel project
  (pending DNS: `A sudowho.tarsusstudios.com → 76.76.21.21`).

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
