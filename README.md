# Sarp Pitara 🐍

**Offline-first snakebite surveillance, triage, anti-snake venom (ASV) stock locator and first-aid guide for Jaunpur district, Uttar Pradesh.**

> **Live website:** https://rg100152.github.io/sarp-pitara/

Sarp Pitara ("the snake box") is a frontend-only Progressive Web App that helps health workers, clinics and district administrators respond to snakebite emergencies — even with no network connection. All records are stored locally in the browser via IndexedDB and can be exported or backed up at any time.

---

## Features

- **District Command Dashboard** — live KPIs for total bites, active/hospitalised cases, recoveries, fatalities, ASV vials administered, average time-to-treatment and venomous ratio.
- **Incident analytics** — monthly trend, species distribution, venom class (neurotoxic vs hemotoxic), time-of-bite distribution, age/gender breakdown and a tehsil heatmap.
- **Case intake & triage** — rapid offline registration of a bite with patient details, GPS location, symptoms, first-aid given, ASV dosing and outcome; auto-generated case numbers and printable referral slips.
- **ASV stock locator** — search hospitals/CHCs by name, tehsil and facility type; shows ASV stock, ventilators, blood bank and 24×7 status. Uses device GPS for nearest facility.
- **Snake identification guide** — visual guide to India's Big Four venomous snakes plus mimics, wound morphology key, first-aid protocol and myth-busting.
- **Case directory** — search, filter and manage all locally stored incident records.
- **Backup & export** — export JSON backups or spreadsheet-ready CSV, import/restore, and a local sync outbox that acknowledges records when the device is online.
- **Offline-first PWA** — installable on mobile and desktop; a service worker precaches the full app shell and datasets so it works with no network after the first visit.
- **Bilingual UI** — English and Hindi labels throughout.

---

## Demo / Live Site

Open the app here: **https://rg100152.github.io/sarp-pitara/**

The site is hosted with GitHub Pages. Because data is stored per-device in the browser, each device keeps its own independent dataset. Use the **Backup & Export** page to move data between devices.

---

## Tech Stack

- **Plain HTML, CSS and vanilla JavaScript** — no build step, no framework, no backend.
- **IndexedDB** — local persistence for incidents, facilities and a sync outbox.
- **Service Worker + Web App Manifest** — installable, offline-capable PWA.
- **Canvas API** — charts and the schematic tehsil heatmap.
- **Seed datasets (JSON)** — Jaunpur villages, hospitals/facilities, administrative divisions and the snake guide.

---

## Project Structure

```
.
├── index.html               # District command dashboard
├── register-bite.html       # Case intake & triage form
├── case-directory.html      # Search/filter local incident records
├── asv-locator.html         # ASV stock & facility locator
├── snakes.html              # Big Four guide, first aid & myths
├── export.html              # Backup, export, import & sync
├── manifest.webmanifest     # PWA manifest
├── sw.js                    # Offline service worker
├── css/
│   └── style.css            # App styling
├── js/
│   ├── app.js               # Shared utilities, HUD, demo data
│   ├── db.js                # IndexedDB driver & repository
│   ├── triage.js            # Clinical triage logic
│   ├── intake.js            # Case registration form logic
│   ├── dashboard.js         # Dashboard KPIs & charts
│   ├── charts.js            # Canvas chart renderers
│   ├── cases.js             # Case directory logic
│   ├── locator.js           # ASV locator logic
│   ├── guide.js             # Snake guide renderer
│   ├── sync.js              # Offline outbox / local sync
│   └── export.js            # Backup, export & import
└── assets/
    ├── data/                # Seed JSON datasets
    ├── images/taxa/         # Big Four reference images
    └── icons/               # PWA icons
```

---

## Running Locally

The app is fully static, so any static file server works. For example:

```bash
# Python
python3 -m http.server 8080

# or Node.js
npx serve .
```

Then open `http://localhost:8080`.

> The service worker requires a secure context (`http://localhost` or HTTPS), so test offline behaviour via `localhost` or the deployed GitHub Pages URL.

---

## Deployment (GitHub Pages)

1. Push the files to the `main` branch of the `sarp-pitara` repository.
2. In **Settings → Pages**, set the source to the `main` branch (root).
3. The site is published at **https://rg100152.github.io/sarp-pitara/**.

All asset paths are relative, so the app works from the repository subpath without extra configuration.

---

## Data & Privacy

- **No backend, no tracking.** All incident and facility data stays in the browser's IndexedDB on the device.
- Clearing browser data removes local records — **export a JSON backup first** from the Backup & Export page.
- ASV stock figures in the locator are seed/reference data. **Verify stock by phone before transport.**

---

## Clinical Disclaimer

Sarp Pitara is a **decision-support and surveillance tool**, not a substitute for institutional protocol or professional medical judgment. In an emergency, call **108** (ambulance) and move the patient to an ASV-equipped facility immediately. Polyvalent anti-snake venom is the only evidence-based antidote — do not cut, suck or apply a tight tourniquet.

---

## License

No license has been specified for this project. Please contact the repository owner before reuse or redistribution.
