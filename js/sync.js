/* ============================================================
   Sarp Pitara — offline outbox / local sync engine
   No backend is required: records are acknowledged locally when
   the device is online. Export JSON/CSV is the portable sync.
   ============================================================ */
(function (global) {
  "use strict";
  const SP = (global.SP = global.SP || {});

  async function pendingCount() {
    const rows = await SP.DB.getOutbox();
    return rows.filter((r) => r.status === "PENDING").length;
  }

  async function flush() {
    if (!navigator.onLine) {
      throw new Error("Device is offline. Records remain queued in IndexedDB.");
    }
    const rows = await SP.DB.getOutbox();
    const pending = rows.filter((r) => r.status === "PENDING");
    const touched = new Set();
    for (const item of pending) {
      const m = item.mutation || {};
      if (!m.incident_id) continue;
      const inc = await SP.DB.getIncident(m.incident_id);
      if (inc) {
        inc.sync_status = "Synced";
        inc.client_updated_at = new Date().toISOString();
        await SP.DB.saveIncident(inc);
        touched.add(m.incident_id);
      }
    }
    let reconciled = 0;
    const incidents = await SP.DB.getIncidents();
    for (const inc of incidents) {
      if (inc.sync_status === "Synced" || touched.has(inc.incident_id)) continue;
      inc.sync_status = "Synced";
      inc.client_updated_at = new Date().toISOString();
      await SP.DB.saveIncident(inc);
      reconciled++;
    }
    await SP.DB.clearOutbox();
    return { synced: pending.length + reconciled, remaining: 0 };
  }

  async function summary() {
    const incidents = await SP.DB.getIncidents();
    const queued = incidents.filter((i) => i.sync_status !== "Synced").length;
    const outbox = await SP.DB.getOutbox();
    return {
      total: incidents.length,
      queued,
      synced: incidents.length - queued,
      outbox: outbox.length,
      online: navigator.onLine
    };
  }

  SP.Sync = { pendingCount, flush, summary };
})(window);
