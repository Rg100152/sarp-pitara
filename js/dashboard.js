/* ============================================================
   Sarp Pitara — district command dashboard
   ============================================================ */
(function (global) {
  "use strict";
  const SP = global.SP;
  const $ = SP.$;

  let incidents = [];
  let facilities = [];

  const SPECIES_COLORS = {
    "Common Krait": "#f59e0b",
    "Spectacled Cobra": "#fbbf24",
    "Russell's Viper": "#ef4444",
    "Saw-scaled Viper": "#dc2626",
    "Non-Venomous": "#10b981",
    "Unidentified": "#a78bfa"
  };
  const VENOM_COLORS = {
    Neurotoxic: "#f59e0b",
    Hemotoxic: "#ef4444",
    NonVenomous: "#10b981",
    Indeterminate: "#a78bfa",
    Mixed: "#22d3ee",
    Cytotoxic: "#f472b6"
  };

  function countBy(rows, fn) {
    const map = new Map();
    rows.forEach((r) => {
      const k = fn(r) || "Unknown";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }

  function renderKPIs() {
    const total = incidents.length;
    const active = incidents.filter((i) => ["Admitted", "Referred", "Under Treatment", "Under Observation"].includes(i.clinical_outcome)).length;
    const critical = incidents.filter((i) => i.triage_severity === "Severe" && ["Admitted", "Referred"].includes(i.clinical_outcome)).length;
    const recovered = incidents.filter((i) => i.clinical_outcome === "Discharged_Recovered").length;
    const deceased = incidents.filter((i) => i.clinical_outcome === "Deceased").length;
    const vials = incidents.reduce((s, i) => s + (Number(i.asv_vials_administered) || 0), 0);
    const delays = incidents.map((i) => Number(i.treatment_delay_minutes)).filter((n) => !isNaN(n) && n >= 0);
    const avgDelay = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null;
    const venomous = incidents.filter((i) => ["Neurotoxic", "Hemotoxic", "Mixed", "Cytotoxic"].includes(i.suspected_venom_class)).length;
    const queued = incidents.filter((i) => i.sync_status !== "Synced").length;

    $("#kpi-total").textContent = total.toLocaleString("en-IN");
    $("#kpi-total-foot").textContent = total ? incidents.filter((i) => new Date(i.bite_timestamp).getFullYear() === new Date().getFullYear()).length + " this year" : "No incidents recorded";

    $("#kpi-active").textContent = active.toLocaleString("en-IN");
    $("#kpi-active-foot").textContent = critical + " critical";

    $("#kpi-recovered").textContent = recovered.toLocaleString("en-IN");
    $("#kpi-recovered-foot").textContent = total ? SP.fmt.pct(recovered, total) + "% recovery" : "0% recovery";

    $("#kpi-fatal").textContent = deceased.toLocaleString("en-IN");
    $("#kpi-fatal-foot").textContent = total ? SP.fmt.pct(deceased, total) + "% fatality rate" : "0% fatality rate";

    $("#kpi-asv").textContent = vials.toLocaleString("en-IN");
    $("#kpi-asv-foot").textContent = total ? (vials / Math.max(1, total)).toFixed(1) + " vials / case" : "District consumption";

    $("#kpi-delay").textContent = avgDelay != null ? (avgDelay >= 60 ? (avgDelay / 60).toFixed(1) + " h" : avgDelay + " min") : "—";
    $("#kpi-delay-foot").textContent = avgDelay != null && avgDelay > 120 ? "Above 2-hour golden window" : "Within golden hour target";
    $("#kpi-delay-foot").className = "foot " + (avgDelay != null && avgDelay > 120 ? "up" : "ok");

    $("#kpi-venom").textContent = total ? SP.fmt.pct(venomous, total) + "%" : "0%";
    $("#kpi-venom-foot").textContent = venomous + " venomous cases";

    $("#kpi-queue").textContent = queued;
    $("#kpi-queue-foot").textContent = queued ? "Pending local sync" : "All records synced";
  }

  function renderTrend() {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleDateString("en-IN", { month: "short" }) });
    }
    const counts = countBy(incidents, (i) => SP.fmt.monthKey(i.bite_timestamp));
    const points = months.map((m) => ({ label: m.label, value: counts.get(m.key) || 0 }));
    const current = points[points.length - 1].value;
    $("#trendBadge").textContent = current + " THIS MONTH";
    SP.Charts.line($("#trendChart"), points, { height: 240, color: "#ef4444" });
  }

  function renderSpecies() {
    const counts = countBy(incidents, (i) => i.species_common_name || "Unknown");
    const order = ["Common Krait", "Spectacled Cobra", "Russell's Viper", "Saw-scaled Viper", "Non-Venomous", "Unidentified"];
    const data = order.map((k) => ({ label: k, value: counts.get(k) || 0, color: SPECIES_COLORS[k] }));
    counts.forEach((v, k) => { if (!order.includes(k)) data.push({ label: k, value: v, color: "#60a5fa" }); });
    const total = incidents.length;
    SP.Charts.doughnut($("#speciesChart"), data, { height: 220, centerValue: total, centerLabel: "CASES" });
    $("#speciesLegend").innerHTML = data.filter((d) => d.value > 0).map((d) =>
      '<span class="item"><i class="swatch" style="background:' + d.color + '"></i>' + SP.esc(d.label) + " · " + d.value + "</span>"
    ).join("") || '<span class="item muted">No data</span>';
  }

  function renderVenom() {
    const counts = countBy(incidents, (i) => i.suspected_venom_class || "Indeterminate");
    const data = ["Neurotoxic", "Hemotoxic", "NonVenomous", "Indeterminate"].map((k) => ({
      label: k === "NonVenomous" ? "Non-Venomous" : k,
      value: counts.get(k) || 0,
      color: VENOM_COLORS[k]
    }));
    const total = incidents.length;
    SP.Charts.doughnut($("#venomChart"), data, { height: 220, centerValue: total ? SP.fmt.pct((data[0].value + data[1].value), total) + "%" : "0%", centerLabel: "VENOMOUS" });
    $("#venomLegend").innerHTML = data.filter((d) => d.value > 0).map((d) =>
      '<span class="item"><i class="swatch" style="background:' + d.color + '"></i>' + SP.esc(d.label) + " · " + d.value + "</span>"
    ).join("") || '<span class="item muted">No data</span>';
  }

  function renderTime() {
    const order = ["Morning (4–10)", "Afternoon (10–16)", "Evening (16–20)", "Night (20–4)"];
    const colors = ["#22d3ee", "#f59e0b", "#f472b6", "#ef4444"];
    const counts = countBy(incidents, (i) => SP.fmt.timeBucket(i.bite_timestamp));
    const data = order.map((k, idx) => ({ label: k, value: counts.get(k) || 0, color: colors[idx] }));
    SP.Charts.bars($("#timeChart"), data, { height: 220 });
  }

  function renderAgeGender() {
    const groups = [
      ["0–12 (Children)", (a) => a <= 12, "#22d3ee"],
      ["13–25 (Youth)", (a) => a > 12 && a <= 25, "#10b981"],
      ["26–50 (Adults)", (a) => a > 25 && a <= 50, "#f59e0b"],
      ["50+ (Seniors)", (a) => a > 50, "#ef4444"]
    ];
    const max = Math.max(1, ...groups.map((g) => incidents.filter((i) => g[1](Number(i.age_years))).length));
    $("#ageBars").innerHTML = groups.map((g) => {
      const n = incidents.filter((i) => g[1](Number(i.age_years))).length;
      return '<div class="bar-row"><span>' + g[0] + '</span><span class="bar"><i style="width:' + Math.round((n / max) * 100) + "%;background:" + g[2] + '"></i></span><span class="num">' + n + "</span></div>";
    }).join("");

    const male = incidents.filter((i) => i.gender === "Male").length;
    const female = incidents.filter((i) => i.gender === "Female").length;
    const other = incidents.length - male - female;
    $("#genderStats").innerHTML =
      '<div class="s"><span class="n" style="color:#60a5fa">' + male + '</span><span class="l">Male</span></div>' +
      '<div class="s"><span class="n" style="color:#f472b6">' + female + '</span><span class="l">Female</span></div>' +
      '<div class="s"><span class="n" style="color:#a78bfa">' + other + '</span><span class="l">Other</span></div>' +
      '<div class="s"><span class="n">' + (incidents.length ? Math.round((male / incidents.length) * 100) : 0) + '%</span><span class="l">Male share</span></div>';
  }

  function renderStream() {
    const rows = incidents.slice(0, 8);
    if (!rows.length) {
      $("#stream").innerHTML = '<div class="empty"><div class="big">◌</div>No incidents yet.</div>';
      return;
    }
    $("#stream").innerHTML = rows.map((i) => {
      const color = i.triage_severity === "Severe" ? "#ef4444" : i.suspected_venom_class === "Hemotoxic" ? "#ef4444" : i.suspected_venom_class === "Neurotoxic" ? "#f59e0b" : i.suspected_venom_class === "NonVenomous" ? "#10b981" : "#a78bfa";
      return '<div class="stream-item">' +
        '<span class="stream-dot" style="background:' + color + ';color:' + color + '"></span>' +
        '<div style="min-width:0;flex:1">' +
          '<div class="meta"><span>' + SP.esc(i.case_number || "—") + "</span><span>" + SP.fmt.rel(i.bite_timestamp) + "</span><span>" + SP.esc(i.location_subdistrict || "") + "</span></div>" +
          '<div class="title">' + SP.esc(i.species_common_name || "Unknown") + " · " + (i.asv_vials_administered || 0) + " ASV</div>" +
          '<div class="sub">' + SP.esc(i.patient_name || "Anonymous") + ", " + (i.age_years != null ? i.age_years : "?") + SP.esc((i.gender || "").charAt(0)) + " · " + SP.esc((i.clinical_outcome || "").replace(/_/g, " ")) + "</div>" +
        "</div>" +
        '<span class="badge ' + (i.triage_severity === "Severe" ? "red" : i.triage_severity === "Moderate" ? "amber" : "green") + '">' + SP.esc(i.triage_severity || "—") + "</span>" +
      "</div>";
    }).join("");
  }

  function renderASV() {
    const byTehsil = {};
    facilities.forEach((f) => {
      if (!byTehsil[f.tehsil]) byTehsil[f.tehsil] = { stock: 0, count: 0, low: 0 };
      byTehsil[f.tehsil].stock += Number(f.asv_stock_available) || 0;
      byTehsil[f.tehsil].count++;
      if (Number(f.asv_stock_available) < 20) byTehsil[f.tehsil].low++;
    });
    const entries = Object.entries(byTehsil).sort((a, b) => b[1].stock - a[1].stock);
    const max = Math.max(1, ...entries.map((e) => e[1].stock));
    $("#asvRadar").innerHTML = entries.map(([name, v]) => {
      const color = v.stock < 20 ? "#ef4444" : v.stock < 60 ? "#f59e0b" : "#10b981";
      return '<div class="bar-row" style="grid-template-columns:86px 1fr 62px">' +
        "<span>" + SP.esc(name) + "</span>" +
        '<span class="bar"><i style="width:' + Math.max(3, Math.round((v.stock / max) * 100)) + "%;background:" + color + '"></i></span>' +
        '<span class="num">' + v.stock + " vials</span></div>";
    }).join("") || '<div class="muted small">No facility data.</div>';

    const low = facilities.filter((f) => Number(f.asv_stock_available) < 20);
    const totalStock = facilities.reduce((s, f) => s + (Number(f.asv_stock_available) || 0), 0);
    const alert = $("#stockAlert");
    alert.textContent = low.length ? low.length + " LOW" : totalStock + " VIALS";
    alert.className = "badge " + (low.length ? "red" : "green");
  }

  function renderMap() {
    const counts = countBy(incidents, (i) => i.location_subdistrict || "Unknown");
    const tehsils = SP.constants.TEHSILS;
    const max = Math.max(1, ...tehsils.map((t) => counts.get(t.name) || 0));
    const hot = tehsils.slice().sort((a, b) => (counts.get(b.name) || 0) - (counts.get(a.name) || 0))[0];
    $("#hotTehsil").textContent = hot ? "HOTSPOT: " + hot.name.toUpperCase() : "NO DATA";

    const W = 620, H = 340, pad = 46;
    const lats = tehsils.map((t) => t.lat), lngs = tehsils.map((t) => t.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const px = (lng) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - pad * 2);
    const py = (lat) => H - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (H - pad * 2);

    let nodes = "";
    tehsils.forEach((t) => {
      const n = counts.get(t.name) || 0;
      const r = 7 + (n / max) * 15;
      const color = n === 0 ? "#475569" : n / max > 0.66 ? "#ef4444" : n / max > 0.33 ? "#f59e0b" : "#10b981";
      const x = px(t.lng), y = py(t.lat);
      nodes += '<g class="map-node" data-tehsil="' + SP.esc(t.name) + '" tabindex="0" role="link" aria-label="' + SP.esc(t.name) + ": " + n + ' cases">' +
        '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 7) + '" fill="' + color + '" opacity="0.12"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + color + '" opacity="0.9" stroke="#0b0f17" stroke-width="2"/>' +
        '<text x="' + x + '" y="' + (y + 3.5) + '" text-anchor="middle" fill="#0b0f17" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700">' + n + "</text>" +
        '<text x="' + x + '" y="' + (y + r + 16) + '" text-anchor="middle" fill="#cbd5e1" font-family="Inter, sans-serif" font-size="11">' + SP.esc(t.name) + "</text>" +
        "</g>";
    });

    $("#tehsilMap").innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="rgba(148,163,184,.08)" stroke-width="1"/></pattern></defs>' +
        '<rect width="' + W + '" height="' + H + '" fill="url(#grid)"/>' +
        '<rect x="18" y="14" width="' + (W - 36) + '" height="' + (H - 28) + '" rx="18" fill="none" stroke="rgba(148,163,184,.2)" stroke-dasharray="6 7"/>' +
        '<text x="34" y="36" fill="#64748b" font-family="JetBrains Mono, monospace" font-size="9" letter-spacing="2">JAUNPUR DISTRICT · SCHEMATIC</text>' +
        nodes +
      "</svg>" +
      '<div class="map-legend"><div class="item"><i style="background:#10b981"></i>Low cluster</div><div class="item"><i style="background:#f59e0b"></i>Moderate</div><div class="item"><i style="background:#ef4444"></i>Hotspot</div><div class="item"><i style="background:#475569"></i>No cases</div></div>';

    SP.$$("#tehsilMap .map-node").forEach((n) => {
      const go = () => (location.href = "asv-locator.html?tehsil=" + encodeURIComponent(n.dataset.tehsil));
      n.addEventListener("click", go);
      n.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
  }

  function renderAll() {
    renderKPIs();
    renderTrend();
    renderSpecies();
    renderVenom();
    renderTime();
    renderAgeGender();
    renderStream();
    renderASV();
    renderMap();
    const empty = incidents.length === 0;
    $("#emptyState").style.display = empty ? "block" : "none";
  }

  async function load() {
    incidents = await SP.DB.getIncidents();
    facilities = await SP.DB.getFacilities();
    if (!facilities.length) {
      try {
        const seed = await SP.loadJSON("assets/data/hospitals_jaunpur.json");
        await SP.DB.seedFacilities(seed);
        facilities = await SP.DB.getFacilities();
      } catch (e) {
        SP.toast("Facility data unavailable", e.message, "amber");
      }
    }
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    $("#refreshBtn").addEventListener("click", load);
    $("#loadDemoBtn").addEventListener("click", async () => {
      const btn = $("#loadDemoBtn");
      btn.disabled = true;
      btn.textContent = "Loading…";
      try {
        const n = await SP.seedDemo(120);
        SP.toast("Sample data loaded", n + " demo incidents written to IndexedDB.", "green");
        await load();
      } catch (e) {
        SP.toast("Could not load sample data", e.message, "red");
      } finally {
        btn.disabled = false;
        btn.textContent = "Load sample data";
      }
    });
  });
})(window);
