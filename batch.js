document.addEventListener("DOMContentLoaded", async () => {
  if (!State.load()) await State.loadFromServer();
  rebuildMap();
  renderSidebar("batch");
  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
  });

  let foundRows = [], notFoundRows = [];

  const loaded = masterMap.size > 0;
  $("csvFile").disabled = !loaded;
  if (!loaded) {
    showAlert($("noDataNote"), "No master data loaded. Please upload the master Excel file on the Master Data page first.", "warn");
  }

  function setDownloads() {
    $("dlFound").disabled = $("dlFoundCsv").disabled = foundRows.length === 0;
    $("dlNotFound").disabled = $("dlNotFoundCsv").disabled = notFoundRows.length === 0;
  }
  setDownloads();

  function handleCsvFile(file) {
    hide($("batchError")); hide($("batchNote"));
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "string", raw: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const table = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
        if (!table.length) throw new Error("The CSV file is empty.");
        const cleaned = table[0].map((h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, ""));
        let col = cleaned.findIndex((h) => h === "studentid");
        if (col < 0) col = cleaned.findIndex((h) => h.includes("id"));
        const hasHeader = col >= 0;
        if (!hasHeader) col = 0;
        const dataRows = hasHeader ? table.slice(1) : table;
        await runBatch(dataRows.map((r) => String(r[col] ?? "").trim()));
      } catch (err) {
        hide($("progressBox"));
        showAlert($("batchError"), "Could not read this CSV file. (" + err.message + ")", "error");
      }
    };
    reader.readAsText(file);
  }

  $("csvFile").addEventListener("change", (e) => { if (e.target.files[0]) handleCsvFile(e.target.files[0]); e.target.value = ""; });
  enableDrop("csvDrop", "csvFile", handleCsvFile);

  async function runBatch(ids) {
    foundRows = []; notFoundRows = [];
    setDownloads();
    show($("progressBox"));

    const seen = new Set();
    let blanks = 0, repeats = 0;
    for (let i = 0; i < ids.length; i++) {
      const original = ids[i];
      const key = normalizeId(original);
      if (!key) { blanks++; continue; }
      if (seen.has(key)) { repeats++; continue; }
      seen.add(key);
      const row = masterMap.get(key);
      if (row) foundRows.push(row);
      else notFoundRows.push({ "Student ID": original, Status: "Not Found" });

      if (i % 500 === 0) {
        $("progressFill").style.width = Math.round((i / ids.length) * 100) + "%";
        $("progressText").textContent = `Processing ${i} of ${ids.length}`;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    $("progressFill").style.width = "100%";
    setTimeout(() => hide($("progressBox")), 400);

    const total = seen.size;
    animateNumber($("sumTotal"), total);
    animateNumber($("sumFound"), foundRows.length);
    animateNumber($("sumNotFound"), notFoundRows.length);
    const pct = total ? Math.round((foundRows.length / total) * 100) : 0;
    $("sumPct").textContent = pct + "%";
    $("donutFound").style.strokeDashoffset = 326.7 * (1 - (total ? foundRows.length / total : 0));

    const notes = [];
    if (blanks) notes.push(`${blanks} blank line(s) skipped`);
    if (repeats) notes.push(`${repeats} repeated ID(s) counted once`);
    if (total === 0) notes.push("No Student IDs were found in the file");
    if (notes.length) showAlert($("batchNote"), notes.join(", ") + ".", "warn");

    setDownloads();
    toast(`Batch complete: ${foundRows.length} found, ${notFoundRows.length} not found`);
  }

  const NF_HEADERS = ["Student ID", "Status"];

  function downloadExcel(rows, headers, sheetName, fileName) {
    try {
      const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveBlob(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
    } catch (err) { toast("Download failed: " + err.message, "error"); }
  }

  function downloadCsv(rows, headers, fileName) {
    try {
      const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows, { header: headers }));
      saveBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), fileName);
    } catch (err) { toast("Download failed: " + err.message, "error"); }
  }

  $("dlFound").addEventListener("click", () => downloadExcel(foundRows, State.masterHeaders, "Found", "Found.xlsx"));
  $("dlNotFound").addEventListener("click", () => downloadExcel(notFoundRows, NF_HEADERS, "Not Found", "Not_Found.xlsx"));
  $("dlFoundCsv").addEventListener("click", () => downloadCsv(foundRows, State.masterHeaders, "Found.csv"));
  $("dlNotFoundCsv").addEventListener("click", () => downloadCsv(notFoundRows, NF_HEADERS, "Not_Found.csv"));
});
