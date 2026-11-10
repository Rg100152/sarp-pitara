/* ============================================================
   Sarp Pitara — case directory
   ============================================================ */
(function (global) {
  "use strict";
  const SP = global.SP;
  const $ = SP.$;
  const $$ = SP.$$;

  let incidents = [];
  let filtered = [];

  const OUTCOME_LABEL = {
    Admitted: "Admitted",
    "Under Observation": "Under Observation",
    Referred: "Referred",
    Discharged_Recovered: "Discharged / Recovered",
    Left_Against_Medical_Advice: "Left against advice",
    Deceased: "Deceased"
  };

  function severityClass(sev) {
    return sev === "Severe" || sev === "Fatal" ? "red" : sev === "Moderate" ? "amber" : sev === "Mild" ? "cyan" : "green";
  }

  function populateFilters() {
    const tehsils = Array.from(new Set(incidents.map((i) => i.location_subdistrict).filter(Boolean))).sort();
    $("#fTehsil").innerHTML = '<option value="">All tehsils</option>' + tehsils.map((t) => '<option>' + SP.esc(t) + "</option>").join("");
    const species = Array.from(new Set(incidents.map((i) => i.species_common_name).filter(Boolean))).sort();
    $("#fSpecies").innerHTML = '<option value="">All species</option>' + species.map((s) => '<option>' + SP.esc(s) + "</option>").join("");
  }

  function applyFilters() {
    const q = $("#search").value.trim().toLowerCase();
    const tehsil = $("#fTehsil").value;
    const species = $("#fSpecies").value;
    const severity = $("#fSeverity").value;
    const outcome = $("#fOutcome").value;
    filtered = incidents.filter((i) => {
      if (tehsil && i.location_subdistrict !== tehsil) return false;
      if (species && i.species_common_name !== species) return false;
      if (severity && i.triage_severity !== severity) return false;
      if (outcome && i.clinical_outcome !== outcome) return false;
      if (q) {
        const hay = [i.case_number, i.patient_name, i.location_village, i.location_subdistrict, i.species_common_name, i.facility_name, i.contact_number].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    const sort = $("#sortBy").value;
    const sevRank = { Asymptomatic: 0, Mild: 1, Moderate: 2, Severe: 3, Fatal: 4 };
    if (sort === "oldest") filtered.sort((a, b) => new Date(a.bite_timestamp) - new Date(b.bite_timestamp));
    else if (sort === "severity") filtered.sort((a, b) => (sevRank[b.triage_severity] || 0) - (sevRank[a.triage_severity] || 0));
    else if (sort === "vials") filtered.sort((a, b) => (b.asv_vials_administered || 0) - (a.asv_vials_administered || 0));
    else filtered.sort((a, b) => new Date(b.bite_timestamp) - new Date(a.bite_timestamp));
    render();
  }

  function render() {
    const tbody = $("#caseRows");
    $("#resultCount").textContent = filtered.length + " of " + incidents.length + " records";
    $("#emptyCases").style.display = filtered.length ? "none" : "block";
    tbody.innerHTML = filtered.map((i) => {
      const sev = i.triage_severity || "—";
      return "<tr data-id=\"" + SP.esc(i.incident_id) + "\">" +
        '<td class="mono nowrap">' + SP.esc(i.case_number || "—") + "</td>" +
        '<td class="nowrap">' + SP.fmt.date(i.bite_timestamp) + '<div class="small muted">' + SP.fmt.time(i.bite_timestamp) + "</div></td>" +
        "<td>" + SP.esc(i.patient_name || "—") + '<div class="small muted">' + (i.age_years != null ? i.age_years : "?") + "y · " + SP.esc(i.gender || "?") + "</div></td>" +
        "<td>" + SP.esc(i.location_village || "—") + '<div class="small muted">' + SP.esc(i.location_subdistrict || "—") + "</div></td>" +
        "<td>" + SP.esc(i.species_common_name || "—") + '<div class="small muted">' + SP.esc(i.suspected_venom_class || "") + "</div></td>" +
        '<td><span class="badge ' + severityClass(sev) + '">' + SP.esc(sev) + "</span></td>" +
        '<td class="mono">' + (i.asv_vials_administered || 0) + "</td>" +
        "<td>" + SP.esc(OUTCOME_LABEL[i.clinical_outcome] || i.clinical_outcome || "—") + "</td>" +
        '<td><span class="badge ' + (i.sync_status === "Synced" ? "green" : "amber") + '">' + SP.esc(i.sync_status === "Synced" ? "SYNCED" : "QUEUED") + "</span></td>" +
        '<td class="nowrap"><button class="btn btn-sm" data-view="' + SP.esc(i.incident_id) + '">View</button></td>' +
      "</tr>";
    }).join("");
    $$("[data-view]", tbody).forEach((b) => b.addEventListener("click", () => openCase(b.dataset.view)));
    $$("#caseRows tr").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      openCase(tr.dataset.id);
    }));
  }

  function detailRow(k, v) {
    return "<div><span class='field-label'>" + SP.esc(k) + "</span><div style='margin-top:2px'>" + (v || "—") + "</div></div>";
  }

  function openCase(id) {
    const inc = incidents.find((i) => i.incident_id === id);
    if (!inc) return;
    const r = SP.Triage.evaluate(inc);
    const symptoms = (inc.symptoms || []).length ? (inc.symptoms || []).map((s) => '<span class="badge cyan">' + SP.esc(s) + "</span>").join(" ") : '<span class="muted small">None recorded</span>';
    const actions = (r.actions || []).map((a) => "<li>" + SP.esc(a) + "</li>").join("");
    const modal =
      '<div class="modal-backdrop" id="caseModal">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="Case details">' +
          '<div class="modal-head">' +
            "<div><div class='eyebrow'>" + SP.esc(inc.case_number) + "</div><h2 style='margin:0'>" + SP.esc(inc.patient_name || "Anonymous") + "</h2>" +
            "<div class='small muted'>" + SP.fmt.dateTime(inc.bite_timestamp) + " · " + SP.esc(inc.location_village || "") + ", " + SP.esc(inc.location_subdistrict || "") + "</div></div>" +
            '<button class="btn btn-sm btn-icon" id="modalClose" type="button" aria-label="Close">✕</button>' +
          "</div>" +
          '<div class="row" style="margin-bottom:14px">' +
            '<span class="badge ' + severityClass(inc.triage_severity) + '">' + SP.esc(inc.triage_severity || "—") + "</span>" +
            '<span class="badge ' + (inc.suspected_venom_class === "Hemotoxic" ? "red" : inc.suspected_venom_class === "Neurotoxic" ? "amber" : inc.suspected_venom_class === "NonVenomous" ? "green" : "violet") + '">' + SP.esc(inc.suspected_venom_class || "Indeterminate") + "</span>" +
            '<span class="badge ' + (inc.sync_status === "Synced" ? "green" : "amber") + '">' + SP.esc(inc.sync_status === "Synced" ? "SYNCED" : "LOCAL QUEUE") + "</span>" +
            '<span class="badge">' + (inc.asv_vials_administered || 0) + " ASV VIALS</span>" +
          "</div>" +
          '<div class="grid grid-2" style="gap:12px">' +
            detailRow("Age / Gender", (inc.age_years != null ? inc.age_years + " y" : "—") + " · " + SP.esc(inc.gender || "—")) +
            detailRow("Contact", SP.esc(inc.contact_number || "—")) +
            detailRow("Species", SP.esc(inc.species_common_name || "Unknown") + (inc.species_scientific_name ? " <i class='muted small'>(" + SP.esc(inc.species_scientific_name) + ")</i>" : "")) +
            detailRow("Bite site", SP.esc(inc.bite_anatomy_site || "—")) +
            detailRow("Habitat / activity", SP.esc(inc.habitat_context || "—") + (inc.activity_during_bite ? " · " + SP.esc(inc.activity_during_bite) : "")) +
            detailRow("Fang marks", inc.fang_punctures_visible === true ? "Present (2 punctures)" : inc.fang_punctures_visible === false ? "Absent / scratches" : "Unknown") +
            detailRow("Facility", SP.esc(inc.facility_name || "—")) +
            detailRow("Time to treatment", inc.treatment_delay_minutes != null ? inc.treatment_delay_minutes + " minutes" : "—") +
            detailRow("Vitals", "BP " + (inc.initial_systolic_bp || "—") + "/" + (inc.initial_diastolic_bp || "—") + " · HR " + (inc.initial_heart_rate || "—") + " · SpO₂ " + (inc.initial_spo2_percent || "—") + "% · RR " + (inc.respiratory_rate || "—")) +
            detailRow("20WBCT", inc.twentym_wbct_positive === true ? "<span class='badge red'>POSITIVE</span>" : inc.twentym_wbct_positive === false ? "<span class='badge green'>NEGATIVE</span>" : "Not performed") +
          "</div>" +
          '<div class="divider"></div>' +
          "<div class='field-label' style='margin-bottom:6px'>Symptoms</div>" +
          '<div class="tag-list">' + symptoms + "</div>" +
          (inc.notes ? '<div class="divider"></div><div class="field-label" style="margin-bottom:6px">Clinical notes</div><p class="small muted">' + SP.esc(inc.notes) + "</p>" : "") +
          '<div class="divider"></div>' +
          '<div class="banner ' + (r.color === "red" ? "red" : r.color === "amber" ? "amber" : "green") + '">' +
            '<span class="ico">' + (r.color === "red" ? "⚠" : r.color === "amber" ? "◐" : "✓") + "</span>" +
            "<div><strong>" + SP.esc(r.title) + "</strong><div class='small muted'>" + SP.esc(r.detail) + "</div>" +
            '<ul class="small muted" style="margin:8px 0 0;padding-left:18px">' + actions + "</ul></div>" +
          "</div>" +
          '<div class="row" style="margin-top:16px">' +
            '<a class="btn btn-sm btn-primary" href="register-bite.html?case=' + encodeURIComponent(inc.incident_id) + '">✎ Edit</a>' +
            '<button class="btn btn-sm" id="modalPrint" type="button">🖨 Referral slip</button>' +
            '<button class="btn btn-sm btn-red" id="modalDelete" type="button" style="margin-left:auto">Delete</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    $("#modalRoot").innerHTML = modal;
    const close = () => { $("#modalRoot").innerHTML = ""; };
    $("#modalClose").addEventListener("click", close);
    $("#caseModal").addEventListener("click", (e) => { if (e.target.id === "caseModal") close(); });
    $("#modalPrint").addEventListener("click", () => printReferral(inc));
    $("#modalDelete").addEventListener("click", async () => {
      if (!confirm("Delete case " + inc.case_number + " permanently from this device?")) return;
      await SP.DB.deleteIncident(inc.incident_id);
      close();
      SP.toast("Case deleted", inc.case_number + " removed from local storage.", "amber");
      await load();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
  }

  function row(k, v) {
    return '<tr><td style="padding:5px 8px;border:1px solid #bbb;background:#eee;width:34%;font-weight:700">' + SP.esc(k) + '</td><td style="padding:5px 8px;border:1px solid #bbb">' + SP.esc(v) + "</td></tr>";
  }

  function referralHTML(inc) {
    const r = SP.Triage.evaluate(inc);
    const symptoms = (inc.symptoms || []).join(", ") || "None recorded";
    const actions = (r.actions || []).map((a) => "<li>" + SP.esc(a) + "</li>").join("");
    return '<div style="max-width:760px;margin:0 auto;padding:18px;border:2px solid #111;border-radius:10px;font-family:Inter,system-ui,sans-serif;color:#000">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">' +
        '<div><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase">Sarp Pitara · Emergency Referral Pass</div>' +
        '<h1 style="font-size:20px;margin:4px 0 0">Snakebite Clinical Referral</h1></div>' +
        '<div style="text-align:right;font-family:monospace"><div style="font-size:18px;font-weight:800">' + SP.esc(inc.case_number) + '</div><div style="font-size:11px">' + SP.esc(new Date().toLocaleString("en-IN")) + "</div></div>" +
      "</div>" +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">' +
        row("Patient", (inc.patient_name || "Anonymous") + " · " + (inc.age_years != null ? inc.age_years : "?") + "y · " + (inc.gender || "?")) +
        row("Location", (inc.location_village || "—") + ", " + (inc.location_subdistrict || "—") + ", " + (inc.location_district || "Jaunpur") + " (UP)") +
        row("Bite time", SP.fmt.dateTime(inc.bite_timestamp)) +
        row("Bite site", inc.bite_anatomy_site || "—") +
        row("Suspected species", (inc.species_common_name || "Unknown") + " · " + (inc.suspected_venom_class || "Indeterminate")) +
        row("Vitals", "BP " + (inc.initial_systolic_bp || "—") + "/" + (inc.initial_diastolic_bp || "—") + " · HR " + (inc.initial_heart_rate || "—") + " · SpO₂ " + (inc.initial_spo2_percent || "—") + "% · RR " + (inc.respiratory_rate || "—")) +
        row("20WBCT", inc.twentym_wbct_positive === true ? "POSITIVE (liquid)" : inc.twentym_wbct_positive === false ? "NEGATIVE (clot formed)" : "Not performed") +
        row("Symptoms", symptoms) +
        row("Facility", inc.facility_name || "—") +
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

  function printReferral(inc) {
    $("#printArea").innerHTML = referralHTML(inc);
    document.body.classList.add("print-slip");
    const cleanup = () => document.body.classList.remove("print-slip");
    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(() => { window.print(); setTimeout(cleanup, 800); }, 60);
  }

  async function load() {
    incidents = await SP.DB.getIncidents();
    populateFilters();
    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", () => {
    load().then(() => {
      const params = new URLSearchParams(location.search);
      const id = params.get("new") || params.get("case");
      if (id) setTimeout(() => openCase(id), 250);
    });
    ["search", "fTehsil", "fSpecies", "fSeverity", "fOutcome", "sortBy"].forEach((id) =>
      $("#" + id).addEventListener("input", applyFilters));
    $("#clearFilters").addEventListener("click", () => {
      ["search", "fTehsil", "fSpecies", "fSeverity", "fOutcome"].forEach((id) => ($("#" + id).value = ""));
      $("#sortBy").value = "recent";
      applyFilters();
    });
    $("#exportCsvBtn").addEventListener("click", () => {
      if (!filtered.length) { SP.toast("Nothing to export", "No records match the current filters.", "amber"); return; }
      SP.DB.downloadBlob(SP.DB.toCSV(filtered), "sarp-pitara-cases-" + new Date().toISOString().slice(0, 10) + ".csv", "text/csv;charset=utf-8");
      SP.toast("CSV exported", filtered.length + " records downloaded.", "green");
    });
  });
})(window);
