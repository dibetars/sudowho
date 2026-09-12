#!/usr/bin/env python3
"""
sudowho core — identity switching + project registry + Supabase compute
management + git activity tracking, all driven by a local JSON config.

No network dependency beyond the Supabase Management API and your own
git remotes. Everything lives under ~/.config/sudowho by default.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

HOME = Path.home()
ROOT = Path(os.environ.get("SUDOWHO_HOME", HOME / ".config/sudowho"))
CONFIG = ROOT / "config.json"
STATE = ROOT / "state.json"
ENVS = ROOT / "envs"
SECRETS = ROOT / "secrets"
API = "https://api.supabase.com/v1"
DEFAULT_INACTIVITY_DAYS = 7

EMPTY_CONFIG = {
    "profiles": {},
    "supabaseAccounts": {},
    "projects": {},
    "settings": {
        "heartbeatInactivityDays": DEFAULT_INACTIVITY_DAYS,
        "heartbeatEnabledDefault": True,
    },
}


# --------------------------------------------------------------------------
# Config / state plumbing
# --------------------------------------------------------------------------

def ensure_dirs() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    ENVS.mkdir(parents=True, exist_ok=True)
    SECRETS.mkdir(parents=True, exist_ok=True)


def load_cfg() -> dict:
    ensure_dirs()
    if not CONFIG.exists():
        CONFIG.write_text(json.dumps(EMPTY_CONFIG, indent=2) + "\n")
        CONFIG.chmod(0o600)
    return json.loads(CONFIG.read_text())


def save_cfg(cfg: dict) -> None:
    CONFIG.write_text(json.dumps(cfg, indent=2) + "\n")
    CONFIG.chmod(0o600)


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, indent=2) + "\n")
    STATE.chmod(0o600)


def token_path(account: str) -> Path:
    return SECRETS / account / "access-token"


def get_token(account: str) -> str | None:
    p = token_path(account)
    if not p.exists():
        return None
    return p.read_text().strip() or None


def save_token(account: str, token: str) -> None:
    d = SECRETS / account
    d.mkdir(parents=True, exist_ok=True)
    p = token_path(account)
    p.write_text(token.strip() + "\n")
    p.chmod(0o600)


# --------------------------------------------------------------------------
# Supabase Management API
# --------------------------------------------------------------------------

def api(token: str, method: str, path: str) -> tuple[int, object]:
    req = urllib.request.Request(
        API + path,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode()
            return resp.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            data = json.loads(body) if body else {"message": body}
        except json.JSONDecodeError:
            data = {"message": body}
        return e.code, data


def _http_json(method: str, url: str, headers: dict[str, str] | None = None, timeout: int = 30) -> tuple[int, str]:
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except Exception as e:  # noqa: BLE001
        return 0, str(e)


def _sql_heartbeat(token: str, ref: str) -> tuple[bool, str]:
    payload = json.dumps({"query": "select 1 as sudowho_heartbeat"}).encode()
    req = urllib.request.Request(
        API + f"/projects/{ref}/database/query",
        data=payload,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return True, f"SQL HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"SQL HTTP {e.code}: {e.read().decode(errors='replace')[:160]}"
    except Exception as e:  # noqa: BLE001
        return False, f"SQL error: {e}"


# --------------------------------------------------------------------------
# Project / account resolution
# --------------------------------------------------------------------------

def resolve_project(slug_or_name: str) -> tuple[str, dict]:
    cfg = load_cfg()
    projects = cfg["projects"]
    key = slug_or_name.strip().lower().replace(" ", "-").replace("_", "-")
    if key in projects:
        return key, projects[key]
    for slug, p in projects.items():
        if p["name"].lower() == slug_or_name.lower():
            return slug, p
        if slug.replace("-", "") == key.replace("-", ""):
            return slug, p
    raise SystemExit(f"unknown project: {slug_or_name} (try: sudowho projects)")


def in_git_repo(path: str = ".") -> bool:
    return _git(path, "rev-parse", "--is-inside-work-tree") == "true"


def _git(repo: str, *args: str) -> str | None:
    import subprocess

    try:
        return subprocess.check_output(["git", "-C", repo, *args], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return None


# --------------------------------------------------------------------------
# Identity switching
# --------------------------------------------------------------------------

def cmd_switch_identity(profile: str, repo: str = ".") -> dict:
    cfg = load_cfg()
    if profile not in cfg["profiles"]:
        raise SystemExit(f"unknown profile: {profile} (try: sudowho list)")
    p = cfg["profiles"][profile]
    result = {"profile": profile}

    if in_git_repo(repo):
        _git(repo, "config", "--local", "user.name", p["git"]["name"])
        _git(repo, "config", "--local", "user.email", p["git"]["email"])
        result["git"] = f"{p['git']['name']} <{p['git']['email']}>"
    else:
        result["git"] = None

    import subprocess

    gh_user = p.get("gh")
    if gh_user:
        r = subprocess.run(["gh", "auth", "switch", "--user", gh_user], capture_output=True, text=True)
        result["gh"] = gh_user if r.returncode == 0 else f"FAILED: {r.stderr.strip()}"

    vercel = p.get("vercel") or {}
    scope = vercel.get("preferredScope")
    vercel_dir = SECRETS / "vercel" / profile
    cli_dir = Path.home() / "Library/Application Support/com.vercel.cli"
    if (vercel_dir / "auth.json").exists():
        cli_dir.mkdir(parents=True, exist_ok=True)
        (cli_dir / "auth.json").write_text((vercel_dir / "auth.json").read_text())
        if (vercel_dir / "config.json").exists():
            (cli_dir / "config.json").write_text((vercel_dir / "config.json").read_text())
        who = subprocess.run(["vercel", "whoami"], capture_output=True, text=True).stdout.strip()
        result["vercel"] = who or None
        if scope and who:
            subprocess.run(["vercel", "teams", "switch", scope], capture_output=True, text=True)
            result["vercelScope"] = scope
    else:
        result["vercel"] = None

    return result


def cmd_vercel_save(profile: str) -> str:
    import subprocess

    cli_dir = Path.home() / "Library/Application Support/com.vercel.cli"
    auth = cli_dir / "auth.json"
    if not auth.exists():
        raise SystemExit("no Vercel auth found — run `vercel login` first")
    dest = SECRETS / "vercel" / profile
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "auth.json").write_text(auth.read_text())
    (dest / "auth.json").chmod(0o600)
    cfg_file = cli_dir / "config.json"
    if cfg_file.exists():
        (dest / "config.json").write_text(cfg_file.read_text())
    who = subprocess.run(["vercel", "whoami"], capture_output=True, text=True).stdout.strip()
    return who or "unknown"


# --------------------------------------------------------------------------
# Compute: wake / pause / status
# --------------------------------------------------------------------------

def _require_supabase_project(slug: str, proj: dict) -> tuple[str, str]:
    if proj.get("provider") != "supabase":
        raise SystemExit(f"{slug} is provider={proj.get('provider')} (not supabase wake/pause)")
    ref = proj.get("ref")
    if not ref:
        raise SystemExit(f"{slug} has no project ref yet. Run: sudowho sync-refs {proj['account']}")
    token = get_token(proj["account"])
    if not token:
        raise SystemExit(f"no token for account '{proj['account']}'. Run: sudowho supabase-login {proj['account']}")
    return ref, token


def cmd_wake(slug_or_name: str, pause_others: bool = False) -> dict:
    slug, proj = resolve_project(slug_or_name)
    ref, token = _require_supabase_project(slug, proj)
    code, data = api(token, "POST", f"/projects/{ref}/restore")
    out = {"slug": slug, "ok": code < 400 or "already" in str(data).lower(), "code": code}

    state = load_state()
    state["activeProject"] = slug
    save_state(state)

    if pause_others:
        cfg = load_cfg()
        paused = []
        for other_slug, other in cfg["projects"].items():
            if other_slug == slug or not other.get("pauseWhenIdle"):
                continue
            if other.get("provider") != "supabase" or not other.get("ref"):
                continue
            ot = get_token(other["account"])
            if not ot:
                continue
            c, _ = api(ot, "POST", f"/projects/{other['ref']}/pause")
            paused.append({"slug": other_slug, "code": c})
        out["paused"] = paused

    return out


def cmd_wake_all() -> list[dict]:
    cfg = load_cfg()
    seen: set[str] = set()
    results = []
    for slug, proj in cfg["projects"].items():
        if proj.get("provider") != "supabase" or not proj.get("ref"):
            continue
        if proj["ref"] in seen:
            continue
        token = get_token(proj["account"])
        if not token:
            continue
        seen.add(proj["ref"])
        code, data = api(token, "POST", f"/projects/{proj['ref']}/restore")
        results.append({"slug": slug, "code": code, "ok": code < 400 or "already" in str(data).lower()})
    return results


def cmd_pause(slug_or_name: str) -> dict:
    slug, proj = resolve_project(slug_or_name)
    ref, token = _require_supabase_project(slug, proj)
    code, data = api(token, "POST", f"/projects/{ref}/pause")
    return {"slug": slug, "code": code, "ok": code < 400}


def cmd_pause_idle() -> list[dict]:
    cfg = load_cfg()
    active = load_state().get("activeProject")
    results = []
    for slug, proj in cfg["projects"].items():
        if slug == active or not proj.get("pauseWhenIdle") or proj.get("provider") != "supabase":
            continue
        if not proj.get("ref") or not get_token(proj["account"]):
            continue
        results.append(cmd_pause(slug))
    return results


def cmd_compute_status() -> list[dict]:
    cfg = load_cfg()
    active = load_state().get("activeProject")
    out = []
    for slug, proj in cfg["projects"].items():
        if proj.get("provider") != "supabase" or not proj.get("ref"):
            continue
        token = get_token(proj["account"])
        status = None
        if token:
            code, data = api(token, "GET", f"/projects/{proj['ref']}")
            if code < 400 and isinstance(data, dict):
                status = data.get("status")
        out.append({"slug": slug, "name": proj["name"], "status": status, "active": slug == active})
    return out


# --------------------------------------------------------------------------
# Heartbeat (keep free-tier projects awake)
# --------------------------------------------------------------------------

def _inactivity_days(cfg: dict) -> int:
    settings = cfg.get("settings") or {}
    try:
        return int(settings.get("heartbeatInactivityDays") or DEFAULT_INACTIVITY_DAYS)
    except (TypeError, ValueError):
        return DEFAULT_INACTIVITY_DAYS


def _heartbeat_enabled(proj: dict, cfg: dict) -> bool:
    if proj.get("provider") != "supabase":
        return False
    if "heartbeat" in proj:
        return bool(proj.get("heartbeat"))
    return bool((cfg.get("settings") or {}).get("heartbeatEnabledDefault", True))


def _days_since(iso: str | None) -> float | None:
    if not iso:
        return None
    from datetime import datetime, timezone

    try:
        ts = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return max(0.0, (datetime.now(timezone.utc) - ts).total_seconds() / 86400.0)


def _heartbeat_one(slug: str, proj: dict, cfg: dict) -> dict:
    from datetime import datetime, timezone

    result = {"slug": slug, "ok": False, "message": "", "at": datetime.now(timezone.utc).isoformat()}
    if not _heartbeat_enabled(proj, cfg) or not proj.get("ref"):
        result["message"] = "disabled or missing ref"
        return result
    token = get_token(proj["account"])
    if not token:
        result["message"] = f"no token for '{proj['account']}'"
        return result
    code, data = api(token, "GET", f"/projects/{proj['ref']}")
    status = data.get("status") if isinstance(data, dict) else None
    result["status"] = status
    if status and ("INACTIVE" in str(status).upper() or status in {"GOING_DOWN", "PAUSING", "REMOVED"}):
        result["message"] = f"project status={status} (wake it first)"
        return result
    ok, msg = _sql_heartbeat(token, proj["ref"])
    result["ok"] = ok
    result["message"] = msg
    return result


def cmd_heartbeat(target: str | None = None) -> list[dict]:
    cfg = load_cfg()
    state = load_state()
    beats = state.setdefault("heartbeats", {})
    items = [resolve_project(target)] if target else list(cfg["projects"].items())
    seen: set[str] = set()
    results = []
    for slug, proj in items:
        if proj.get("provider") != "supabase" or not _heartbeat_enabled(proj, cfg):
            continue
        ref = proj.get("ref")
        if ref and ref in seen:
            continue
        if ref:
            seen.add(ref)
        r = _heartbeat_one(slug, proj, cfg)
        results.append(r)
        if r["ok"]:
            beats[slug] = {"lastAt": r["at"], "ok": True, "message": r["message"]}
        else:
            prev = beats.get(slug) or {}
            beats[slug] = {
                "lastAt": prev.get("lastAt"),
                "lastAttemptAt": r["at"],
                "ok": False,
                "message": r["message"],
            }
    state["heartbeats"] = beats
    save_state(state)
    return results


def cmd_heartbeat_status() -> list[dict]:
    cfg = load_cfg()
    state = load_state()
    beats = state.get("heartbeats") or {}
    window = _inactivity_days(cfg)
    out = []
    for slug, proj in cfg["projects"].items():
        if proj.get("provider") != "supabase":
            continue
        enabled = _heartbeat_enabled(proj, cfg)
        beat = beats.get(slug) or {}
        ago = _days_since(beat.get("lastAt"))
        remaining = max(0.0, window - ago) if ago is not None else None
        out.append(
            {
                "slug": slug,
                "name": proj["name"],
                "enabled": enabled,
                "lastAt": beat.get("lastAt"),
                "daysSince": ago,
                "daysLeft": remaining,
                "window": window,
            }
        )
    return out


# --------------------------------------------------------------------------
# Env vault
# --------------------------------------------------------------------------

def env_path(slug: str) -> Path:
    return ENVS / f"{slug}.env"


def cmd_env_show(slug_or_name: str) -> str:
    slug, _ = resolve_project(slug_or_name)
    p = env_path(slug)
    return p.read_text() if p.exists() else ""


def cmd_env_set(slug_or_name: str, src: str) -> str:
    slug, _ = resolve_project(slug_or_name)
    src_path = Path(src).expanduser().resolve()
    if not src_path.exists():
        raise SystemExit(f"file not found: {src_path}")
    dest = env_path(slug)
    dest.write_text(src_path.read_text())
    dest.chmod(0o600)
    return str(dest)


def cmd_env_to(slug_or_name: str, dest: str) -> str:
    slug, _ = resolve_project(slug_or_name)
    src = env_path(slug)
    if not src.exists():
        raise SystemExit(f"no env saved for {slug}")
    dest_path = Path(dest).expanduser().resolve()
    dest_path.write_text(src.read_text())
    return str(dest_path)


# --------------------------------------------------------------------------
# Activity: last push per project
# --------------------------------------------------------------------------

def _last_push_info(repo: str) -> dict:
    info: dict = {"ok": False}
    if not repo or not Path(repo).exists() or not in_git_repo(repo):
        info["error"] = "no repo configured / not a git repo"
        return info
    info["ok"] = True
    info["branch"] = _git(repo, "rev-parse", "--abbrev-ref", "HEAD") or "?"
    upstream = _git(repo, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    tip_ref = upstream
    if not tip_ref:
        for cand in ("origin/main", "origin/master"):
            if _git(repo, "rev-parse", "--verify", cand):
                tip_ref = cand
                break
    if tip_ref:
        tip = _git(repo, "log", "-1", "--format=%cI|%h|%s", tip_ref)
        if tip:
            iso, hh, subj = (tip.split("|", 2) + ["", ""])[:3]
            info["lastPushAt"] = iso
            info["lastPushHash"] = hh
            info["lastPushSubject"] = subj
            info["daysSincePush"] = _days_since(iso)
    if upstream:
        counts = _git(repo, "rev-list", "--left-right", "--count", f"HEAD...{upstream}")
        if counts:
            left, right = counts.split()
            info["ahead"], info["behind"] = int(left), int(right)
    info["dirty"] = bool(_git(repo, "status", "--porcelain"))
    return info


def cmd_last_push(fetch: bool = False) -> list[dict]:
    cfg = load_cfg()
    out = []
    for slug, proj in cfg["projects"].items():
        if not proj.get("whoami") or proj.get("provider") not in {"supabase", "neon"}:
            continue
        repo = proj.get("repo")
        if repo and fetch:
            _git(repo, "fetch", "--quiet", "--all")
        info = _last_push_info(repo) if repo else {"ok": False, "error": "no repo path configured"}
        out.append({"slug": slug, "name": proj["name"], "whoami": proj.get("whoami"), **info})
    return out


# --------------------------------------------------------------------------
# Setup wizard
# --------------------------------------------------------------------------

def cmd_init() -> None:
    ensure_dirs()
    if CONFIG.exists() and CONFIG.read_text().strip() and json.loads(CONFIG.read_text()).get("profiles"):
        print(f"Config already exists at {CONFIG} — skipping init.")
        print("Delete it (or edit directly) if you want to start fresh.")
        return

    print("sudowho setup")
    print("=============")
    print()
    cfg = json.loads(json.dumps(EMPTY_CONFIG))

    while True:
        name = input("Profile name (e.g. personal, work) [blank to finish]: ").strip()
        if not name:
            break
        git_name = input(f"  git user.name for '{name}': ").strip()
        git_email = input(f"  git user.email for '{name}': ").strip()
        gh_user = input(f"  GitHub CLI account login for '{name}' (must be logged in via `gh auth login`): ").strip()
        vercel_scope = input(f"  Vercel scope/team slug for '{name}' (optional): ").strip()
        cfg["profiles"][name] = {
            "git": {"name": git_name, "email": git_email},
            "gh": gh_user,
            "vercel": {"preferredScope": vercel_scope} if vercel_scope else {},
        }
        print(f"  ✓ saved profile '{name}'")
        print()

    save_cfg(cfg)
    print(f"Saved config to {CONFIG}")
    print("Next: sudowho supabase-login <account>   (add Supabase projects)")
    print("      sudowho dashboard                  (open the local dashboard)")


def main(argv: list[str]) -> None:
    if not argv:
        raise SystemExit("core.py: missing command")
    cmd = argv[0]
    rest = argv[1:]

    def out(payload):
        print(json.dumps(payload, indent=2, default=str))

    if cmd == "init":
        cmd_init()
    elif cmd == "switch":
        out(cmd_switch_identity(rest[0], rest[1] if len(rest) > 1 else "."))
    elif cmd == "vercel-save":
        print(cmd_vercel_save(rest[0]))
    elif cmd == "projects":
        out(load_cfg()["projects"])
    elif cmd == "accounts":
        cfg = load_cfg()
        out({k: {**v, "hasToken": bool(get_token(k))} for k, v in cfg["supabaseAccounts"].items()})
    elif cmd == "profiles":
        out(load_cfg()["profiles"])
    elif cmd == "supabase-login":
        account, token = rest[0], rest[1]
        save_token(account, token)
        code, data = api(token, "GET", "/projects")
        out({"account": account, "apiCheck": code, "projectCount": len(data) if isinstance(data, list) else 0})
    elif cmd == "wake":
        pause_others = "--pause-others" in rest
        target = next((a for a in rest if not a.startswith("-")), "")
        out(cmd_wake(target, pause_others))
    elif cmd == "wake-all":
        out(cmd_wake_all())
    elif cmd == "pause":
        out(cmd_pause(rest[0]))
    elif cmd == "pause-idle":
        out(cmd_pause_idle())
    elif cmd == "compute-status":
        out(cmd_compute_status())
    elif cmd == "heartbeat":
        out(cmd_heartbeat(rest[0] if rest else None))
    elif cmd == "heartbeat-status":
        out(cmd_heartbeat_status())
    elif cmd == "last-push":
        out(cmd_last_push(fetch="--fetch" in rest))
    elif cmd == "env-show":
        print(cmd_env_show(rest[0]))
    elif cmd == "env-set":
        print(cmd_env_set(rest[0], rest[1]))
    elif cmd == "env-to":
        print(cmd_env_to(rest[0], rest[1]))
    else:
        raise SystemExit(f"unknown command: {cmd}")


if __name__ == "__main__":
    main(sys.argv[1:])
