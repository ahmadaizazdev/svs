document.addEventListener("DOMContentLoaded", async () => {
  // Try session first (admin's working copy), then fetch data/master.json
  let loaded = State.load();
  if (!loaded) loaded = await State.loadFromServer();

  rebuildMap();
  renderSidebar("master");
  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
  });

  function setLoadedUI(isLoaded) {
    $("masterPill").textContent = isLoaded ? "Loaded" : "Not loaded";
    $("masterPill").className = "pill " + (isLoaded ? "pill-on" : "pill-off");
    $("masterStatus").className = "status" + (isLoaded ? " on" : "");
    $("idColumnSelect").disabled = !isLoaded;
    $("downloadJson").disabled = !isLoaded;
    $("clearMaster").disabled = !isLoaded;
  }

  function showSource() {
    if (masterMap.size === 0) {
      $("masterSource").textContent = "";
      return;
    }
    $("masterSource").textContent = State.isFromServer
      ? "Source: data/master.json (published)"
      : "Source: local upload (not yet published)";
  }

  function fillIdSelect() {
    const sel = $("idColumnSelect");
    sel.innerHTML = "";
    State.masterHeaders.forEach((h) => sel.add(new Option(h, h)));
    if (State.idColumn) sel.value = State.idColumn;
  }

  function renderPreview() {
    if (!State.masterRows.length) { hide($("previewBox")); return; }
    const headers = State.masterHeaders.slice(0, 8);
    const rows = State.masterRows.slice(0, 20);
    const table = $("previewTable");
    table.innerHTML = "<tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
    rows.forEach(r => {
      const tr = table.insertRow();
      headers.forEach(h => tr.insertCell().textContent = String(r[h] ?? "").slice(0, 40));
    });
    $("previewCount").textContent = `Showing first ${rows.length} of ${State.masterRows.length} rows`;
    show($("previewBox"));
  }

  function buildIndexAndSave() {
    rebuildMap();
    if (!State.isFromServer) State.save();
    refreshSideStatus();
    setLoadedUI(true);
    showSource();

    const dupes = new Set(), seen = new Set();
    let emptyCount = 0;
    State.masterRows.forEach((row) => {
      const key = normalizeId(row[State.idColumn]);
      if (!key) { emptyCount++; return; }
      if (seen.has(key)) dupes.add(key); else seen.add(key);
    });
    const notes = [];
    if (dupes.size) notes.push(`${dupes.size} duplicate Student ID(s), first record is used`);
    if (emptyCount) notes.push(`${emptyCount} record(s) have empty Student ID and are ignored`);
    if (notes.length) showAlert($("masterWarning"), notes.join("  |  "), "warn");
    else hide($("masterWarning"));
    renderPreview();
  }

  function handleMasterFile(file) {
    hide($("masterError")); hide($("masterWarning"));
    if (typeof XLSX === "undefined") return showAlert($("masterError"), "Excel library not loaded.", "error");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
        if (!rows.length) throw new Error("The first sheet has no data rows.");

        State.masterHeaders = Object.keys(rows[0]);
        State.masterRows = rows;
        State.searchHistory = [];
        State.isFromServer = false;
        State.idColumn = guessIdColumn(State.masterHeaders);
        fillIdSelect();
        show($("idColumnRow"));
        buildIndexAndSave();
        toast("Master data loaded: " + State.masterRows.length.toLocaleString() + " records");
      } catch (err) {
        State.masterRows = []; State.masterHeaders = []; State.idColumn = "";
        State.clear();
        rebuildMap();
        setLoadedUI(false); refreshSideStatus(); showSource();
        showAlert($("masterError"), "Could not read this file. (" + err.message + ")", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  $("masterFile").addEventListener("change", (e) => {
    if (e.target.files[0]) handleMasterFile(e.target.files[0]);
    e.target.value = "";
  });
  enableDrop("masterDrop", "masterFile", handleMasterFile);

  $("idColumnSelect").addEventListener("change", (e) => {
    State.idColumn = e.target.value;
    State.searchHistory = [];
    buildIndexAndSave();
    toast("ID column changed to: " + State.idColumn);
  });

  $("downloadJson").addEventListener("click", () => {
    if (!State.masterRows.length) { toast("Nothing to download", "error"); return; }
    const json = {
      idColumn: State.idColumn,
      headers: State.masterHeaders,
      rows: State.masterRows,
      updatedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
    saveBlob(blob, "master.json");
    toast("Save this file as data/master.json in your repo and commit it");
  });

  $("clearMaster").addEventListener("click", () => {
    if (!confirm("Delete all master data? This cannot be undone.")) return;
    State.clear();
    rebuildMap();
    $("idColumnRow").classList.add("hidden");
    hide($("masterWarning")); hide($("masterError")); hide($("previewBox"));
    setLoadedUI(false);
    $("masterStatus").textContent = "Master data not loaded";
    refreshSideStatus();
    showSource();
    toast("Master data cleared");
  });

  if (loaded) {
    fillIdSelect();
    show($("idColumnRow"));
    setLoadedUI(true);
    $("masterStatus").textContent = `Master Data Loaded - ${State.masterRows.length} records`;
    renderPreview();
  } else {
    setLoadedUI(false);
  }
  showSource();
});