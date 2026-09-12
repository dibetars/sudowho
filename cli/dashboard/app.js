// sudowho local dashboard — vanilla JS, no build step, no external requests.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
const get = (path) => api(path);
const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

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
async function loadOverview() {
  const [compute, heartbeats, profiles, breakdown, heatmap] = await Promise.all([
    get("/api/compute-status"),
    get("/api/heartbeat-status"),
    get("/api/profiles"),
    get("/api/status-breakdown"),
    get("/api/activity-heatmap?days=70"),
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
    .map((c) => `<tr><td>${c.name}</td><td>${statusPill(c.status)}</td><td></td></tr>`)
    .join("");

  const hbBody = $("#heartbeat-table tbody");
  hbBody.innerHTML = heartbeats
    .map((h) => {
      const days = h.daysLeft !== null && h.daysLeft !== undefined ? `${h.daysLeft.toFixed(1)}d` : "?";
      const last = h.lastAt ? new Date(h.lastAt).toLocaleString() : "never";
      return `<tr><td>${h.name}</td><td>${last}</td><td>${days}</td></tr>`;
    })
    .join("");

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
function renderHeatmap(heatmap) {
  const entries = Object.entries(heatmap.counts || {});
  const total = entries.reduce((s, [, c]) => s + c, 0);
  $("#heatmap-total").textContent = `${total} commit${total === 1 ? "" : "s"}`;

  const el = $("#heatmap");
  if (!entries.length) {
    el.innerHTML = `<div class="risk-empty">No repos with a configured path yet.</div>`;
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
        resultEl.textContent = `Switching to ${profile}...`;
        try {
          const result = await post("/api/switch", { profile });
          resultEl.textContent = JSON.stringify(result, null, 2);
        } catch (e) {
          resultEl.textContent = `Error: ${e.message}`;
          throw e;
        }
      })
    );
  });
}

// ---- Projects ----
async function loadProjects() {
  const projects = await get("/api/projects");
  const body = $("#projects-table tbody");
  body.innerHTML = Object.entries(projects)
    .map(
      ([slug, p]) => `<tr><td>${slug}</td><td>${p.name}</td><td>${p.whoami || "-"}</td><td>${p.provider}</td><td>${p.account}</td></tr>`
    )
    .join("");
}

// ---- Compute ----
async function loadCompute() {
  const compute = await get("/api/compute-status");
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
    b.addEventListener("click", withLoading(b, () => post("/api/wake", { slug: b.dataset.slug }).then(loadCompute)));
  });
  $$('[data-action="pause"]').forEach((b) => {
    b.dataset.loadingLabel = "Pausing...";
    b.addEventListener("click", withLoading(b, () => post("/api/pause", { slug: b.dataset.slug }).then(loadCompute)));
  });
}

// ---- Heartbeat ----
async function loadHeartbeat() {
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
async function loadActivity(fetchRemotes) {
  const activity = await get(`/api/last-push${fetchRemotes ? "?fetch=1" : ""}`);
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
function loadView(view) {
  if (view === "overview") loadOverview();
  else if (view === "identity") loadIdentity();
  else if (view === "projects") loadProjects();
  else if (view === "compute") loadCompute();
  else if (view === "heartbeat") loadHeartbeat();
  else if (view === "activity") loadActivity(false);
}

function initButtons() {
  const refreshBtn = $("#refresh-btn");
  refreshBtn.dataset.loadingLabel = "Refreshing...";
  refreshBtn.addEventListener(
    "click",
    withLoading(refreshBtn, async () => {
      const active = $(".nav-item.active");
      if (active) await loadView(active.dataset.view);
    })
  );

  const wakeAll1 = $("#wake-all-btn");
  wakeAll1 && wakeAll1.addEventListener("click", withLoading(wakeAll1, () => post("/api/wake-all").then(loadOverview)));

  const wakeAll2 = $("#wake-all-btn-2");
  wakeAll2 && wakeAll2.addEventListener("click", withLoading(wakeAll2, () => post("/api/wake-all").then(loadCompute)));

  const pauseIdle = $("#pause-idle-btn");
  pauseIdle && pauseIdle.addEventListener("click", withLoading(pauseIdle, () => post("/api/pause-idle").then(loadCompute)));

  const heartbeatAll = $("#heartbeat-all-btn");
  heartbeatAll && heartbeatAll.addEventListener("click", withLoading(heartbeatAll, () => post("/api/heartbeat").then(loadHeartbeat)));

  const fetchRefresh = $("#fetch-refresh-btn");
  fetchRefresh && fetchRefresh.addEventListener("click", withLoading(fetchRefresh, () => loadActivity(true)));
}

initTheme();
initNav();
initButtons();
loadOverview();
