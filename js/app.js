/* ============================================================
   Sarp Pitara — shared application utilities, HUD, demo data
   ============================================================ */
(function (global) {
  "use strict";

  const SP = (global.SP = global.SP || {});

  /* ---------- tiny DOM helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const el = (tag, attrs, html) => {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      if (k === "class") n.className = attrs[k];
      else if (k === "dataset") Object.assign(n.dataset, attrs[k]);
      else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  /* ---------- formatting ---------- */
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };
  const fmtDateTime = (iso) => (iso ? fmtDate(iso) + " · " + fmtTime(iso) : "—");
  const relTime = (iso) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return "—";
    const m = Math.round(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + "m ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.round(h / 24);
    if (d < 30) return d + "d ago";
    return fmtDate(iso);
  };
  const ageGroup = (age) => {
    const a = Number(age);
    if (isNaN(a)) return "Unknown";
    if (a <= 12) return "0–12 (Children)";
    if (a <= 25) return "13–25 (Youth)";
    if (a <= 50) return "26–50 (Adults)";
    return "50+ (Seniors)";
  };
  const timeBucket = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "Unknown";
    const h = d.getHours();
    if (h >= 4 && h < 10) return "Morning (4–10)";
    if (h >= 10 && h < 16) return "Afternoon (10–16)";
    if (h >= 16 && h < 20) return "Evening (16–20)";
    return "Night (20–4)";
  };
  const monthKey = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  };
  const monthLabel = (key) => {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  };
  const hoursBetween = (a, b) => {
    const d = (new Date(b) - new Date(a)) / 3600000;
    return isNaN(d) ? null : d;
  };
  const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  const haversine = (lat1, lng1, lat2, lng2) => {
    if ([lat1, lng1, lat2, lng2].some((v) => v == null || isNaN(v))) return null;
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  };

  /* ---------- toasts ---------- */
  function toast(title, message, type) {
    let wrap = $(".toast-wrap");
    if (!wrap) {
      wrap = el("div", { class: "toast-wrap" });
      document.body.appendChild(wrap);
    }
    const icons = { red: "⚠", amber: "◐", green: "✓", info: "ℹ" };
    const t = el("div", { class: "toast " + (type || "info") },
      '<div class="ico">' + (icons[type] || "ℹ") + '</div><div><strong>' + esc(title) + "</strong>" +
      (message ? '<div class="muted small">' + esc(message) + "</div>" : "") + "</div>");
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity .3s, transform .3s";
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
      setTimeout(() => t.remove(), 320);
    }, 4200);
  }

  /* ---------- JSON loading with cache ---------- */
  const jsonCache = {};
  function loadJSON(path) {
    if (jsonCache[path]) return jsonCache[path];
    jsonCache[path] = fetch(path, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error("Could not load " + path + " (" + r.status + ")");
      return r.json();
    });
    return jsonCache[path];
  }

  /* ---------- online / offline ---------- */
  function setOnlineStatus() {
    const on = navigator.onLine;
    $$(".status-dot[data-conn]").forEach((n) => {
      n.classList.toggle("offline", !on);
      n.innerHTML = "<i></i>" + (on ? "ONLINE · LOCAL DISK" : "OFFLINE · LOCAL DISK");
    });
  }

  /* ---------- language toggle ---------- */
  function applyLang(lang) {
    localStorage.setItem("sp_lang", lang);
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
    $$("[data-hi]").forEach((n) => {
      if (!n.dataset.en) n.dataset.en = n.textContent;
      n.textContent = lang === "hi" ? n.dataset.hi : n.dataset.en;
    });
    $$("[data-hi-html]").forEach((n) => {
      if (!n.dataset.enHtml) n.dataset.enHtml = n.innerHTML;
      n.innerHTML = lang === "hi" ? n.dataset.hiHtml : n.dataset.enHtml;
    });
    $$("[data-lang-btn]").forEach((b) => (b.textContent = lang === "hi" ? "EN" : "हिं"));
    document.dispatchEvent(new CustomEvent("sp:lang", { detail: { lang } }));
  }
  function currentLang() { return localStorage.getItem("sp_lang") || "en"; }
  function toggleLang() { applyLang(currentLang() === "hi" ? "en" : "hi"); }

  /* ---------- HUD ---------- */
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/></svg>',
    intake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    cases: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></svg>',
    hospital: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M12 8v4M10 10h4"/></svg>',
    snake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18c4 0 4-4 8-4s4 4 8 4M4 12c4 0 4-4 8-4s4 4 8 4M7 6h.01M17 6h.01"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>'
  };

  function navHTML(active) {
    const links = [
      ["index.html", "dashboard", "Dashboard", "डैशबोर्ड"],
      ["register-bite.html", "intake", "New Case", "नया केस"],
      ["case-directory.html", "cases", "Cases", "केस सूची"],
      ["asv-locator.html", "hospital", "ASV Locator", "अस्पताल"],
      ["snakes.html", "snake", "Snake Guide", "साँप गाइड"],
      ["export.html", "export", "Backup", "बैकअप"]
    ];
    return '<header class="hud">' +
      '<a class="brand" href="index.html" style="text-decoration:none;color:inherit">' +
        '<span class="brand-mark" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M3 17c3.5 0 3.5-3 7-3s3.5 3 7 3 4-1 4-1" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/><path d="M3 11c3.5 0 3.5-3 7-3s3.5 3 7 3 4-1 4-1" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/><circle cx="19.5" cy="6.5" r="1.4" fill="#10b981"/></svg>' +
        "</span>" +
        '<span><span class="brand-name">Sarp <span>Pitara</span></span><span class="brand-sub">Snakebite Surveillance · Jaunpur</span></span>' +
      "</a>" +
      '<nav class="nav-links">' + links.map((l) =>
        '<a href="' + l[0] + '" class="' + (l[0] === active ? "active" : "") + '">' + ICONS[l[1]] +
        '<span data-en="' + l[2] + '" data-hi="' + l[3] + '">' + l[2] + "</span></a>").join("") + "</nav>" +
      '<div class="hud-right">' +
        '<span class="status-dot" data-conn><i></i>ONLINE · LOCAL DISK</span>' +
        '<button class="btn btn-sm btn-ghost" data-lang-btn type="button" title="Switch language">हिं</button>' +
        '<a class="sos-btn" href="tel:108" title="Call 108 ambulance">🚑 <span class="full">SOS 108</span></a>' +
      "</div></header>";
  }

  function mountHUD(active) {
    const holder = $("#hud");
    if (holder) holder.outerHTML = navHTML(active || "");
    setOnlineStatus();
    applyLang(currentLang());
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-lang-btn]")) toggleLang();
    });
    window.addEventListener("online", () => { setOnlineStatus(); toast("Back online", "Queued records can now be exported or synced.", "green"); });
    window.addEventListener("offline", () => { setOnlineStatus(); toast("Offline mode", "Data is being saved to local IndexedDB.", "amber"); });
  }

  /* ---------- Demo data ---------- */
  const SPECIES = [
    { id: "snake-01", common: "Common Krait", sci: "Bungarus caeruleus", venom: "Neurotoxic", w: 26 },
    { id: "snake-02", common: "Spectacled Cobra", sci: "Naja naja", venom: "Neurotoxic", w: 20 },
    { id: "snake-03", common: "Russell's Viper", sci: "Daboia russelii", venom: "Hemotoxic", w: 18 },
    { id: "snake-04", common: "Saw-scaled Viper", sci: "Echis carinatus", venom: "Hemotoxic", w: 12 },
    { id: "snake-05", common: "Non-Venomous", sci: "Ptyas mucosa", venom: "NonVenomous", w: 16 },
    { id: "snake-06", common: "Unidentified", sci: "Indeterminate", venom: "Indeterminate", w: 8 }
  ];
  const TEHSILS = [
    { name: "Sadar", lat: 25.7464, lng: 82.6837, w: 30 },
    { name: "Shahganj", lat: 26.0481, lng: 82.6833, w: 15 },
    { name: "Badlapur", lat: 25.9723, lng: 82.4682, w: 17 },
    { name: "Machhlishahr", lat: 25.6798, lng: 82.4187, w: 16 },
    { name: "Mariahu", lat: 25.6032, lng: 82.6033, w: 12 },
    { name: "Kerakat", lat: 25.6399, lng: 82.9231, w: 10 }
  ];
  const HABITATS = ["Agricultural Field", "Indoor Residential", "Forest Trail", "Threshing Floor", "Water Body Edge"];
  const SITES = ["Right Foot - Ankle", "Left Foot - Ankle", "Right Lower Leg", "Left Lower Leg", "Right Hand - Finger", "Left Hand - Finger", "Right Arm", "Left Arm", "Other"];
  const SYMPTOMS = ["Local Swelling", "Local Pain", "Ptosis (Drooping Eyelids)", "Difficulty Breathing", "Difficulty Speaking", "Abdominal Pain", "Spontaneous Bleeding", "Blood in Urine", "Nausea / Vomiting", "Altered Sensorium"];
  const NAMES = ["Ramesh Kumar", "Suresh Yadav", "Aarti Devi", "Sunita Verma", "Mohammad Ali", "Rajesh Singh", "Pooja Gupta", "Anil Prajapati", "Kavita Yadav", "Vijay Kumar", "Sarita Devi", "Rakesh Maurya", "Neha Singh", "Dinesh Patel", "Meena Kumari", "Arjun Yadav", "Shalini Verma", "Ravi Shankar", "Geeta Devi", "Amit Chauhan"];

  function weightedPick(list) {
    const total = list.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const x of list) { if ((r -= x.w) <= 0) return x; }
    return list[list.length - 1];
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function randomInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  async function seedDemo(count) {
    count = count || 120;
    const facilities = await loadJSON("assets/data/hospitals_jaunpur.json");
    const villages = await loadJSON("assets/data/jaunpur_villages.json");
    const rows = [];
    const year = new Date().getFullYear();
    for (let i = 0; i < count; i++) {
      const sp = weightedPick(SPECIES);
      const tehsil = weightedPick(TEHSILS);
      const villagePool = villages.filter((v) => v.sub_district === tehsil.name);
      const village = villagePool.length ? pick(villagePool) : { village_name: "Unknown" };
      const daysAgo = Math.floor(Math.random() * 330);
      const bite = new Date(Date.now() - daysAgo * 86400000 - randomInt(0, 20) * 3600000);
      const age = weightedPick([
        { v: randomInt(3, 12), w: 14 }, { v: randomInt(13, 25), w: 30 },
        { v: randomInt(26, 50), w: 42 }, { v: randomInt(51, 82), w: 14 }
      ]).v;
      const isVenom = sp.venom === "Neurotoxic" || sp.venom === "Hemotoxic";
      const dry = isVenom && Math.random() < 0.2;
      const severe = isVenom && !dry && Math.random() < 0.32;
      const symptoms = [];
      if (!dry) {
        if (sp.venom === "Neurotoxic") {
          symptoms.push("Ptosis (Drooping Eyelids)");
          if (severe) symptoms.push("Difficulty Breathing");
          if (Math.random() < 0.4) symptoms.push("Difficulty Speaking");
        } else if (sp.venom === "Hemotoxic") {
          symptoms.push("Spontaneous Bleeding");
          if (severe) symptoms.push("Blood in Urine");
          if (Math.random() < 0.5) symptoms.push("Abdominal Pain");
        }
        if (Math.random() < 0.6) symptoms.push("Local Swelling");
      }
      const severity = !isVenom || dry ? (Math.random() < 0.5 ? "Asymptomatic" : "Mild") : severe ? "Severe" : "Moderate";
      const outcomeRoll = Math.random();
      let outcome;
      if (severity === "Severe" && outcomeRoll < 0.09) outcome = "Deceased";
      else if (outcomeRoll < 0.18) outcome = "Referred";
      else if (outcomeRoll < 0.3) outcome = "Left_Against_Medical_Advice";
      else if (outcomeRoll < 0.82) outcome = "Discharged_Recovered";
      else outcome = "Admitted";
      const delay = randomInt(20, 420);
      const vials = isVenom && !dry ? (severity === "Severe" ? randomInt(10, 30) : randomInt(10, 20)) : 0;
      const facPool = facilities.filter((f) => f.tehsil === tehsil.name);
      const fac = facPool.length ? pick(facPool) : pick(facilities);
      const id = SP.DB.uuid();
      rows.push({
        incident_id: id,
        case_number: "SP-" + year + "-" + String(i + 1).padStart(4, "0"),
        recorded_at: new Date(bite.getTime() + delay * 60000).toISOString(),
        bite_timestamp: bite.toISOString(),
        patient_name: pick(NAMES),
        age_years: age,
        gender: Math.random() < 0.62 ? "Male" : "Female",
        contact_number: "+91-9" + randomInt(100000000, 899999999),
        location_state_code: "UP",
        location_district: "Jaunpur",
        location_subdistrict: tehsil.name,
        location_village: village.village_name,
        latitude: tehsil.lat + (Math.random() - 0.5) * 0.08,
        longitude: tehsil.lng + (Math.random() - 0.5) * 0.08,
        habitat_context: pick(HABITATS),
        bite_anatomy_site: pick(SITES),
        fang_punctures_visible: isVenom ? Math.random() < 0.72 : Math.random() < 0.2,
        identified_taxon_id: sp.id,
        species_common_name: sp.common,
        species_scientific_name: sp.sci,
        suspected_venom_class: sp.venom,
        twentym_wbct_positive: sp.venom === "Hemotoxic" && !dry ? Math.random() < 0.78 : (isVenom ? Math.random() < 0.08 : false),
        initial_systolic_bp: randomInt(severe ? 70 : 100, severe ? 105 : 140),
        initial_diastolic_bp: randomInt(severe ? 40 : 60, severe ? 70 : 90),
        initial_heart_rate: randomInt(severe ? 105 : 60, severe ? 140 : 100),
        initial_spo2_percent: randomInt(severe ? 84 : 94, severe ? 96 : 100),
        respiratory_rate: randomInt(severe ? 22 : 12, severe ? 34 : 20),
        symptoms,
        triage_severity: severity,
        asv_vials_administered: vials,
        adverse_reaction_observed: vials > 0 && Math.random() < 0.12,
        facility_id: fac.facility_id,
        facility_name: fac.name,
        clinical_outcome: outcome,
        treatment_delay_minutes: delay,
        notes: dry ? "Dry bite suspected; observed for 24 hours." : "",
        client_created_at: new Date().toISOString(),
        client_updated_at: new Date().toISOString(),
        sync_version: 1,
        is_deleted: false,
        sync_status: Math.random() < 0.85 ? "Synced" : "LOCAL_QUEUED"
      });
    }
    for (const r of rows) {
      await SP.DB.saveIncident(r);
      if (r.sync_status !== "Synced") {
        await SP.DB.enqueue({ op: "UPSERT", incident_id: r.incident_id, case_number: r.case_number, at: new Date().toISOString() });
      }
    }
    return rows.length;
  }

  /* ---------- service worker ---------- */
  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  SP.$ = $;
  SP.$$ = $$;
  SP.el = el;
  SP.esc = esc;
  SP.fmt = { date: fmtDate, time: fmtTime, dateTime: fmtDateTime, rel: relTime, ageGroup, timeBucket, monthKey, monthLabel, hoursBetween, pct, haversine };
  SP.toast = toast;
  SP.loadJSON = loadJSON;
  SP.mountHUD = mountHUD;
  SP.setOnlineStatus = setOnlineStatus;
  SP.applyLang = applyLang;
  SP.currentLang = currentLang;
  SP.seedDemo = seedDemo;
  SP.registerSW = registerSW;
  SP.constants = { SPECIES, TEHSILS, HABITATS, SITES, SYMPTOMS, NAMES };

  document.addEventListener("DOMContentLoaded", () => {
    const active = document.body.dataset.page || "";
    mountHUD(active);
    registerSW();
  });
})(window);
