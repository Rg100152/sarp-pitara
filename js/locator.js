/* ============================================================
   Sarp Pitara — ASV facility locator
   ============================================================ */
(function (global) {
  "use strict";
  const SP = global.SP;
  const $ = SP.$;
  const $$ = SP.$$;

  let facilities = [];
  let admin = null;
  let filtered = [];
  let origin = { lat: 25.7464, lng: 82.6837, label: "Jaunpur city" };
  let userLocation = null;

  function stockColor(n) {
    if (n < 10) return "#ef4444";
    if (n < 20) return "#f59e0b";
    return "#10b981";
  }
  function stockLabel(n) {
    if (n < 10) return "Critical";
    if (n < 20) return "Limited";
    return "Sufficient";
  }
  function jitter(id, salt) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 1000) / 1000 - 0.5) * salt;
  }

  function populateFilters() {
    const tehsils = Array.from(new Set(facilities.map((f) => f.tehsil))).sort();
    $("#fTehsil").innerHTML = '<option value="">All tehsils</option>' + tehsils.map((t) => '<option>' + SP.esc(t) + "</option>").join("");
    const types = Array.from(new Set(facilities.map((f) => f.type))).sort();
    $("#fType").innerHTML = '<option value="">All types</option>' + types.map((t) => '<option>' + SP.esc(t) + "</option>").join("");
    const params = new URLSearchParams(location.search);
    const t = params.get("tehsil");
    if (t) $("#fTehsil").value = t;
  }

  function distanceTo(f) {
    if (!f.location) return null;
    return SP.fmt.haversine(origin.lat, origin.lng, f.location.lat, f.location.lng);
  }

  function applyFilters() {
    const q = $("#search").value.trim().toLowerCase();
    const tehsil = $("#fTehsil").value;
    const type = $("#fType").value;
    const needVent = $("#fVent").checked;
    const needBlood = $("#fBlood").checked;
    const need24 = $("#f24").checked;
    const needStock = $("#fStock").checked;

    filtered = facilities.filter((f) => {
      if (tehsil && f.tehsil !== tehsil) return false;
      if (type && f.type !== type) return false;
      if (needVent && !f.has_ventilator) return false;
      if (needBlood && !f.has_blood_bank) return false;
      if (need24 && !f.is_24x7) return false;
      if (needStock && Number(f.asv_stock_available) < 20) return false;
      if (q) {
        const hay = [f.name, f.hindi_name, f.type, f.tehsil, f.location && f.location.address, f.location && f.location.pincode].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    const sort = $("#sortBy").value;
    if (sort === "stock") filtered.sort((a, b) => Number(b.asv_stock_available) - Number(a.asv_stock_available));
    else if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    else filtered.sort((a, b) => (distanceTo(a) == null ? 9999 : distanceTo(a)) - (distanceTo(b) == null ? 9999 : distanceTo(b)));

    renderStats();
    renderList();
    renderMap();
  }

  function renderStats() {
    const total = filtered.reduce((s, f) => s + (Number(f.asv_stock_available) || 0), 0);
    const low = filtered.filter((f) => Number(f.asv_stock_available) < 20).length;
    const nearest = filtered.filter((f) => distanceTo(f) != null).sort((a, b) => distanceTo(a) - distanceTo(b))[0];
    $("#statStock").textContent = total;
    $("#statFacilities").textContent = filtered.length;
    $("#statLow").textContent = low;
    $("#lowBadge").textContent = low ? low + " LOW STOCK" : "STOCK OK";
    $("#lowBadge").className = "badge " + (low ? "red" : "green");
    $("#statNearest").textContent = nearest ? nearest.name.split(" ").slice(0, 2).join(" ") : "—";
    $("#statNearestFoot").textContent = nearest ? distanceTo(nearest) + " km from " + origin.label : "Set location";
    $("#noFacilities").style.display = filtered.length ? "none" : "block";
  }

  function facilityCard(f) {
    const stock = Number(f.asv_stock_available) || 0;
    const maxStock = Math.max(25, ...filtered.map((x) => Number(x.asv_stock_available) || 0));
    const color = stockColor(stock);
    const dist = distanceTo(f);
    const facts = [];
    if (f.has_ventilator) facts.push('<span class="badge cyan">VENTILATOR</span>');
    if (f.has_blood_bank) facts.push('<span class="badge green">BLOOD BANK</span>');
    if (f.is_24x7) facts.push('<span class="badge">24×7</span>');
    const phone = f.emergency_phone || "108";
    const route = f.location ? "https://www.google.com/maps/dir/?api=1&destination=" + f.location.lat + "," + f.location.lng : "#";
    return '<article class="card facility" id="fac-' + SP.esc(f.facility_id) + '">' +
      '<div class="fac-head">' +
        "<div><h3>" + SP.esc(f.name) + '</h3><div class="addr">' + SP.esc(f.hindi_name || "") + " · " + SP.esc(f.tehsil) + "</div>" +
        '<div class="addr">' + SP.esc((f.location && f.location.address) || "") + "</div></div>" +
        '<span class="badge ' + (stock < 10 ? "red" : stock < 20 ? "amber" : "green") + '">' + stock + " VIALS</span>" +
      "</div>" +
      '<div class="facts">' + facts.join("") + '<span class="badge violet">' + SP.esc(f.type) + "</span></div>" +
      '<div class="stock-meter"><div class="spread small muted" style="margin-bottom:4px"><span>' + stockLabel(stock) + '</span><span class="mono">' + (dist != null ? dist + " km" : "") + "</span></div>" +
        '<div class="bar"><i style="width:' + Math.max(3, Math.round((stock / maxStock) * 100)) + "%;background:" + color + '"></i></div></div>' +
      '<div class="row" style="margin-top:12px">' +
        '<a class="btn btn-sm btn-red" href="tel:' + SP.esc(phone) + '">📞 ' + SP.esc(phone) + "</a>" +
        '<a class="btn btn-sm" href="' + SP.esc(route) + '" target="_blank" rel="noopener">➤ Route</a>' +
        (dist != null ? '<span class="small muted" style="margin-left:auto">' + dist + " km</span>" : "") +
      "</div>" +
    "</article>";
  }

  function renderList() {
    $("#facilityList").innerHTML = filtered.map(facilityCard).join("");
  }

  function renderMap() {
    const box = $("#facilityMap");
    const W = 620, H = 400, pad = 46;
    const rows = filtered.filter((f) => f.location);
    if (!rows.length) {
      box.innerHTML = '<div class="empty"><div class="big">◌</div>No facilities to map.</div>';
      return;
    }
    const lats = rows.map((f) => f.location.lat).concat([origin.lat]);
    const lngs = rows.map((f) => f.location.lng).concat([origin.lng]);
    const minLat = Math.min(...lats) - 0.02, maxLat = Math.max(...lats) + 0.02;
    const minLng = Math.min(...lngs) - 0.02, maxLng = Math.max(...lngs) + 0.02;
    const px = (lng) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - pad * 2);
    const py = (lat) => H - pad - ((lat - minLat) / (maxLat - minLat || 1)) * (H - pad * 2);

    let nodes = "";
    rows.forEach((f) => {
      const stock = Number(f.asv_stock_available) || 0;
      const color = stockColor(stock);
      const x = px(f.location.lng + jitter(f.facility_id, 0.01));
      const y = py(f.location.lat + jitter(f.facility_id + "y", 0.01));
      nodes += '<g class="map-node" data-call="' + SP.esc(f.emergency_phone || "108") + '" data-id="' + SP.esc(f.facility_id) + '" tabindex="0" role="button" aria-label="' + SP.esc(f.name) + ", " + stock + ' vials">' +
        "<title>" + SP.esc(f.name) + " · " + stock + " vials · " + SP.esc(f.tehsil) + "</title>" +
        '<circle cx="' + x + '" cy="' + y + '" r="13" fill="' + color + '" opacity="0.14"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="7" fill="' + color + '" stroke="#0b0f17" stroke-width="2"/>' +
        '<text x="' + x + '" y="' + (y + 20) + '" text-anchor="middle" fill="#94a3b8" font-family="Inter, sans-serif" font-size="9">' + SP.esc(f.name.replace(/CHC |Hospital|Centre|Center/g, "").trim().slice(0, 18)) + "</text>" +
      "</g>";
    });

    const ox = px(origin.lng), oy = py(origin.lat);
    const originNode = '<g><circle cx="' + ox + '" cy="' + oy + '" r="6" fill="#22d3ee" stroke="#0b0f17" stroke-width="2"/>' +
      '<circle cx="' + ox + '" cy="' + oy + '" r="14" fill="none" stroke="#22d3ee" stroke-width="1" opacity=".45"/>' +
      '<text x="' + ox + '" y="' + (oy - 16) + '" text-anchor="middle" fill="#67e8f9" font-family="JetBrains Mono, monospace" font-size="9">YOU / ORIGIN</text></g>';

    box.innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><pattern id="grid2" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="rgba(148,163,184,.08)" stroke-width="1"/></pattern></defs>' +
        '<rect width="' + W + '" height="' + H + '" fill="url(#grid2)"/>' +
        '<rect x="18" y="14" width="' + (W - 36) + '" height="' + (H - 28) + '" rx="18" fill="none" stroke="rgba(148,163,184,.2)" stroke-dasharray="6 7"/>' +
        '<text x="34" y="36" fill="#64748b" font-family="JetBrains Mono, monospace" font-size="9" letter-spacing="2">JAUNPUR ASV NETWORK · SCHEMATIC</text>' +
        nodes + originNode +
      "</svg>" +
      '<div class="map-legend"><div class="item"><i style="background:#10b981"></i>Sufficient stock</div><div class="item"><i style="background:#f59e0b"></i>Limited</div><div class="item"><i style="background:#ef4444"></i>Critical</div><div class="item"><i style="background:#22d3ee"></i>Your location</div></div>';

    $$("#facilityMap .map-node").forEach((n) => {
      const call = () => (location.href = "tel:" + n.dataset.call);
      n.addEventListener("click", call);
      n.addEventListener("keydown", (e) => { if (e.key === "Enter") call(); });
      n.addEventListener("mouseenter", () => {
        const card = $("#fac-" + n.dataset.id);
        if (card) card.style.borderColor = "rgba(239,68,68,.6)";
      });
      n.addEventListener("mouseleave", () => {
        const card = $("#fac-" + n.dataset.id);
        if (card) card.style.borderColor = "";
      });
    });
  }

  function useGPS() {
    if (!navigator.geolocation) { SP.toast("GPS unavailable", "Select a tehsil to sort by approximate distance.", "amber"); return; }
    const btn = $("#gpsLocateBtn");
    btn.disabled = true;
    btn.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition((pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location" };
      origin = userLocation;
      SP.toast("Location captured", "Facilities sorted by distance from your GPS position.", "green");
      btn.disabled = false;
      btn.textContent = "📍 Use my location";
      applyFilters();
    }, () => {
      SP.toast("GPS denied", "Sorting by the selected tehsil centre instead.", "amber");
      btn.disabled = false;
      btn.textContent = "📍 Use my location";
    }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
  }

  async function init() {
    try {
      facilities = await SP.DB.getFacilities();
      if (!facilities.length) {
        facilities = await SP.loadJSON("assets/data/hospitals_jaunpur.json");
        await SP.DB.seedFacilities(facilities);
      }
      admin = await SP.loadJSON("assets/data/administrative-divisions.json");
    } catch (e) {
      SP.toast("Data load error", e.message, "red");
    }
    populateFilters();
    const tehsil = $("#fTehsil").value;
    if (tehsil && admin) {
      const t = admin.jaunpur.tehsils.find((x) => x.name === tehsil);
      if (t) origin = { lat: t.lat, lng: t.lng, label: tehsil + " centre" };
    }
    ["search", "fTehsil", "fType", "sortBy", "fVent", "fBlood", "f24", "fStock"].forEach((id) => {
      const n = $("#" + id);
      n.addEventListener("input", applyFilters);
      n.addEventListener("change", () => {
        if (id === "fTehsil" && !userLocation && admin) {
          const t = admin.jaunpur.tehsils.find((x) => x.name === n.value);
          origin = t ? { lat: t.lat, lng: t.lng, label: t.name + " centre" } : { lat: 25.7464, lng: 82.6837, label: "Jaunpur city" };
        }
        applyFilters();
      });
    });
    $("#gpsLocateBtn").addEventListener("click", useGPS);
    $("#clearFilters").addEventListener("click", () => {
      ["search", "fTehsil", "fType"].forEach((id) => ($("#" + id).value = ""));
      ["fVent", "fBlood", "f24", "fStock"].forEach((id) => ($("#" + id).checked = false));
      $("#sortBy").value = "distance";
      origin = { lat: 25.7464, lng: 82.6837, label: "Jaunpur city" };
      userLocation = null;
      applyFilters();
    });
    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
