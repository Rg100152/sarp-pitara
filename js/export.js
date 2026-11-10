/* ============================================================
   Sarp Pitara — backup, export, import & local sync
   ============================================================ */
(function (global) {
  "use strict";
  const SP = global.SP;
  const $ = SP.$;
  const LAST_KEY = "sp_last_export";

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes());
  }

  function setLastExport() {
    const iso = new Date().toISOString();
    try { localStorage.setItem(LAST_KEY, iso); } catch (e) { /* ignore */ }
    renderLastExport();
  }
  function renderLastExport() {
    let v = null;
    try { v = localStorage.getItem(LAST_KEY); } catch (e) { /* ignore */ }
    $("#lastExport").textContent = v ? SP.fmt.dateTime(v) : "Never";
  }

  function tally(rows, key, fallback) {
    const map = {};
    rows.forEach((r) => {
      const k = r[key] || fallback;
      map[k] = (map[k] || 0) + 1;
    });
    return Object.keys(map).map((k) => ({ label: k, n: map[k] })).sort((a, b) => b.n - a.n);
  }

  function listHTML(items, total, badge) {
    if (!items.length) return '<div class="small muted">No records yet.</div>';
    return items.map((it) => {
      const pct = total ? Math.round((it.n / total) * 100) : 0;
      return '<div style="margin-bottom:9px"><div class="spread small"><span>' + SP.esc(it.label) + '</span><span class="mono">' + it.n + '</span></div>' +
        '<div class="bar" style="height:5px;margin-top:4px"><i style="width:' + pct + "%;background:" + (badge || "var(--accent)") + '"></i></div></div>';
    }).join("");
  }

  async function refresh() {
    const s = await SP.Sync.summary();
    $("#sTotal").textContent = s.total;
    $("#sSynced").textContent = s.synced;
    $("#sQueued").textContent = s.queued;
    $("#sOutbox").textContent = s.outbox;
    $("#outboxCount").textContent = s.outbox;
    $("#sTotalFoot").textContent = s.total ? "IndexedDB incidents · " + s.total + " records" : "IndexedDB incidents";
    const badge = $("#netBadge");
    badge.textContent = s.online ? "ONLINE" : "OFFLINE";
    badge.className = "badge " + (s.online ? "green" : "amber");

    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const mb = (est.usage || 0) / (1024 * 1024);
        $("#storageUse").textContent = mb < 1 ? Math.round((est.usage || 0) / 1024) + " KB" : mb.toFixed(2) + " MB";
      } catch (e) { $("#storageUse").textContent = "—"; }
    }

    const rows = await SP.DB.getIncidents();
    $("#snapSpecies").innerHTML = listHTML(tally(rows, "species_common_name", "Unidentified"), rows.length, "#22d3ee");
    $("#snapSeverity").innerHTML = listHTML(tally(rows, "triage_severity", "Not triaged"), rows.length, "#f59e0b");
    $("#snapOutcome").innerHTML = listHTML(tally(rows, "clinical_outcome", "Unknown"), rows.length, "#10b981");
    renderLastExport();
  }

  async function exportJSON() {
    const rows = await SP.DB.getIncidents();
    if (!rows.length) { SP.toast("Nothing to export", "Register a case or load demo data first.", "amber"); return; }
    SP.DB.downloadBlob(SP.DB.exportJSON(rows), "sarp_pitara_backup_" + stamp() + ".json", "application/json");
    setLastExport();
    SP.toast("JSON backup exported", rows.length + " records downloaded.", "green");
  }

  async function exportCSV() {
    const rows = await SP.DB.getIncidents();
    if (!rows.length) { SP.toast("Nothing to export", "Register a case or load demo data first.", "amber"); return; }
    const csv = "\uFEFF" + SP.DB.toCSV(rows);
    SP.DB.downloadBlob(csv, "sarp_pitara_cases_" + stamp() + ".csv", "text/csv;charset=utf-8");
    setLastExport();
    SP.toast("CSV exported", rows.length + " records ready for Excel.", "green");
  }

  async function importFile() {
    const file = $("#importFile").files[0];
    if (!file) return;
    const replace = $("#replaceMode").checked;
    if (replace && !confirm("Replace ALL local incidents with the backup? This cannot be undone.")) return;
    try {
      const text = await file.text();
      if (replace) await SP.DB.wipe();
      const n = await SP.DB.importJSON(text);
      $("#importFile").value = "";
      $("#importBtn").disabled = true;
      await refresh();
      SP.toast("Backup imported", n + " records restored" + (replace ? " (replaced local data)." : " (merged)."), "green");
    } catch (e) {
      SP.toast("Import failed", e.message, "red");
    }
  }

  async function syncNow() {
    const btn = $("#syncNow");
    btn.disabled = true;
    try {
      const res = await SP.Sync.flush();
      await refresh();
      SP.toast("Sync complete", res.synced + " queued records acknowledged locally.", "green");
    } catch (e) {
      SP.toast("Sync blocked", e.message, "amber");
    } finally {
      btn.disabled = false;
    }
  }

  async function clearOutbox() {
    if (!confirm("Clear the sync outbox? Pending mutation entries will be discarded; incident records stay intact.")) return;
    await SP.DB.clearOutbox();
    await refresh();
    SP.toast("Outbox cleared", "Incident records were not deleted.", "green");
  }

  async function wipeAll() {
    if (!confirm("Delete ALL incidents and the sync outbox from this browser? Export a backup first.")) return;
    if (!confirm("Final confirmation: this cannot be undone. Continue?")) return;
    await SP.DB.wipe();
    await refresh();
    SP.toast("Local data deleted", "Facility seed data is preserved.", "amber");
  }

  async function loadDemo() {
    if (!confirm("Load 120 synthetic incidents? Do not mix demo data with live surveillance records.")) return;
    const btn = $("#loadDemo");
    btn.disabled = true;
    btn.textContent = "Generating…";
    try {
      const n = await SP.seedDemo(120);
      await refresh();
      SP.toast("Demo data loaded", n + " synthetic incidents added.", "green");
    } catch (e) {
      SP.toast("Demo load failed", e.message, "red");
    } finally {
      btn.disabled = false;
      btn.textContent = "Load 120 sample incidents";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#exportJson").addEventListener("click", exportJSON);
    $("#exportCsv").addEventListener("click", exportCSV);
    $("#importFile").addEventListener("change", () => ($("#importBtn").disabled = !$("#importFile").files.length));
    $("#importBtn").addEventListener("click", importFile);
    $("#syncNow").addEventListener("click", syncNow);
    $("#clearOutbox").addEventListener("click", clearOutbox);
    $("#wipeAll").addEventListener("click", wipeAll);
    $("#loadDemo").addEventListener("click", loadDemo);
    $("#refreshBtn").addEventListener("click", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    refresh().catch((e) => SP.toast("Could not read database", e.message, "red"));
  });
})(window);
