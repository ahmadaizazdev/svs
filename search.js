document.addEventListener("DOMContentLoaded", async () => {
  if (!State.load()) await State.loadFromServer();
  rebuildMap();
  renderSidebar("search");
  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
  });

  const loaded = masterMap.size > 0;
  $("searchInput").disabled = !loaded;
  $("searchBtn").disabled = !loaded;
  if (!loaded) {
    showAlert($("noDataNote"), "No master data loaded. Please upload the master Excel file on the Master Data page first.", "warn");
    $("searchInput").placeholder = "Upload master data first";
  } else {
    $("searchInput").focus();
  }

  function buildDetailsGrid(row) {
    const wrap = document.createElement("div");
    wrap.innerHTML = '<div class="details-title">STUDENT DETAILS</div>';
    const grid = document.createElement("div");
    grid.className = "details";
    State.masterHeaders.forEach((h, i) => {
      const tile = document.createElement("div");
      tile.className = "tile" + (h === State.idColumn ? " key" : "");
      tile.style.setProperty("--n", i);
      tile.innerHTML = "<small></small><span></span>";
      tile.querySelector("small").textContent = h;
      tile.querySelector("span").textContent = String(row[h] ?? "").trim() || "-";
      grid.appendChild(tile);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function renderHistory(newKey) {
    const table = $("historyTable");
    table.innerHTML = "<tr><th>#</th><th>Student ID</th><th>Status</th><th>Details</th></tr>";
    const firstOther = State.masterHeaders.find((h) => h !== State.idColumn);
    let i = 0;
    [...State.searchHistory].reverse().forEach(([key, item]) => {
      const tr = table.insertRow();
      if (key === newKey) tr.className = "new";
      tr.insertCell().textContent = State.searchHistory.length - i++;
      tr.insertCell().textContent = item.id;
      const st = tr.insertCell();
      st.innerHTML = '<span class="tag ' + (item.status === "Found" ? "found" : "notfound") + '"></span>';
      st.firstChild.textContent = item.status;
      tr.insertCell().textContent = item.rowIndex != null && firstOther
        ? State.masterRows[item.rowIndex]?.[firstOther] ?? ""
        : "";
    });
    $("historyCount").textContent = State.searchHistory.length;
    show($("historyBox"));
  }

  function doSearch() {
    if (masterMap.size === 0) { toast("Please upload master data first", "error"); return; }
    const raw = $("searchInput").value;
    const key = normalizeId(raw);
    if (!key) { toast("Please enter a Student ID", "error"); return; }

    const row = masterMap.get(key) || null;
    const rowIndex = row ? State.masterRows.indexOf(row) : null;

    const existingIdx = State.searchHistory.findIndex(([k]) => k === key);
    const entry = [key, { id: raw.trim(), status: row ? "Found" : "Not Found", rowIndex }];
    if (existingIdx >= 0) State.searchHistory[existingIdx] = entry;
    else State.searchHistory.push(entry);
    State.save();

    const box = $("searchResult");
    box.innerHTML = "";
    const banner = document.createElement("div");
    banner.className = "banner " + (row ? "found" : "notfound");
    banner.innerHTML = icon(row ? "check" : "x") + `<div><span></span><small></small></div>`;
    banner.querySelector("span").textContent = row ? "FOUND" : "NOT FOUND";
    banner.querySelector("small").textContent = "Student ID: " + raw.trim();
    box.appendChild(banner);
    if (row) box.appendChild(buildDetailsGrid(row));

    renderHistory(key);
    refreshSideStatus();
    $("searchInput").select();
  }

  $("searchBtn").addEventListener("click", doSearch);
  $("searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  if (State.searchHistory.length) renderHistory(null);
});