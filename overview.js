document.addEventListener("DOMContentLoaded", async () => {
  if (!State.load()) await State.loadFromServer();
  rebuildMap();
  renderSidebar("overview");

  document.querySelectorAll("[data-icon]").forEach((el) => {
    if (!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon));
  });

  function updateKpis() {
    let found = 0, notFound = 0;
    State.searchHistory.forEach(([, h]) => (h.status === "Found" ? found++ : notFound++));
    animateNumber($("kpiRecords"), masterMap.size);
    animateNumber($("kpiSearched"), State.searchHistory.length);
    animateNumber($("kpiFound"), found);
    animateNumber($("kpiNotFound"), notFound);
  }
  updateKpis();

  function getRowsByStatus(status) {
    const rows = [];
    State.searchHistory.forEach(([, h]) => {
      if (h.status !== status) return;
      if (h.rowIndex != null && State.masterRows[h.rowIndex]) {
        rows.push(State.masterRows[h.rowIndex]);
      } else {
        rows.push({ "Student ID": h.id, Status: "Not Found" });
      }
    });
    return rows;
  }

  function downloadExcel(rows, headers, sheetName, fileName) {
    if (!rows.length) { toast("Nothing to download", "error"); return; }
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveBlob(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName);
  }

  $("kpiFoundCard").addEventListener("click", () => {
    downloadExcel(getRowsByStatus("Found"), State.masterHeaders, "Found", "Found_List.xlsx");
  });

  $("kpiNotFoundCard").addEventListener("click", () => {
    downloadExcel(getRowsByStatus("Not Found"), ["Student ID", "Status"], "Not Found", "Not_Found_List.xlsx");
  });

  $("resetBtn").addEventListener("click", () => {
    State.clear();
    rebuildMap();
    updateKpis();
    refreshSideStatus();
    toast("Everything has been cleared");
  });
});