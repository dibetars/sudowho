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
  const [compute, heartbeats, profiles] = await Promise.all([
    get("/api/compute-status"),
    get("/api/heartbeat-status"),
    get("/api/profiles"),
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
    card.addEventListener("click", async () => {
      const profile = card.dataset.profile;
      const resultEl = $("#switch-result");
      resultEl.classList.remove("hidden");
      resultEl.textContent = `Switching to ${profile}...`;
      try {
        const result = await post("/api/switch", { profile });
        resultEl.textContent = JSON.stringify(result, null, 2);
      } catch (e) {
        resultEl.textContent = `Error: ${e.message}`;
      }
    });
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

  $$('[data-action="wake"]').forEach((b) => b.addEventListener("click", () => post("/api/wake", { slug: b.dataset.slug }).then(loadCompute)));
  $$('[data-action="pause"]').forEach((b) => b.addEventListener("click", () => post("/api/pause", { slug: b.dataset.slug }).then(loadCompute)));
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
  $("#refresh-btn").addEventListener("click", () => {
    const active = $(".nav-item.active");
    if (active) loadView(active.dataset.view);
  });
  $("#wake-all-btn")?.addEventListener("click", () => post("/api/wake-all").then(loadOverview));
  $("#wake-all-btn-2")?.addEventListener("click", () => post("/api/wake-all").then(loadCompute));
  $("#pause-idle-btn")?.addEventListener("click", () => post("/api/pause-idle").then(loadCompute));
  $("#heartbeat-all-btn")?.addEventListener("click", () => post("/api/heartbeat").then(loadHeartbeat));
  $("#fetch-refresh-btn")?.addEventListener("click", () => loadActivity(true));
}

initTheme();
initNav();
initButtons();
loadOverview();
