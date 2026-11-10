/* ============================================================
   Sarp Pitara — IndexedDB driver & local repository
   Stores: incidents, facilities, sync_outbox
   ============================================================ */
(function (global) {
  "use strict";

  const DB_NAME = "sarp_pitara_db";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in global)) {
        reject(new Error("IndexedDB is not supported in this browser."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("incidents")) {
          const store = db.createObjectStore("incidents", { keyPath: "incident_id" });
          store.createIndex("sync_status", "sync_status", { unique: false });
          store.createIndex("district", "location_district", { unique: false });
          store.createIndex("tehsil", "location_subdistrict", { unique: false });
          store.createIndex("timestamp", "bite_timestamp", { unique: false });
          store.createIndex("case_number", "case_number", { unique: true });
        }
        if (!db.objectStoreNames.contains("facilities")) {
          const f = db.createObjectStore("facilities", { keyPath: "facility_id" });
          f.createIndex("tehsil", "tehsil", { unique: false });
          f.createIndex("type", "type", { unique: false });
        }
        if (!db.objectStoreNames.contains("sync_outbox")) {
          const o = db.createObjectStore("sync_outbox", { keyPath: "queue_id", autoIncrement: true });
          o.createIndex("status", "status", { unique: false });
          o.createIndex("created_at", "created_at", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
    });
    return dbPromise;
  }

  function tx(storeNames, mode) {
    return open().then((db) => db.transaction(storeNames, mode));
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getAll(storeName) {
    return tx(storeName, "readonly").then((t) => wrap(t.objectStore(storeName).getAll()));
  }

  function get(storeName, key) {
    return tx(storeName, "readonly").then((t) => wrap(t.objectStore(storeName).get(key)));
  }

  function put(storeName, value) {
    return tx(storeName, "readwrite").then((t) => {
      t.objectStore(storeName).put(value);
      return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve(value);
        t.onerror = () => reject(t.error);
      });
    });
  }

  function add(storeName, value) {
    return tx(storeName, "readwrite").then((t) => {
      t.objectStore(storeName).add(value);
      return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve(value);
        t.onerror = () => reject(t.error);
      });
    });
  }

  function del(storeName, key) {
    return tx(storeName, "readwrite").then((t) => {
      t.objectStore(storeName).delete(key);
      return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    });
  }

  function clear(storeName) {
    return tx(storeName, "readwrite").then((t) => {
      t.objectStore(storeName).clear();
      return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    });
  }

  function count(storeName) {
    return tx(storeName, "readonly").then((t) => wrap(t.objectStore(storeName).count()));
  }

  /* ---------- Case numbers ---------- */
  function nextCaseNumber() {
    const year = new Date().getFullYear();
    return getAll("incidents").then((rows) => {
      const prefix = "SP-" + year + "-";
      let max = 0;
      rows.forEach((r) => {
        if (r.case_number && r.case_number.indexOf(prefix) === 0) {
          const n = parseInt(r.case_number.slice(prefix.length), 10);
          if (!isNaN(n) && n > max) max = n;
        }
      });
      return prefix + String(max + 1).padStart(4, "0");
    });
  }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /* ---------- Incidents ---------- */
  function saveIncident(incident) {
    return put("incidents", incident);
  }

  function deleteIncident(id) {
    return del("incidents", id);
  }

  function getIncident(id) {
    return get("incidents", id);
  }

  function getIncidents() {
    return getAll("incidents").then((rows) =>
      rows.sort((a, b) => new Date(b.bite_timestamp) - new Date(a.bite_timestamp))
    );
  }

  /* ---------- Facilities ---------- */
  function getFacilities() {
    return getAll("facilities");
  }

  async function seedFacilities(facilities) {
    const existing = await count("facilities");
    if (existing > 0) return existing;
    await Promise.all(facilities.map((f) => put("facilities", f)));
    return facilities.length;
  }

  /* ---------- Sync outbox ---------- */
  function enqueue(mutation) {
    return add("sync_outbox", {
      status: "PENDING",
      created_at: new Date().toISOString(),
      mutation
    });
  }

  function getOutbox() {
    return getAll("sync_outbox").then((rows) => rows.sort((a, b) => a.queue_id - b.queue_id));
  }

  function clearOutbox() {
    return clear("sync_outbox");
  }

  /* ---------- Export / import ---------- */
  function downloadBlob(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function toCSV(rows) {
    if (!rows.length) return "";
    const flat = rows.map((r) => {
      const o = {};
      o.case_number = r.case_number || "";
      o.incident_id = r.incident_id || "";
      o.bite_timestamp = r.bite_timestamp || "";
      o.patient_name = r.patient_name || "";
      o.age_years = r.age_years != null ? r.age_years : "";
      o.gender = r.gender || "";
      o.contact_number = r.contact_number || "";
      o.state = r.location_state_code || "";
      o.district = r.location_district || "";
      o.tehsil = r.location_subdistrict || "";
      o.village = r.location_village || "";
      o.lat = r.latitude != null ? r.latitude : "";
      o.lng = r.longitude != null ? r.longitude : "";
      o.habitat = r.habitat_context || "";
      o.bite_site = r.bite_anatomy_site || "";
      o.fang_marks = r.fang_punctures_visible === true ? "Yes" : r.fang_punctures_visible === false ? "No" : "";
      o.species = r.species_common_name || "";
      o.scientific_name = r.species_scientific_name || "";
      o.venom_class = r.suspected_venom_class || "";
      o.wbct_positive = r.twentym_wbct_positive === true ? "Positive" : r.twentym_wbct_positive === false ? "Negative" : "";
      o.symptoms = (r.symptoms || []).join("; ");
      o.severity = r.triage_severity || "";
      o.asv_vials = r.asv_vials_administered != null ? r.asv_vials_administered : 0;
      o.hospital = r.facility_name || "";
      o.outcome = r.clinical_outcome || "";
      o.sync_status = r.sync_status || "";
      return o;
    });
    const headers = Object.keys(flat[0]);
    const esc = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [headers.join(",")].concat(flat.map((r) => headers.map((h) => esc(r[h])).join(","))).join("\r\n");
  }

  function exportJSON(rows) {
    return JSON.stringify({ app: "Sarp Pitara", exported_at: new Date().toISOString(), incidents: rows }, null, 2);
  }

  async function importJSON(text) {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : parsed.incidents;
    if (!Array.isArray(rows)) throw new Error("Invalid backup file: missing incidents array.");
    let imported = 0;
    for (const r of rows) {
      if (!r || !r.incident_id) continue;
      await put("incidents", r);
      imported++;
    }
    return imported;
  }

  async function wipe() {
    await clear("incidents");
    await clear("sync_outbox");
  }

  global.SP = global.SP || {};
  global.SP.DB = {
    DB_NAME,
    open,
    getIncidents,
    getIncident,
    saveIncident,
    deleteIncident,
    nextCaseNumber,
    uuid,
    getFacilities,
    seedFacilities,
    enqueue,
    getOutbox,
    clearOutbox,
    downloadBlob,
    toCSV,
    exportJSON,
    importJSON,
    wipe,
    count
  };
})(window);
