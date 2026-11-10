/* ============================================================
   Sarp Pitara — snake identification guide
   ============================================================ */
(function (global) {
  "use strict";
  const SP = global.SP;
  const $ = SP.$;

  function card(t) {
    const accent = t.risk_color === "red" ? "card-accent-red" : t.risk_color === "green" ? "card-accent-green" : "card-accent-amber";
    const badge = t.risk_color === "red" ? "red" : t.risk_color === "green" ? "green" : "amber";
    const image = t.image
      ? '<img src="' + SP.esc(t.image) + '" alt="' + SP.esc(t.common_name) + '" loading="lazy" style="width:100%;height:190px;object-fit:cover;border-radius:10px;border:1px solid var(--border)" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'">' +
        '<div style="display:none;height:190px;border-radius:10px;border:1px dashed var(--border-strong);place-items:center;color:var(--muted)">Photo unavailable offline</div>'
      : '<div style="height:190px;border-radius:10px;border:1px dashed var(--border-strong);display:grid;place-items:center;color:var(--muted);background:#0d1420"><div class="center"><div style="font-size:2rem">🐍</div><div class="small">No reference photo</div></div></div>';
    return '<article class="card ' + accent + '">' +
      image +
      '<div class="spread" style="margin-top:12px;align-items:flex-start">' +
        "<div><h2 style='margin:0'>" + SP.esc(t.common_name) + "</h2>" +
        '<div class="muted">' + SP.esc(t.hindi_name) + " · <i>" + SP.esc(t.scientific_name) + "</i></div></div>" +
        '<span class="badge ' + badge + '">' + SP.esc(t.risk_color === "green" ? "NON-VENOMOUS" : "VENOMOUS") + "</span>" +
      "</div>" +
      '<div class="row" style="margin:10px 0">' +
        '<span class="badge ' + (t.venom_type === "Neurotoxic" ? "amber" : t.venom_type === "Hemotoxic" ? "red" : t.venom_type === "Non-Venomous" ? "green" : "violet") + '">' + SP.esc(t.venom_type) + "</span>" +
        '<span class="badge">' + SP.esc(t.venom_subtype || "") + "</span>" +
        '<span class="badge">' + SP.esc(t.active_time || "") + "</span>" +
      "</div>" +
      '<div class="stack" style="gap:8px">' +
        '<div><span class="field-label">Identification</span><p class="small muted" style="margin:2px 0 0">' + SP.esc(t.identification) + "</p></div>" +
        '<div><span class="field-label">Clinical signs</span><p class="small muted" style="margin:2px 0 0">' + SP.esc(t.symptoms) + "</p></div>" +
        '<div class="banner ' + (t.risk_color === "green" ? "green" : "amber") + '" style="padding:10px 12px"><span class="ico">' + (t.risk_color === "green" ? "✓" : "⚠") + '</span><div><strong>First response</strong><div class="small muted">' + SP.esc(t.first_aid) + "</div></div></div>" +
      "</div>" +
    "</article>";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const taxa = await SP.loadJSON("assets/data/snakes_guide.json");
      $("#snakeCards").innerHTML = taxa.map(card).join("");
    } catch (e) {
      $("#snakeCards").innerHTML = '<div class="card empty" style="grid-column:1/-1"><div class="big">⚠</div><h3>Could not load snake guide</h3><p class="muted">' + SP.esc(e.message) + "</p></div>";
    }
  });
})(window);
