// ===== SHARED STATE (persisted in sessionStorage) =====
const State = {
  masterHeaders: [],
  masterRows: [],
  idColumn: "",
  searchHistory: [],
  isFromServer: false,

  save() {
    try {
      sessionStorage.setItem("svs_state", JSON.stringify({
        masterHeaders: this.masterHeaders,
        masterRows: this.masterRows,
        idColumn: this.idColumn,
        searchHistory: this.searchHistory
      }));
    } catch (e) { console.warn("State too large to persist:", e); }
  },

  load() {
    const raw = sessionStorage.getItem("svs_state");
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.masterHeaders = data.masterHeaders || [];
      this.masterRows = data.masterRows || [];
      this.idColumn = data.idColumn || "";
      this.searchHistory = data.searchHistory || [];
      this.isFromServer = false;
      return this.masterRows.length > 0;
    } catch { return false; }
  },

  async loadFromServer() {
    try {
      const res = await fetch("data/master.json", { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data || !Array.isArray(data.rows) || data.rows.length === 0) return false;
      this.masterHeaders = data.headers || [];
      this.masterRows = data.rows || [];
      this.idColumn = data.idColumn || "";
      this.searchHistory = [];
      this.isFromServer = true;
      return true;
    } catch { return false; }
  },

  clear() {
    this.masterHeaders = [];
    this.masterRows = [];
    this.idColumn = "";
    this.searchHistory = [];
    this.isFromServer = false;
    sessionStorage.removeItem("svs_state");
  }
};

// Rebuild the lookup Map from persisted rows
let masterMap = new Map();
function rebuildMap() {
  masterMap = new Map();
  if (!State.idColumn) return;
  State.masterRows.forEach((row) => {
    const key = normalizeId(row[State.idColumn]);
    if (key && !masterMap.has(key)) masterMap.set(key, row);
  });
}

const $ = (id) => document.getElementById(id);
const show = (el, text) => { if (text !== undefined) el.textContent = text; el.classList.remove("hidden"); };
const hide = (el) => el.classList.add("hidden");

// ===== ICONS =====
const ICONS = {
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
  upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  download: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'
};
const icon = (name) => `<svg class="ico" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

// ===== SIDEBAR RENDERER =====
// Call renderSidebar("master") on master.html, etc.
function renderSidebar(active) {
  const links = [
    { href: "index.html",  key: "overview", icon: "grid",     label: "Overview" },
    { href: "master.html", key: "master",   icon: "database", label: "Master Data" },
    { href: "search.html", key: "search",   icon: "search",   label: "Search Student" },
    { href: "batch.html",  key: "batch",    icon: "layers",   label: "Batch Verification" }
  ];
  const nav = links.map(l =>
    `<a href="${l.href}" class="nav-link${l.key === active ? " active" : ""}">${icon(l.icon)}${l.label}</a>`
  ).join("");

  const html = `
    <div class="brand">
      <div class="brand-logo">${icon("shield")}</div>
      <div><strong>Student</strong><span>Verification System</span></div>
    </div>
    <nav>${nav}</nav>
    <div class="side-foot">
      <span class="dot" id="sideDot"></span>
      <div><strong id="sideStatus">No data loaded</strong><small>All data stays in this browser</small></div>
    </div>`;
  document.getElementById("sidebar").innerHTML = html;
  refreshSideStatus();
}

function refreshSideStatus() {
  const loaded = masterMap.size > 0;
  const dot = $("sideDot"), status = $("sideStatus");
  if (dot) dot.className = "dot" + (loaded ? " on" : "");
  if (status) status.textContent = loaded
    ? masterMap.size.toLocaleString() + " records ready"
    : "No data loaded";
}

// ===== UI HELPERS =====
function showAlert(el, message, type) {
  el.innerHTML = icon(type === "error" ? "x" : "alert") + "<span></span>";
  el.querySelector("span").textContent = message;
  el.classList.remove("hidden");
}

function toast(message, type) {
  const t = document.createElement("div");
  t.className = "toast" + (type === "error" ? " error" : "");
  t.textContent = message;
  $("toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
}

function animateNumber(el, to) {
  const from = parseInt(el.textContent.replace(/,/g, "")) || 0;
  const start = performance.now(), duration = 600;
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ===== ID NORMALIZATION =====
function normalizeId(value) {
  let s = String(value ?? "").replace(/[\u00A0\uFEFF]/g, " ").trim().replace(/\s+/g, "").toUpperCase();
  if (/^\d+\.0+$/.test(s)) s = s.split(".")[0];
  if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, "");
  return s;
}

function guessIdColumn(headers) {
  const clean = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const name of ["studentid", "id", "studentno", "rollno", "rollnumber", "regno", "registrationno", "enrollmentno"]) {
    const found = headers.find((h) => clean(h) === name);
    if (found) return found;
  }
  return headers.find((h) => clean(h).includes("id")) || headers[0];
}

function enableDrop(dropId, inputId, handler) {
  const zone = $(dropId);
  if (!zone) return;
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => { if (!$(inputId).disabled && e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]); });
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("Downloaded " + fileName);
}