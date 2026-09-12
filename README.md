# sudowho

**Local-first identity, project, and compute manager for developers juggling
multiple git / GitHub / Vercel / Supabase accounts.**

sudowho runs entirely on your machine. There is no server, no account, no
telemetry. Your tokens, env vars, and account map never leave your laptop.

```bash
curl -fsSL https://sudowho.tarsusstudios.com/install.sh | bash
sudowho init
sudowho dashboard
```

## Why

If you manage several client/personal/company accounts across GitHub, Vercel,
and Supabase, switching between them means juggling:

- `git config user.name` / `user.email` per repo
- `gh auth switch`
- `vercel login` / `vercel switch`
- Remembering which Supabase project belongs to which dashboard login
- Free-tier Supabase projects silently auto-pausing after 7 days idle
- Never quite knowing which project you last pushed to, or when

sudowho wraps all of that into one config file and one command.

## What it does

- **Identity switching** — one command sets git identity (per repo), the
  active `gh` account, and restores the right Vercel login/scope.
- **Project registry** — a single JSON file maps every project to its
  dashboard account, Supabase ref, whoami profile, and local repo path.
- **Compute control** — wake the project you need, pause everything else,
  so you're not paying for (or losing) idle Supabase compute.
- **Heartbeat** — pings your own database on a schedule so free-tier
  projects don't auto-pause, and tracks estimated days left before they would.
- **Activity tracking** — see the last known push per project across every
  account you manage, in one table.
- **Local dashboard** — a zero-dependency (stdlib Python + vanilla JS) web
  UI with every command wired to a button, dark/light themed.

## Install

See [Install docs](https://sudowho.tarsusstudios.com/install) or:

```bash
curl -fsSL https://sudowho.tarsusstudios.com/install.sh | bash
```

Requires only `python3` and `git` (both usually already on your machine).
`gh` and `vercel` CLIs are optional — sudowho skips whatever isn't installed.

## Usage

```bash
sudowho init                              # one-time setup wizard
sudowho list                              # see configured profiles
sudowho <profile>                         # switch git+gh+vercel in this repo
sudowho <profile> --push                  # switch, auto commit message, push
sudowho use <project> --pause-others      # switch identity + wake this Supabase project
sudowho compute-status                    # what's active vs paused right now
sudowho heartbeat-status                  # days left before free-tier auto-pause
sudowho last-push --fetch                 # last push per project, across accounts
sudowho dashboard                         # open the local web UI
```

Full command reference: [Docs](https://sudowho.tarsusstudios.com/docs)

## Configuration

Everything lives under `~/.config/sudowho/`:

```
~/.config/sudowho/
  config.json      # profiles, accounts, projects — see cli/config.example.json
  secrets/         # per-account tokens, chmod 600, never committed anywhere
  envs/            # per-project .env vault
  state.json       # heartbeat history, active project
```

## Local-first, on purpose

sudowho was built because personal account/project maps and access tokens
shouldn't live in a cloud service. Everything — the CLI, the dashboard, the
config, the secrets — runs and stays on your machine. The only network calls
sudowho makes are to the Supabase Management API (to wake/pause *your own*
projects) and your own git remotes.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a history of changes.

## License

MIT — see [LICENSE](./LICENSE).
