/* ============================================================
   Sarp Pitara — offline service worker
   Precache the full shell + datasets so the app works with no
   network after the first visit. Cache-first for same-origin GET.
   ============================================================ */
const VERSION = "sarp-pitara-v1.0.1";
const SHELL = VERSION + "-shell";
const RUNTIME = VERSION + "-runtime";

const ASSETS = [
  "./",
  "./index.html",
  "./register-bite.html",
  "./case-directory.html",
  "./asv-locator.html",
  "./snakes.html",
  "./export.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/db.js",
  "./js/triage.js",
  "./js/charts.js",
  "./js/sync.js",
  "./js/dashboard.js",
  "./js/intake.js",
  "./js/cases.js",
  "./js/locator.js",
  "./js/guide.js",
  "./js/export.js",
  "./assets/data/jaunpur_villages.json",
  "./assets/data/hospitals_jaunpur.json",
  "./assets/data/snakes_guide.json",
  "./assets/data/administrative-divisions.json",
  "./assets/images/taxa/krait.jpg",
  "./assets/images/taxa/cobra.jpg",
  "./assets/images/taxa/russells_viper.jpg",
  "./assets/images/taxa/saw_scaled.jpg",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      Promise.allSettled(ASSETS.map((url) => cache.add(new Request(url, { cache: "reload" }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function isCacheable(response) {
  return response && response.ok && (response.type === "basic" || response.type === "default");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) =>
        cached ||
        fetch(req).catch(() => caches.match("./index.html", { ignoreSearch: true }))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (isCacheable(res)) {
          const copy = res.clone();
          caches.open(RUNTIME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then((fallback) => fallback || Response.error())
      );
    })
  );
});
