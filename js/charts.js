/* ============================================================
   Sarp Pitara — dependency-free canvas charts
   ============================================================ */
(function (global) {
  "use strict";
  const SP = (global.SP = global.SP || {});

  const PALETTE = ["#ef4444", "#f59e0b", "#22d3ee", "#10b981", "#a78bfa", "#f472b6", "#60a5fa", "#facc15"];

  function setup(canvas, height) {
    const w = Math.max(160, canvas.clientWidth || canvas.parentElement.clientWidth || 300);
    const h = height || canvas.clientHeight || 220;
    const dpr = global.devicePixelRatio || 1;
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function auto(canvas, drawFn) {
    const render = () => {
      try { drawFn(); } catch (e) { /* ignore transient layout errors */ }
    };
    canvas._spRender = render;
    render();
    if (global.ResizeObserver) {
      if (canvas._spRO) canvas._spRO.disconnect();
      canvas._spRO = new ResizeObserver(render);
      canvas._spRO.observe(canvas.parentElement || canvas);
    } else {
      global.addEventListener("resize", render);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function doughnut(canvas, data, opts) {
    opts = opts || {};
    auto(canvas, () => {
      const { ctx, w, h } = setup(canvas, opts.height || 230);
      const total = data.reduce((s, d) => s + d.value, 0);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.max(30, Math.min(w, h) / 2 - 14);
      const lw = Math.max(14, radius * 0.34);
      ctx.lineWidth = lw;
      ctx.lineCap = "butt";
      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, radius - lw / 2, 0, Math.PI * 2);
      ctx.stroke();

      if (!total) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "600 12px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No data", cx, cy);
        return;
      }
      let start = -Math.PI / 2;
      const gap = data.length > 1 ? 0.035 : 0;
      data.forEach((d, idx) => {
        const angle = (d.value / total) * Math.PI * 2;
        if (angle <= 0) return;
        ctx.beginPath();
        ctx.strokeStyle = d.color || PALETTE[idx % PALETTE.length];
        ctx.arc(cx, cy, radius - lw / 2, start + gap / 2, start + angle - gap / 2);
        ctx.stroke();
        start += angle;
      });
      ctx.textAlign = "center";
      ctx.fillStyle = "#f9fafb";
      ctx.font = "800 22px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText(opts.centerValue != null ? String(opts.centerValue) : String(total), cx, cy + 2);
      ctx.fillStyle = "#9ca3af";
      ctx.font = "600 10px Inter, system-ui, sans-serif";
      ctx.fillText((opts.centerLabel || "TOTAL").toUpperCase(), cx, cy + 20);
    });
  }

  function bars(canvas, data, opts) {
    opts = opts || {};
    auto(canvas, () => {
      const { ctx, w, h } = setup(canvas, opts.height || 230);
      const padL = 34, padR = 12, padT = 18, padB = 38;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const max = Math.max(1, ...data.map((d) => d.value));
      const niceMax = Math.ceil(max / 4) * 4 || 4;
      const steps = 4;

      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      for (let s = 0; s <= steps; s++) {
        const y = padT + plotH - (plotH * s) / steps;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(String(Math.round((niceMax * s) / steps)), padL - 6, y + 3);
      }

      const n = data.length || 1;
      const slot = plotW / n;
      const barW = Math.min(38, slot * 0.58);
      data.forEach((d, i) => {
        const x = padL + slot * i + (slot - barW) / 2;
        const bh = (d.value / niceMax) * plotH;
        const y = padT + plotH - bh;
        const color = d.color || PALETTE[i % PALETTE.length];
        const grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + "55");
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, barW, Math.max(2, bh), 5);
        ctx.fill();

        ctx.fillStyle = "#cbd5e1";
        ctx.font = "700 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        if (d.value > 0) ctx.fillText(String(d.value), x + barW / 2, y - 5);

        ctx.fillStyle = "#9ca3af";
        ctx.font = "10px Inter, system-ui, sans-serif";
        const label = d.label.length > 13 ? d.label.slice(0, 12) + "…" : d.label;
        ctx.save();
        ctx.translate(x + barW / 2, padT + plotH + 14);
        if (slot < 62) ctx.rotate(-0.45);
        ctx.textAlign = slot < 62 ? "right" : "center";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });
    });
  }

  function line(canvas, points, opts) {
    opts = opts || {};
    auto(canvas, () => {
      const { ctx, w, h } = setup(canvas, opts.height || 230);
      const padL = 34, padR = 14, padT = 18, padB = 32;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const max = Math.max(1, ...points.map((p) => p.value));
      const niceMax = Math.ceil(max / 4) * 4 || 4;
      const steps = 4;

      ctx.strokeStyle = "rgba(148,163,184,0.12)";
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      for (let s = 0; s <= steps; s++) {
        const y = padT + plotH - (plotH * s) / steps;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(String(Math.round((niceMax * s) / steps)), padL - 6, y + 3);
      }

      const n = points.length;
      if (!n) return;
      const stepX = n > 1 ? plotW / (n - 1) : 0;
      const coords = points.map((p, i) => ({
        x: padL + stepX * i,
        y: padT + plotH - (p.value / niceMax) * plotH,
        p
      }));

      const color = opts.color || "#ef4444";
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.moveTo(coords[0].x, padT + plotH);
      coords.forEach((c) => ctx.lineTo(c.x, c.y));
      ctx.lineTo(coords[coords.length - 1].x, padT + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      coords.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      coords.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = "#0b0f17";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      const every = Math.ceil(n / 8);
      points.forEach((p, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        ctx.fillText(p.label, padL + stepX * i, padT + plotH + 18);
      });
    });
  }

  SP.Charts = { PALETTE, doughnut, bars, line };
})(window);
