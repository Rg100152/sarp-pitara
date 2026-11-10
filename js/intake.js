/* ============================================================
   Sarp Pitara — incident intake, body map, 20WBCT, ASV protocol
   ============================================================ */
(function (global) {
  "use strict";
  const SP = global.SP;
  const $ = SP.$;
  const $$ = SP.$$;

  const TOTAL_SECONDS = 20 * 60;
  const state = {
    facilities: [],
    admin: null,
    villages: [],
    taxa: [],
    selectedTaxon: null,
    fang: "unknown",
    timer: { remaining: TOTAL_SECONDS, running: false, handle: null },
    editing: null,
    caseNumber: null
  };

  function localNow() {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  }

  /* ---------- populate selects ---------- */
  function populateAdmin() {
    const admin = state.admin;
    const districtSel = $("#district");
    districtSel.innerHTML = admin.districts.map((d) => '<option value="' + SP.esc(d) + '"' + (d === "Jaunpur" ? " selected" : "") + ">" + SP.esc(d) + "</option>").join("");
    const tehsilSel = $("#tehsil");
    tehsilSel.innerHTML = '<option value="">Select tehsil…</option>' + admin.jaunpur.tehsils.map((t) =>
      '<option value="' + SP.esc(t.name) + '">' + SP.esc(t.name) + " · " + SP.esc(t.hindi_name) + "</option>").join("");
  }

  function populateFacilities() {
    const sel = $("#facility");
    const byType = {};
    state.facilities.forEach((f) => {
      const t = f.type || "Other";
      (byType[t] = byType[t] || []).push(f);
    });
    sel.innerHTML = '<option value="">Select facility…</option>' + Object.keys(byType).sort().map((t) =>
      '<optgroup label="' + SP.esc(t) + '">' + byType[t].map((f) =>
        '<option value="' + SP.esc(f.facility_id) + '">' + SP.esc(f.name) + " · " + SP.esc(f.tehsil) + "</option>").join("") + "</optgroup>"
    ).join("");
  }

  function villagesForTehsil(tehsil) {
    return state.villages.filter((v) => v.sub_district === tehsil);
  }

  function populateVillages(tehsil) {
    const list = $("#villageList");
    const rows = tehsil ? villagesForTehsil(tehsil) : state.villages;
    list.innerHTML = rows.slice(0, 4000).map((v) =>
      '<option value="' + SP.esc(v.village_name) + '">' + SP.esc(v.panchayat_details || "") + "</option>").join("");
    $("#villageHelp").textContent = tehsil
      ? rows.length + " villages in " + tehsil + " (official LGD directory)."
      : "Select a tehsil to filter villages.";
  }

  /* ---------- taxa ---------- */
  function renderTaxa() {
    const grid = $("#taxaGrid");
    grid.innerHTML = state.taxa.map((t) => {
      const color = t.risk_color === "red" ? "#ef4444" : t.risk_color === "green" ? "#10b981" : "#f59e0b";
      const thumb = t.image
        ? '<img class="thumb" src="' + SP.esc(t.image) + '" alt="' + SP.esc(t.common_name) + '" loading="lazy" onerror="this.outerHTML=\'<div class=&quot;thumb-fallback&quot;>IMAGE OFFLINE</div>\'">'
        : '<div class="thumb-fallback">NO PHOTO</div>';
      return '<button type="button" class="taxon" data-taxon="' + SP.esc(t.id) + '">' +
        thumb +
        '<div class="taxon-name">' + SP.esc(t.common_name) + "</div>" +
        '<div class="taxon-hi">' + SP.esc(t.hindi_name) + "</div>" +
        '<div class="taxon-sci">' + SP.esc(t.scientific_name) + "</div>" +
        '<span class="badge ' + (t.risk_color === "green" ? "green" : t.risk_color === "red" ? "red" : "amber") + '">' + SP.esc(t.venom_type) + "</span>" +
        '<div class="danger-bar"><i style="width:' + (t.risk_color === "red" ? 92 : t.risk_color === "green" ? 18 : 72) + "%;background:" + color + '"></i></div>' +
        "</button>";
    }).join("");
    $$(".taxon", grid).forEach((btn) => btn.addEventListener("click", () => selectTaxon(btn.dataset.taxon)));
  }

  function selectTaxon(id) {
    const t = state.taxa.find((x) => x.id === id);
    if (!t) return;
    state.selectedTaxon = t;
    $$(".taxon").forEach((b) => b.classList.toggle("selected", b.dataset.taxon === id));
    $("#taxonId").value = t.id;
    $("#speciesCommon").value = t.common_name + " (" + t.hindi_name + ")";
    const map = {
      Neurotoxic: "Neurotoxic",
      "Neurotoxic & Cytotoxic": "Neurotoxic",
      "Hemotoxic & Vasculotoxic": "Hemotoxic",
      Hemotoxic: "Hemotoxic",
      "Non-Venomous": "NonVenomous",
      Indeterminate: "Indeterminate"
    };
    $("#venomClass").value = map[t.venom_type] || "Indeterminate";
    evaluate();
  }

  /* ---------- symptoms ---------- */
  function renderSymptoms() {
    const wrap = $("#symptomGroups");
    wrap.innerHTML = SP.Triage.SYMPTOM_GROUPS.map((g) =>
      '<div><div class="spread" style="margin-bottom:7px"><span class="field-label">' + SP.esc(g.title) + '</span><span class="small muted">' + SP.esc(g.hindi) + "</span></div>" +
      '<div class="check-grid">' + g.symptoms.map((s) =>
        '<label class="check"><input type="checkbox" data-symptom="' + SP.esc(s) + '"><span>' + SP.esc(s) + "</span></label>"
      ).join("") + "</div></div>"
    ).join("");
    $$("[data-symptom]").forEach((cb) => cb.addEventListener("change", () => {
      cb.closest(".check").classList.toggle("checked", cb.checked);
      evaluate();
    }));
  }

  function getSymptoms() {
    return $$("[data-symptom]:checked").map((c) => c.dataset.symptom);
  }

  /* ---------- triage evaluation ---------- */
  function collect() {
    return {
      age_years: $("#ageYears").value,
      gender: $("#gender").value,
      symptoms: getSymptoms(),
      suspected_venom_class: $("#venomClass").value,
      twentym_wbct_positive: $("#wbct").value === "" ? null : $("#wbct").value === "true",
      initial_systolic_bp: $("#sbp").value,
      initial_diastolic_bp: $("#dbp").value,
      initial_heart_rate: $("#hr").value,
      initial_spo2_percent: $("#spo2").value,
      respiratory_rate: $("#rr").value
    };
  }

  function evaluate() {
    const r = SP.Triage.evaluate(collect());
    const badge = $("#sevBadge");
    badge.textContent = r.severity.toUpperCase();
    badge.className = "badge " + (r.color === "red" ? "red" : r.color === "amber" ? "amber" : "green");
    $("#recVials").textContent = r.recommendedVials;
    $("#recVials").style.color = r.recommendedVials ? "#f59e0b" : "#10b981";
    $("#recWBCT").textContent = r.repeatWBCTHours ? r.repeatWBCTHours + " h" : "—";
    const flags = Object.values(r.flags).filter(Boolean).length;
    $("#recFlags").textContent = flags;
    $("#recFlags").style.color = flags ? "#ef4444" : "#10b981";
    $("#recTitle").textContent = r.title;
    $("#recDetail").textContent = r.detail;
    $("#recActions").innerHTML = r.actions.map((a) => "<li>" + SP.esc(a) + "</li>").join("");
    const card = $("#triageSummary");
    card.className = "card " + (r.color === "red" ? "card-accent-red" : r.color === "amber" ? "card-accent-amber" : "card-accent-green");
    state.lastTriage = r;
    return r;
  }

  /* ---------- body map ---------- */
  function selectSite(site, hit) {
    $("#biteSite").value = site;
    $$(".body-map .hit").forEach((h) => h.classList.remove("selected"));
    if (hit) hit.classList.add("selected");
    const marker = $("#bodyMarker");
    if (hit) {
      const g = hit.closest("g");
      const offset = g && g.id === "bodyBack" ? 100 : 0;
      const x = Number(hit.dataset.cx) + offset;
      const y = Number(hit.dataset.cy);
      marker.setAttribute("transform", "translate(" + x + "," + y + ")");
      marker.style.display = "block";
    } else {
      marker.style.display = "none";
    }
    evaluate();
  }

  function syncMarkerFromSelect() {
    const site = $("#biteSite").value;
    const hit = $$(".body-map .hit").find((h) => h.dataset.site === site);
    if (hit) selectSite(site, hit);
    else {
      $$(".body-map .hit").forEach((h) => h.classList.remove("selected"));
      $("#bodyMarker").style.display = "none";
    }
  }

  /* ---------- 20WBCT timer ---------- */
  function renderTimer() {
    const t = state.timer;
    const mm = Math.floor(t.remaining / 60).toString().padStart(2, "0");
    const ss = Math.floor(t.remaining % 60).toString().padStart(2, "0");
    $("#timerText").textContent = mm + ":" + ss;
    const C = 2 * Math.PI * 72;
    const prog = $("#timerProg");
    prog.style.strokeDasharray = C;
    prog.style.strokeDashoffset = C * (1 - t.remaining / TOTAL_SECONDS);
    prog.style.stroke = t.remaining <= 0 ? "#ef4444" : t.remaining < 300 ? "#f59e0b" : "#ef4444";
  }

  function beep() {
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      [0, 0.35, 0.7].forEach((offset) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offset + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.25);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + offset);
        o.stop(ctx.currentTime + offset + 0.3);
      });
      setTimeout(() => ctx.close(), 1600);
    } catch (e) { /* audio optional */ }
    if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 500]);
  }

  function startTimer() {
    const t = state.timer;
    if (t.running) {
      clearInterval(t.handle);
      t.running = false;
      $("#timerStart").textContent = "▶ Resume";
      return;
    }
    if (t.remaining <= 0) t.remaining = TOTAL_SECONDS;
    t.running = true;
    $("#timerStart").textContent = "⏸ Pause";
    $("#timerStart").classList.add("btn-amber");
    t.handle = setInterval(() => {
      t.remaining--;
      if (t.remaining <= 0) {
        t.remaining = 0;
        clearInterval(t.handle);
        t.running = false;
        $("#timerStart").textContent = "▶ Start";
        $("#timerStart").classList.remove("btn-amber");
        beep();
        SP.toast("20WBCT complete", "Inspect the tube now. If blood is still liquid, record a positive result.", "red");
      }
      renderTimer();
    }, 1000);
    renderTimer();
  }

  function resetTimer() {
    clearInterval(state.timer.handle);
    state.timer = { remaining: TOTAL_SECONDS, running: false, handle: null };
    $("#timerStart").textContent = "▶ Start";
    $("#timerStart").classList.remove("btn-amber");
    renderTimer();
  }

  /* ---------- fang marks ---------- */
  function setFang(val, btn) {
    state.fang = val;
    $$('[data-radio-group="fang"] button').forEach((b) => b.classList.toggle("active", b === btn));
  }

  /* ---------- panic slider ---------- */
  function setPanic(val) {
    const labels = [
      ["Asymptomatic — routine intake", "green"],
      ["Local swelling — immobilise & reassess", "amber"],
      ["Ptosis / neuro signs — ASV protocol", "amber"],
      ["Spontaneous bleeding — hemotoxic protocol", "red"],
      ["Respiratory distress — ICU / ventilator now", "red"]
    ];
    const l = labels[Number(val)] || labels[0];
    const card = $("#symptomCard");
    card.className = "card " + (l[1] === "red" ? "card-accent-red" : l[1] === "amber" ? "card-accent-amber" : "card-accent-green");
    $("#panicSlider").title = l[0];
  }

  /* ---------- GPS ---------- */
  function useGPS() {
    if (!navigator.geolocation) {
      SP.toast("GPS unavailable", "Use manual tehsil / village selection.", "amber");
      return;
    }
    const btn = $("#gpsBtn");
    btn.disabled = true;
    btn.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        $("#latitude").value = lat.toFixed(6);
        $("#longitude").value = lng.toFixed(6);
        let nearest = null, best = Infinity;
        (state.admin ? state.admin.jaunpur.tehsils : []).forEach((t) => {
          const d = SP.fmt.haversine(lat, lng, t.lat, t.lng);
          if (d != null && d < best) { best = d; nearest = t; }
        });
        if (nearest) {
          $("#tehsil").value = nearest.name;
          populateVillages(nearest.name);
          SP.toast("Location captured", "Nearest tehsil: " + nearest.name + " (~" + best + " km).", "green");
        } else {
          SP.toast("Location captured", "Select tehsil and village manually.", "green");
        }
        btn.disabled = false;
        btn.textContent = "📍 Use current location";
      },
      (err) => {
        SP.toast("GPS denied or unavailable", "Manual tehsil / village fallback is active.", "amber");
        btn.disabled = false;
        btn.textContent = "📍 Use current location";
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
    );
  }

  /* ---------- referral slip ---------- */
  function buildReferralHTML() {
    const r = state.lastTriage || evaluate();
    const name = $("#patientName").value || "Anonymous";
    const age = $("#ageYears").value || "?";
    const gender = $("#gender").value || "?";
    const tehsil = $("#tehsil").value || "—";
    const village = $("#village").value || "—";
    const site = $("#biteSite").value || "—";
    const species = $("#speciesCommon").value || "Unknown / Unidentified";
    const venom = $("#venomClass").value;
    const facility = $("#facility").selectedOptions[0] ? $("#facility").selectedOptions[0].textContent : "—";
    const vitals = "BP " + ($("#sbp").value || "—") + "/" + ($("#dbp").value || "—") + " · HR " + ($("#hr").value || "—") + " · SpO₂ " + ($("#spo2").value || "—") + "% · RR " + ($("#rr").value || "—");
    const wbct = $("#wbct").value === "true" ? "POSITIVE (liquid)" : $("#wbct").value === "false" ? "NEGATIVE (clot formed)" : "Not performed";
    const biteTime = $("#biteTime").value ? new Date($("#biteTime").value).toLocaleString("en-IN") : "—";
    const symptoms = getSymptoms().join(", ") || "None recorded";
    const actions = (r.actions || []).map((a) => "<li>" + SP.esc(a) + "</li>").join("");
    const caseNo = state.caseNumber || $("#caseNoDisplay").textContent;

    return '<div style="max-width:760px;margin:0 auto;padding:18px;border:2px solid #111;border-radius:10px;font-family:Inter,system-ui,sans-serif;color:#000">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">' +
        '<div><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase">Sarp Pitara · Emergency Referral Pass</div>' +
        '<h1 style="font-size:20px;margin:4px 0 0">Snakebite Clinical Referral</h1></div>' +
        '<div style="text-align:right;font-family:monospace"><div style="font-size:18px;font-weight:800">' + SP.esc(caseNo) + '</div><div style="font-size:11px">' + SP.esc(new Date().toLocaleString("en-IN")) + "</div></div>" +
      "</div>" +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">' +
        row("Patient", name + " · " + age + "y · " + gender) +
        row("Location", village + ", " + tehsil + ", Jaunpur (UP)") +
        row("Bite time", biteTime) +
        row("Bite site", site) +
        row("Suspected species", species + " · " + venom) +
        row("Vitals", vitals) +
        row("20WBCT", wbct) +
        row("Symptoms", symptoms) +
        row("Facility", facility) +
        row("Triage severity", r.severity) +
        row("ASV recommendation", r.recommendedVials + " vials initial bolus (same dose for children)") +
      "</table>" +
      '<div style="border:1px solid #111;border-radius:8px;padding:10px 12px;margin-bottom:12px">' +
        '<div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Immediate Actions</div>' +
        '<ul style="margin:0;padding-left:18px;font-size:12px">' + actions + "</ul>" +
      "</div>" +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:26px">' +
        "<div>Referring clinician: ______________________</div><div>Receiving facility: ______________________</div>" +
      "</div>" +
      '<div style="margin-top:10px;font-size:10px;color:#444;border-top:1px solid #999;padding-top:6px">Generated offline by Sarp Pitara · Clinical decision support only. Confirm with institutional protocol. Emergency: 108.</div>' +
    "</div>";
  }

  function row(k, v) {
    return '<tr><td style="padding:5px 8px;border:1px solid #bbb;background:#eee;width:34%;font-weight:700">' + SP.esc(k) + '</td><td style="padding:5px 8px;border:1px solid #bbb">' + SP.esc(v) + "</td></tr>";
  }

  function printReferral() {
    $("#printArea").innerHTML = buildReferralHTML();
    document.body.classList.add("print-slip");
    const cleanup = () => document.body.classList.remove("print-slip");
    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 800);
    }, 60);
  }

  /* ---------- save ---------- */
  async function save(alsoPrint) {
    const form = $("#biteForm");
    if (!form.checkValidity()) {
      form.reportValidity();
      SP.toast("Missing required fields", "Complete patient name, age, gender, tehsil, village, bite time and bite site.", "red");
      return;
    }
    const btn = $("#saveBtn");
    btn.disabled = true;
    const r = evaluate();
    const biteIso = new Date($("#biteTime").value).toISOString();
    const delayInput = Number($("#delay").value);
    const delay = !isNaN(delayInput) && $("#delay").value !== "" ? delayInput : Math.max(0, Math.round((Date.now() - new Date(biteIso).getTime()) / 60000));
    const facilitySel = $("#facility");
    const facilityName = facilitySel.value && facilitySel.selectedOptions[0] ? facilitySel.selectedOptions[0].textContent.split(" · ")[0] : "";
    const caseNumber = state.editing ? state.editing.case_number : await SP.DB.nextCaseNumber();
    state.caseNumber = caseNumber;
    $("#caseNoDisplay").textContent = caseNumber;

    const incident = {
      incident_id: state.editing ? state.editing.incident_id : SP.DB.uuid(),
      case_number: caseNumber,
      recorded_at: state.editing ? state.editing.recorded_at : new Date().toISOString(),
      bite_timestamp: biteIso,
      patient_name: $("#patientName").value.trim(),
      age_years: Number($("#ageYears").value),
      gender: $("#gender").value,
      contact_number: $("#contactNumber").value.trim(),
      location_state_code: $("#stateCode").value || "UP",
      location_district: $("#district").value || "Jaunpur",
      location_subdistrict: $("#tehsil").value,
      location_village: $("#village").value.trim(),
      latitude: $("#latitude").value !== "" ? Number($("#latitude").value) : null,
      longitude: $("#longitude").value !== "" ? Number($("#longitude").value) : null,
      habitat_context: $("#habitat").value,
      bite_anatomy_site: $("#biteSite").value,
      fang_punctures_visible: state.fang === "true" ? true : state.fang === "false" ? false : null,
      activity_during_bite: $("#activity").value.trim(),
      identified_taxon_id: $("#taxonId").value || "snake-06",
      species_common_name: state.selectedTaxon ? state.selectedTaxon.common_name : "Unidentified",
      species_scientific_name: state.selectedTaxon ? state.selectedTaxon.scientific_name : "Indeterminate",
      suspected_venom_class: $("#venomClass").value,
      identification_confidence: $("#confidence").value.trim(),
      twentym_wbct_positive: $("#wbct").value === "" ? null : $("#wbct").value === "true",
      initial_systolic_bp: $("#sbp").value !== "" ? Number($("#sbp").value) : null,
      initial_diastolic_bp: $("#dbp").value !== "" ? Number($("#dbp").value) : null,
      initial_heart_rate: $("#hr").value !== "" ? Number($("#hr").value) : null,
      initial_spo2_percent: $("#spo2").value !== "" ? Number($("#spo2").value) : null,
      respiratory_rate: $("#rr").value !== "" ? Number($("#rr").value) : null,
      symptoms: getSymptoms(),
      triage_severity: r.severity,
      asv_vials_administered: Number($("#asvVials").value) || 0,
      adverse_reaction_observed: $("#adverse").checked,
      facility_id: facilitySel.value || "",
      facility_name: facilityName,
      clinical_outcome: $("#outcome").value,
      treatment_delay_minutes: delay,
      notes: $("#notes").value.trim(),
      client_created_at: state.editing ? state.editing.client_created_at : new Date().toISOString(),
      client_updated_at: new Date().toISOString(),
      sync_version: (state.editing ? Number(state.editing.sync_version) || 1 : 0) + 1,
      is_deleted: false,
      sync_status: "LOCAL_QUEUED"
    };

    try {
      await SP.DB.saveIncident(incident);
      await SP.DB.enqueue({ op: "UPSERT", incident_id: incident.incident_id, case_number: caseNumber, at: new Date().toISOString() });
      state.editing = incident;
      SP.toast("Incident saved", caseNumber + " stored locally · " + r.severity + " · " + r.recommendedVials + " ASV vials recommended.", r.color === "red" ? "red" : "green");
      if (alsoPrint) {
        printReferral();
      } else {
        setTimeout(() => { location.href = "case-directory.html?new=" + encodeURIComponent(incident.incident_id); }, 700);
      }
    } catch (e) {
      SP.toast("Save failed", e.message, "red");
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- edit / load existing ---------- */
  async function loadExisting(id) {
    const inc = await SP.DB.getIncident(id);
    if (!inc) {
      SP.toast("Case not found", "The requested record is not in local storage.", "red");
      return;
    }
    state.editing = inc;
    state.caseNumber = inc.case_number;
    $("#caseNoDisplay").textContent = inc.case_number;
    $("#saveBtn").innerHTML = "💾 Update Incident";
    const set = (id, v) => { const n = $("#" + id); if (n) n.value = v == null ? "" : v; };
    set("patientName", inc.patient_name);
    set("contactNumber", inc.contact_number);
    set("ageYears", inc.age_years);
    set("gender", inc.gender);
    set("district", inc.location_district);
    set("tehsil", inc.location_subdistrict);
    populateVillages(inc.location_subdistrict);
    set("village", inc.location_village);
    set("latitude", inc.latitude);
    set("longitude", inc.longitude);
    set("habitat", inc.habitat_context);
    if (inc.bite_timestamp) {
      const d = new Date(inc.bite_timestamp);
      const off = d.getTimezoneOffset();
      $("#biteTime").value = new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
    }
    set("biteSite", inc.bite_anatomy_site);
    syncMarkerFromSelect();
    set("activity", inc.activity_during_bite);
    if (inc.identified_taxon_id) selectTaxon(inc.identified_taxon_id);
    set("venomClass", inc.suspected_venom_class);
    set("confidence", inc.identification_confidence);
    set("sbp", inc.initial_systolic_bp);
    set("dbp", inc.initial_diastolic_bp);
    set("hr", inc.initial_heart_rate);
    set("spo2", inc.initial_spo2_percent);
    set("rr", inc.respiratory_rate);
    set("wbct", inc.twentym_wbct_positive === true ? "true" : inc.twentym_wbct_positive === false ? "false" : "");
    set("facility", inc.facility_id);
    set("asvVials", inc.asv_vials_administered);
    set("outcome", inc.clinical_outcome);
    set("delay", inc.treatment_delay_minutes);
    set("notes", inc.notes);
    $("#adverse").checked = !!inc.adverse_reaction_observed;
    if (inc.fang_punctures_visible === true) setFang("true", $('[data-radio-group="fang"] [data-val="true"]'));
    else if (inc.fang_punctures_visible === false) setFang("false", $('[data-radio-group="fang"] [data-val="false"]'));
    (inc.symptoms || []).forEach((s) => {
      const cb = $$("[data-symptom]").find((c) => c.dataset.symptom === s);
      if (cb) { cb.checked = true; cb.closest(".check").classList.add("checked"); }
    });
    evaluate();
    SP.toast("Editing case", inc.case_number + " loaded from local storage.", "info");
  }

  /* ---------- bind ---------- */
  function bind() {
    $("#tehsil").addEventListener("change", (e) => populateVillages(e.target.value));
    $("#gpsBtn").addEventListener("click", useGPS);
    $("#biteSite").addEventListener("change", syncMarkerFromSelect);
    $$(".body-map .hit").forEach((h) => h.addEventListener("click", () => selectSite(h.dataset.site, h)));
    $$('[data-radio-group="fang"] button').forEach((b) => b.addEventListener("click", () => setFang(b.dataset.val, b)));
    $("#panicSlider").addEventListener("input", (e) => setPanic(e.target.value));
    $("#timerStart").addEventListener("click", startTimer);
    $("#timerReset").addEventListener("click", resetTimer);
    $$("[data-wbct]").forEach((b) => b.addEventListener("click", () => {
      $("#wbct").value = b.dataset.wbct;
      evaluate();
      SP.toast("20WBCT recorded", b.dataset.wbct === "true" ? "Positive — proceed with ASV protocol." : "Negative — clot formed.", b.dataset.wbct === "true" ? "red" : "green");
    }));
    ["ageYears", "gender", "venomClass", "wbct", "sbp", "dbp", "hr", "spo2", "rr"].forEach((id) => {
      const n = $("#" + id);
      if (n) n.addEventListener("input", evaluate);
      if (n) n.addEventListener("change", evaluate);
    });
    $("#biteForm").addEventListener("submit", (e) => { e.preventDefault(); save(false); });
    $("#savePrintBtn").addEventListener("click", () => save(true));
    $("#printBtn").addEventListener("click", () => {
      if (!$("#patientName").value) { SP.toast("Nothing to print", "Enter patient details first.", "amber"); return; }
      printReferral();
    });
    $("#biteForm").addEventListener("reset", () => {
      setTimeout(() => {
        state.selectedTaxon = null;
        state.editing = null;
        state.caseNumber = null;
        state.fang = "unknown";
        setFang("unknown", $('[data-radio-group="fang"] [data-val="unknown"]'));
        $$(".taxon").forEach((b) => b.classList.remove("selected"));
        $$("[data-symptom]").forEach((c) => { c.checked = false; c.closest(".check").classList.remove("checked"); });
        $("#speciesCommon").value = "";
        $("#taxonId").value = "";
        $("#biteTime").value = localNow();
        $("#caseNoDisplay").textContent = "…";
        $("#saveBtn").innerHTML = "💾 Save Incident";
        $("#biteSite").value = "";
        $("#bodyMarker").style.display = "none";
        $$(".body-map .hit").forEach((h) => h.classList.remove("selected"));
        $("#panicSlider").value = 0;
        setPanic(0);
        resetTimer();
        populateVillages("");
        SP.DB.nextCaseNumber().then((n) => { state.caseNumber = n; $("#caseNoDisplay").textContent = n; });
        evaluate();
      }, 30);
    });
  }

  async function init() {
    $("#biteTime").value = localNow();
    try {
      const [facilities, admin, villages, taxa] = await Promise.all([
        SP.loadJSON("assets/data/hospitals_jaunpur.json"),
        SP.loadJSON("assets/data/administrative-divisions.json"),
        SP.loadJSON("assets/data/jaunpur_villages.json"),
        SP.loadJSON("assets/data/snakes_guide.json")
      ]);
      state.facilities = facilities;
      state.admin = admin;
      state.villages = villages;
      state.taxa = taxa;
      await SP.DB.seedFacilities(facilities);
    } catch (e) {
      SP.toast("Data load error", e.message + " — serve the app over HTTP (not file://).", "red");
    }
    populateAdmin();
    populateFacilities();
    populateVillages("");
    renderTaxa();
    renderSymptoms();
    bind();
    setFang("unknown", $('[data-radio-group="fang"] [data-val="unknown"]'));
    setPanic(0);
    resetTimer();
    evaluate();

    const params = new URLSearchParams(location.search);
    const editId = params.get("case");
    if (editId) {
      await loadExisting(editId);
    } else {
      const n = await SP.DB.nextCaseNumber();
      state.caseNumber = n;
      $("#caseNoDisplay").textContent = n;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
