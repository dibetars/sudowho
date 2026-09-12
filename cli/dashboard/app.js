// sudowho local dashboard — vanilla JS, no build step, no external requests.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
// Most GET endpoints are backed by a short-lived server-side cache (see
// dashboard_server.py) since some of them hit the Supabase API or run git
// across every repo. Pass `fresh: true` to bypass it (used by the Refresh
// button and right after an action that we know changed the data).
const get = (path, { fresh = false } = {}) => {
  const url = fresh ? path + (path.includes("?") ? "&" : "?") + "fresh=1" : path;
  return api(url);
};
const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

// ---- Skeleton loading placeholders ----
const skeletonRow = (cols) => `<tr class="skeleton-row">${Array.from({ length: cols }, () => `<td><span class="skeleton skeleton-text"></span></td>`).join("")}</tr>`;
const skeletonRows = (cols, n = 4) => Array.from({ length: n }, () => skeletonRow(cols)).join("");

// ---- Button loading states ----
// Wraps any button click handler so it shows a spinner + "Working..." label
// and is disabled while its promise is in flight, then always restores.
function withLoading(el, fn) {
  const isButton = el.tagName === "BUTTON";
  return async (...args) => {
    if (el.classList.contains("is-loading")) return;
    const original = isButton ? el.textContent : null;
    const loadingLabel = el.dataset.loadingLabel || "Working...";
    el.classList.add("is-loading");
    if (isButton) {
      el.disabled = true;
      el.textContent = loadingLabel;
    } else {
      el.style.pointerEvents = "none";
    }
    try {
      await fn(...args);
    } catch (e) {
      console.error(e);
      alert(e.message || "Something went wrong");
    } finally {
      el.classList.remove("is-loading");
      if (isButton) {
        el.disabled = false;
        el.textContent = original;
      } else {
        el.style.pointerEvents = "";
      }
    }
  };
}

// ---- Theme ----
function initTheme() {
  const saved = localStorage.getItem("sudowho-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeLabel(saved);
  $("#theme-toggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("sudowho-theme", next);
    updateThemeLabel(next);
  });
}
function updateThemeLabel(theme) {
  $("#theme-icon").textContent = theme === "dark" ? "☾" : "☀";
  $("#theme-label").textContent = theme === "dark" ? "Dark" : "Light";
}

// ---- Nav ----
function initNav() {
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      $$(".view").forEach((v) => v.classList.remove("active"));
      $(`#view-${view}`).classList.add("active");
      $("#view-title").textContent = btn.textContent.trim();
      loadView(view);
    });
  });
}

function statusPill(status) {
  if (!status) return `<span class="status-pill unknown">unknown</span>`;
  const s = String(status).toUpperCase();
  if (s.includes("ACTIVE")) return `<span class="status-pill active">${status}</span>`;
  if (s.includes("INACTIVE") || s.includes("PAUS")) return `<span class="status-pill inactive">${status}</span>`;
  return `<span class="status-pill unknown">${status}</span>`;
}

// ---- Overview ----
const OVERVIEW_LIMIT = 5;
const HEATMAP_DAYS = 70; // ~10 weeks, matches the reference design

function skeletonOverview() {
  $("#m-active").innerHTML = `<span class="skeleton skeleton-metric"></span>`;
  $("#m-paused").innerHTML = `<span class="skeleton skeleton-metric"></span>`;
  $("#m-heartbeats").innerHTML = `<span class="skeleton skeleton-metric"></span>`;
  $("#m-profiles").innerHTML = `<span class="skeleton skeleton-metric"></span>`;
  $("#compute-table tbody").innerHTML = skeletonRows(3, 3);
  $("#heartbeat-table tbody").innerHTML = skeletonRows(3, 3);
  $("#status-donut").innerHTML = `<circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" stroke-width="16" />`;
  $("#status-legend").innerHTML = `<span class="skeleton skeleton-text"></span><span class="skeleton skeleton-text"></span>`;
  $("#risk-list").innerHTML = Array.from(
    { length: 3 },
    () => `<div class="risk-row"><div class="risk-top"><span class="skeleton skeleton-text"></span></div><div class="skeleton skeleton-bar"></div></div>`
  ).join("");
  $("#heatmap").innerHTML = `<span class="skeleton" style="width:100%;height:80px;"></span>`;
  $("#heatmap-months").innerHTML = "";
}

async function loadOverview(fresh = false) {
  skeletonOverview();
  const [compute, heartbeats, profiles, breakdown, heatmap] = await Promise.all([
    get("/api/compute-status", { fresh }),
    get("/api/heartbeat-status"),
    get("/api/profiles"),
    get("/api/status-breakdown", { fresh }),
    get(`/api/activity-heatmap?days=${HEATMAP_DAYS}`, { fresh }),
  ]);
  const active = compute.filter((c) => (c.status || "").includes("ACTIVE")).length;
  const paused = compute.filter((c) => (c.status || "").includes("INACTIVE")).length;
  const ok = heartbeats.filter((h) => h.daysLeft !== null && h.daysLeft > 0).length;

  $("#m-active").textContent = active;
  $("#m-paused").textContent = paused;
  $("#m-heartbeats").textContent = ok;
  $("#m-profiles").textContent = Object.keys(profiles).length;

  const ctBody = $("#compute-table tbody");
  ctBody.innerHTML = compute
    .slice(0, OVERVIEW_LIMIT)
    .map((c) => `<tr><td>${c.name}</td><td>${statusPill(c.status)}</td><td></td></tr>`)
    .join("") || `<tr><td colspan="3" class="muted">No Supabase-backed projects yet.</td></tr>`;

  const hbBody = $("#heartbeat-table tbody");
  hbBody.innerHTML = heartbeats
    .slice(0, OVERVIEW_LIMIT)
    .map((h) => {
      const days = h.daysLeft !== null && h.daysLeft !== undefined ? `${h.daysLeft.toFixed(1)}d` : "?";
      const last = h.lastAt ? new Date(h.lastAt).toLocaleString() : "never";
      return `<tr><td>${h.name}</td><td>${last}</td><td>${days}</td></tr>`;
    })
    .join("") || `<tr><td colspan="3" class="muted">No heartbeat data yet.</td></tr>`;

  renderDonut(breakdown);
  renderRiskList(heartbeats);
  renderHeatmap(heatmap);
}

// ---- Donut chart (compute status breakdown) ----
function renderDonut(breakdown) {
  const entries = [
    { key: "active", label: "Active", color: "var(--good)", value: breakdown.active || 0 },
    { key: "paused", label: "Paused", color: "var(--warn)", value: breakdown.paused || 0 },
    { key: "unknown", label: "Unknown", color: "var(--muted)", value: breakdown.unknown || 0 },
  ];
  const total = entries.reduce((s, e) => s + e.value, 0);
  const svg = $("#status-donut");
  const legend = $("#status-legend");

  if (!total) {
    svg.innerHTML = `<circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" stroke-width="16" />`;
    legend.innerHTML = `<div class="risk-empty">No Supabase-backed projects configured yet.</div>`;
    return;
  }

  const r = 48;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = entries
    .filter((e) => e.value > 0)
    .map((e) => {
      const frac = e.value / total;
      const len = frac * circumference;
      const dasharray = `${len} ${circumference - len}`;
      const el = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${e.color}" stroke-width="16" stroke-dasharray="${dasharray}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)" />`;
      offset += len;
      return el;
    })
    .join("");
  svg.innerHTML = arcs;

  legend.innerHTML = entries
    .map(
      (e) => `<div class="legend-row"><span class="dot" style="background:${e.color}"></span>${e.label}<span class="count">${e.value}</span></div>`
    )
    .join("");
}

// ---- Risk list (projects closest to auto-pause) ----
function renderRiskList(heartbeats) {
  const list = $("#risk-list");
  const withDays = heartbeats.filter((h) => h.daysLeft !== null && h.daysLeft !== undefined);
  if (!withDays.length) {
    list.innerHTML = `<div class="risk-empty">No heartbeat data yet — run a heartbeat to populate this.</div>`;
    return;
  }
  const sorted = [...withDays].sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 6);
  list.innerHTML = sorted
    .map((h) => {
      const pct = Math.max(2, Math.min(100, (h.daysLeft / h.window) * 100));
      const low = h.daysLeft < h.window * 0.3 ? " low" : "";
      return `
        <div class="risk-row">
          <div class="risk-top"><span class="risk-name">${h.name}</span><span class="risk-days">${h.daysLeft.toFixed(1)}d left</span></div>
          <div class="risk-bar"><div class="risk-bar-fill${low}" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join("");
}

// ---- Activity heatmap (real git commit history, GitHub-style) ----
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderHeatmap(heatmap) {
  const entries = Object.entries(heatmap.counts || {});
  const total = entries.reduce((s, [, c]) => s + c, 0);
  $("#heatmap-total").textContent = `${total} commit${total === 1 ? "" : "s"} (last ${heatmap.days || HEATMAP_DAYS} days)`;

  const el = $("#heatmap");
  const monthsEl = $("#heatmap-months");
  if (!entries.length) {
    el.innerHTML = `<div class="risk-empty">No repos with a configured path yet.</div>`;
    monthsEl.innerHTML = "";
    return;
  }
  const max = Math.max(1, ...entries.map(([, c]) => c));
  const level = (c) => {
    if (c === 0) return 0;
    const ratio = c / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.2) return 2;
    return 1;
  };

  // Group into weeks (columns of 7 days) for a GitHub-style grid.
  const weeks = [];
  for (let i = 0; i < entries.length; i += 7) {
    weeks.push(entries.slice(i, i + 7));
  }

  // Month labels: show the month name above the first week that starts a new month.
  let lastMonth = null;
  monthsEl.innerHTML = weeks
    .map((week) => {
      const firstDate = new Date(week[0][0] + "T00:00:00");
      const month = firstDate.getMonth();
      let label = "";
      if (month !== lastMonth) {
        label = MONTH_NAMES[month];
        lastMonth = month;
      }
      return `<div class="heatmap-month-label">${label}</div>`;
    })
    .join("");

  el.innerHTML = weeks
    .map(
      (week) =>
        `<div class="heatmap-week">${week
          .map(([date, count]) => `<div class="heatmap-day" data-level="${level(count)}" title="${date}: ${count} commit${count === 1 ? "" : "s"}"></div>`)
          .join("")}</div>`
    )
    .join("");
}

// ---- Identity ----
async function loadIdentity() {
  $("#profiles-list").innerHTML = Array.from(
    { length: 2 },
    () => `<div class="profile-card"><span class="skeleton skeleton-text" style="width:60px;height:16px;margin-bottom:8px;"></span><span class="skeleton skeleton-text"></span></div>`
  ).join("");
  const profiles = await get("/api/profiles");
  const grid = $("#profiles-list");
  grid.innerHTML = Object.entries(profiles)
    .map(
      ([name, p]) => `
      <div class="profile-card" data-profile="${name}">
        <div class="p-name">${name}</div>
        <div class="p-detail">${p.git?.name || ""} &lt;${p.git?.email || ""}&gt;</div>
        <div class="p-detail">gh: ${p.gh || "-"}</div>
        <div class="p-detail">vercel: ${p.vercel?.preferredScope || "-"}</div>
        <div class="vercel-reauth-row">
          <button class="mini-btn vercel-reauth-btn" data-profile="${name}" type="button">Reauthenticate Vercel</button>
          <div class="vercel-reauth-status muted small-label"></div>
        </div>
      </div>`
    )
    .join("");

  $$(".profile-card").forEach((card) => {
    card.dataset.loadingLabel = "Switching...";
    card.addEventListener(
      "click",
      withLoading(card, async () => {
        const profile = card.dataset.profile;
        const resultEl = $("#switch-result");
        resultEl.classList.remove("hidden");
        resultEl.innerHTML = `Switching to ${profile}...`;
        try {
          const result = await post("/api/switch", { profile });
          renderSwitchResult(result);
        } catch (e) {
          resultEl.innerHTML = `Error: ${e.message}`;
          throw e;
        }
      })
    );
  });

  $$(".vercel-reauth-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const profile = btn.dataset.profile;
      const statusEl = btn.parentElement.querySelector(".vercel-reauth-status");
      startVercelReauth(profile, statusEl, btn);
    });
  });
}

// Renders the JSON result of an identity switch, plus a "Reauthenticate
// Vercel" action inline if the switch reported an expired/missing session.
function renderSwitchResult(result) {
  const resultEl = $("#switch-result");
  const pre = document.createElement("pre");
  pre.style.margin = "0";
  pre.textContent = JSON.stringify(result, null, 2);
  resultEl.innerHTML = "";
  resultEl.appendChild(pre);

  if (result.vercelError) {
    const row = document.createElement("div");
    row.className = "vercel-reauth-row";
    row.innerHTML = `
      <button class="mini-btn vercel-reauth-btn" type="button">Reauthenticate Vercel</button>
      <div class="vercel-reauth-status muted small-label"></div>
    `;
    resultEl.appendChild(row);
    const btn = row.querySelector(".vercel-reauth-btn");
    const statusEl = row.querySelector(".vercel-reauth-status");
    btn.addEventListener("click", () => startVercelReauth(result.profile, statusEl, btn));
  }
}

// Kicks off the Vercel device-code login flow for a profile, opens the
// approval URL, and polls until it's confirmed (or fails/times out).
async function startVercelReauth(profile, statusEl, btn) {
  btn.disabled = true;
  btn.textContent = "Starting...";
  statusEl.textContent = "";

  try {
    await post("/api/vercel-login", { profile });
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
    btn.disabled = false;
    btn.textContent = "Reauthenticate Vercel";
    return;
  }

  let opened = false;
  const poll = async () => {
    let s;
    try {
      s = await get(`/api/vercel-login-status?profile=${encodeURIComponent(profile)}`);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      btn.disabled = false;
      btn.textContent = "Reauthenticate Vercel";
      return;
    }

    if (s.status === "waiting" && s.url) {
      if (!opened) {
        opened = true;
        window.open(s.url, "_blank");
      }
      statusEl.innerHTML = `Waiting for approval — <a href="${s.url}" target="_blank" class="text-link">open link</a> if it didn't open automatically.`;
      btn.textContent = "Waiting for approval...";
      setTimeout(poll, 1500);
    } else if (s.status === "done") {
      statusEl.textContent = `✓ Signed in as ${s.message}`;
      btn.disabled = false;
      btn.textContent = "Reauthenticate Vercel";
    } else if (s.status === "error") {
      statusEl.textContent = `✗ ${s.message}`;
      btn.disabled = false;
      btn.textContent = "Reauthenticate Vercel";
    } else {
      statusEl.textContent = "Starting Vercel login...";
      setTimeout(poll, 1000);
    }
  };
  poll();
}

// ---- Projects ----
async function loadProjects() {
  $("#projects-table tbody").innerHTML = skeletonRows(6, 6);
  const projects = await get("/api/projects");
  const body = $("#projects-table tbody");
  body.innerHTML = Object.entries(projects)
    .map(
      ([slug, p]) => `<tr>
        <td>${slug}</td>
        <td>${p.name}</td>
        <td>${p.whoami || "-"}</td>
        <td>${p.provider}</td>
        <td>${p.account}</td>
        <td><button class="project-link" data-slug="${slug}">View details →</button></td>
      </tr>`
    )
    .join("");

  $$(".project-link").forEach((btn) => btn.addEventListener("click", () => openProjectModal(btn.dataset.slug)));
}

// ---- Project detail modal ----
async function openProjectModal(slug, notice) {
  const overlay = $("#project-modal");
  const title = $("#modal-title");
  const body = $("#modal-body");
  overlay.classList.remove("hidden");
  title.innerHTML = `<span class="skeleton skeleton-text" style="width:140px;height:18px;"></span>`;
  $("#modal-title-pill").innerHTML = "";
  body.innerHTML = Array.from(
    { length: 5 },
    () => `<div class="detail-row"><span class="skeleton skeleton-text" style="width:90px;"></span><span class="skeleton skeleton-text" style="width:110px;"></span></div>`
  ).join("");

  try {
    const d = await get(`/api/project?slug=${encodeURIComponent(slug)}`);
    title.textContent = d.name;
    $("#modal-title-pill").innerHTML = d.computeStatus !== undefined ? statusPill(d.computeStatus) : "";

    const row = (k, v) => `<div class="detail-row"><span class="k">${k}</span><span class="v">${v ?? "—"}</span></div>`;
    const section = (icon, title) => `<div class="detail-section-title"><span class="detail-section-icon">${icon}</span>${title}</div>`;

    let html = section("▣", "Project");
    html += row("Slug", d.slug);
    html += row("Account", d.account);
    html += row("Provider", d.provider);
    html += row("Whoami profile", d.whoami);
    html += row("Ref", d.ref);
    html += row("Repo path", d.repo);
    html += row("Pause when idle", d.pauseWhenIdle ? "yes" : "no");

    if (d.computeStatus !== undefined) {
      html += section("◈", "Compute");
      html += row("Status", statusPill(d.computeStatus));
      html += row("Region", d.region);
    }

    if (d.heartbeat) {
      html += section("♡", "Heartbeat");
      html += row("Enabled", d.heartbeat.enabled ? "yes" : "no");
      html += row("Last beat", d.heartbeat.lastAt ? new Date(d.heartbeat.lastAt).toLocaleString() : "never");
      if (d.heartbeat.daysLeft !== null && d.heartbeat.daysLeft !== undefined) {
        const pct = Math.max(2, Math.min(100, (d.heartbeat.daysLeft / d.heartbeat.window) * 100));
        const low = d.heartbeat.daysLeft < d.heartbeat.window * 0.3 ? " low" : "";
        html += `<div class="detail-row"><span class="k">Days left</span><span class="v">${d.heartbeat.daysLeft.toFixed(1)}d</span></div>`;
        html += `<div class="risk-bar" style="margin-bottom:10px;"><div class="risk-bar-fill${low}" style="width:${pct}%"></div></div>`;
      } else {
        html += row("Days left", "?");
      }
    }

    if (d.lastPush) {
      html += section("▦", "Git activity");
      if (d.lastPush.ok) {
        html += row("Branch", d.lastPush.branch);
        html += row("Last push", d.lastPush.lastPushAt ? new Date(d.lastPush.lastPushAt).toLocaleString() : "?");
        html += row("Last commit", d.lastPush.lastPushSubject);
        html += row("Ahead / behind", `${d.lastPush.ahead ?? "?"} / ${d.lastPush.behind ?? "?"}`);
        html += row("Working tree", d.lastPush.dirty ? `<span class="status-pill inactive">dirty</span>` : `<span class="status-pill active">clean</span>`);
        html += `<div id="git-actions-slot"></div>`;
      } else {
        html += row("Status", d.lastPush.error || "no repo configured");
      }
    }

    html += section("⚿", "Env vault");
    if (d.env && d.env.keys && d.env.keys.length) {
      html += `<div class="env-keys">${d.env.keys.map((k) => `<span class="env-key">${k}</span>`).join("")}</div>`;
    } else {
      html += `<div class="muted">No env file stored for this project.</div>`;
    }

    body.innerHTML = html;
    if (d.lastPush && d.lastPush.ok) bindGitActions(d.slug, notice);
  } catch (e) {
    title.textContent = "Error";
    body.innerHTML = `<div class="muted">${e.message}</div>`;
  }
}

function renderGitActions(slug, git) {
  const dirty = !!(git && git.dirty);
  const ahead = !!(git && git.ahead > 0);
  const files = (git && git.files) || [];
  const fileList = files.length
    ? `<div class="git-files">${files
        .map((f) => `<div class="git-file"><span class="code">${esc(f.status)}</span><span>${esc(f.path)}</span></div>`)
        .join("")}</div>`
    : "";
  const hint = dirty
    ? "Leave the message blank to auto-generate one from the changed files."
    : ahead
      ? `${git.ahead} commit(s) ahead of remote — ready to push.`
      : "Working tree clean — nothing to commit.";
  return `
    <div class="git-actions">
      ${fileList}
      <textarea class="git-msg" id="git-msg" placeholder="Commit message (optional — auto-generated if blank)" ${dirty ? "" : "disabled"}></textarea>
      <div class="muted small-label">${hint}</div>
      <div class="git-btns">
        <button class="mini-btn" id="git-commit-btn" type="button" ${dirty ? "" : "disabled"}>Commit</button>
        <button class="mini-btn" id="git-push-btn" type="button" ${ahead ? "" : "disabled"}>Push</button>
        <button class="mini-btn primary" id="git-both-btn" type="button" ${dirty ? "" : "disabled"}>Commit &amp; push</button>
      </div>
      <div id="git-result"></div>
    </div>`;
}

function bindGitActions(slug, notice) {
  const slot = $("#git-actions-slot");
  if (!slot) return;
  slot.innerHTML = `<div class="muted small-label">Checking working tree...</div>`;

  const banner = (ok, text) => {
    const el = $("#git-result");
    if (!el) return;
    el.className = "git-banner " + (ok ? "ok" : "err");
    el.textContent = text;
  };

  const refresh = (ok, text) => openProjectModal(slug, { ok, text });

  get(`/api/git-status?slug=${encodeURIComponent(slug)}`)
    .then((git) => {
      slot.innerHTML = renderGitActions(slug, git);
      if (notice) banner(notice.ok, notice.text);

      const msgEl = $("#git-msg");
      const commitBtn = $("#git-commit-btn");
      const pushBtn = $("#git-push-btn");
      const bothBtn = $("#git-both-btn");

      if (commitBtn && !commitBtn.disabled) {
        commitBtn.dataset.loadingLabel = "Committing...";
        commitBtn.addEventListener(
          "click",
          withLoading(commitBtn, async () => {
            const result = await post("/api/commit", { slug, message: msgEl.value });
            await refresh(true, `Committed ${result.hash}: ${result.subject}`);
          })
        );
      }
      if (pushBtn && !pushBtn.disabled) {
        pushBtn.dataset.loadingLabel = "Pushing...";
        pushBtn.addEventListener(
          "click",
          withLoading(pushBtn, async () => {
            const result = await post("/api/push", { slug });
            await refresh(true, result.message || "Pushed");
          })
        );
      }
      if (bothBtn && !bothBtn.disabled) {
        bothBtn.dataset.loadingLabel = "Working...";
        bothBtn.addEventListener(
          "click",
          withLoading(bothBtn, async () => {
            const committed = await post("/api/commit", { slug, message: msgEl.value });
            const pushed = await post("/api/push", { slug });
            await refresh(true, `Committed ${committed.hash} and ${pushed.message || "pushed"}`);
          })
        );
      }
    })
    .catch((e) => {
      slot.innerHTML = `<div class="git-banner err">${esc(e.message)}</div>`;
    });
}

function initModal() {
  $("#modal-close").addEventListener("click", () => $("#project-modal").classList.add("hidden"));
  $("#project-modal").addEventListener("click", (e) => {
    if (e.target.id === "project-modal") $("#project-modal").classList.add("hidden");
  });
}

// ---- Compute ----
async function loadCompute(fresh = false) {
  $("#compute-table-2 tbody").innerHTML = skeletonRows(3, 6);
  const compute = await get("/api/compute-status", { fresh });
  const body = $("#compute-table-2 tbody");
  body.innerHTML = compute
    .map(
      (c) => `<tr>
        <td>${c.name}</td>
        <td>${statusPill(c.status)}</td>
        <td>
          <button class="mini-btn" data-action="wake" data-slug="${c.slug}">Wake</button>
          <button class="mini-btn" data-action="pause" data-slug="${c.slug}">Pause</button>
        </td>
      </tr>`
    )
    .join("");

  $$('[data-action="wake"]').forEach((b) => {
    b.dataset.loadingLabel = "Waking...";
    b.addEventListener("click", withLoading(b, () => post("/api/wake", { slug: b.dataset.slug }).then(() => loadCompute(true))));
  });
  $$('[data-action="pause"]').forEach((b) => {
    b.dataset.loadingLabel = "Pausing...";
    b.addEventListener("click", withLoading(b, () => post("/api/pause", { slug: b.dataset.slug }).then(() => loadCompute(true))));
  });
}

// ---- Heartbeat ----
async function loadHeartbeat() {
  $("#heartbeat-table-2 tbody").innerHTML = skeletonRows(4, 6);
  const heartbeats = await get("/api/heartbeat-status");
  const body = $("#heartbeat-table-2 tbody");
  body.innerHTML = heartbeats
    .map((h) => {
      const days = h.daysLeft !== null && h.daysLeft !== undefined ? `${h.daysLeft.toFixed(1)}d` : "?";
      const last = h.lastAt ? new Date(h.lastAt).toLocaleString() : "never";
      return `<tr><td>${h.name}</td><td>${h.enabled ? "yes" : "no"}</td><td>${last}</td><td>${days}</td></tr>`;
    })
    .join("");
}

// ---- Activity ----
async function loadActivity(fetchRemotes, fresh = false) {
  $("#activity-table tbody").innerHTML = skeletonRows(5, 6);
  const activity = await get(`/api/last-push${fetchRemotes ? "?fetch=1" : ""}`, { fresh });
  const body = $("#activity-table tbody");
  body.innerHTML = activity
    .map((a) => {
      if (!a.ok) return `<tr><td>${a.name}</td><td colspan="4" class="muted">${a.error || "no data"}</td></tr>`;
      const when = a.lastPushAt ? new Date(a.lastPushAt).toLocaleString() : "?";
      const days = a.daysSincePush !== undefined ? a.daysSincePush.toFixed(1) : "?";
      const state = a.dirty ? "dirty" : "clean";
      return `<tr><td>${a.name}</td><td>${a.branch}</td><td>${when}</td><td>${days}</td><td>${state}</td></tr>`;
    })
    .join("");
}

// ---- Router ----
function loadView(view, fresh = false) {
  if (view === "overview") return loadOverview(fresh);
  else if (view === "identity") return loadIdentity();
  else if (view === "projects") return loadProjects();
  else if (view === "compute") return loadCompute(fresh);
  else if (view === "heartbeat") return loadHeartbeat();
  else if (view === "activity") return loadActivity(false, fresh);
}

function initButtons() {
  const refreshBtn = $("#refresh-btn");
  refreshBtn.dataset.loadingLabel = "Refreshing...";
  refreshBtn.addEventListener(
    "click",
    withLoading(refreshBtn, async () => {
      const active = $(".nav-item.active");
      if (active) await loadView(active.dataset.view, true); // bypass cache
    })
  );

  // Wake/pause/heartbeat mutate server state — the server already
  // invalidates its own cache for these, but we also request `fresh`
  // here so the very next render definitely reflects the change.
  const wakeAll1 = $("#wake-all-btn");
  wakeAll1 && wakeAll1.addEventListener("click", withLoading(wakeAll1, () => post("/api/wake-all").then(() => loadOverview(true))));

  const wakeAll2 = $("#wake-all-btn-2");
  wakeAll2 && wakeAll2.addEventListener("click", withLoading(wakeAll2, () => post("/api/wake-all").then(() => loadCompute(true))));

  const pauseIdle = $("#pause-idle-btn");
  pauseIdle && pauseIdle.addEventListener("click", withLoading(pauseIdle, () => post("/api/pause-idle").then(() => loadCompute(true))));

  const heartbeatAll = $("#heartbeat-all-btn");
  heartbeatAll && heartbeatAll.addEventListener("click", withLoading(heartbeatAll, () => post("/api/heartbeat").then(loadHeartbeat)));

  const fetchRefresh = $("#fetch-refresh-btn");
  fetchRefresh && fetchRefresh.addEventListener("click", withLoading(fetchRefresh, () => loadActivity(true, true)));

  // "View all →" buttons under the compact Overview tables jump to the full tab.
  $$(".view-all-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.goto;
      const navBtn = document.querySelector(`.nav-item[data-view="${view}"]`);
      if (navBtn) navBtn.click();
    });
  });

  // Stop server.
  const stopBtn = $("#stop-server-btn");
  stopBtn.addEventListener("click", async () => {
    if (!confirm("Stop the local sudowho dashboard server? You'll need to run `sudowho dashboard` again to reopen it.")) {
      return;
    }
    stopBtn.disabled = true;
    stopBtn.textContent = "Stopping...";
    try {
      await post("/api/shutdown");
    } catch (e) {
      // The server may close the connection before responding — that's expected.
    }
    $("#shutdown-overlay").classList.remove("hidden");
  });
}

initTheme();
initNav();
initButtons();
initModal();
loadOverview();
