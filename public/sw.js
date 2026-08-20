const CACHE_NAME = "receipts-v3";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/og.svg",
  "/Bharat%20Petroleum%20Logo.svg",
  "/SKN%20Natural%20Gas%20Logo.png",
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const page = await fetch("/");
  await cache.put("/", page.clone());
  const html = await page.text();
  const referencedAssets = Array.from(
    html.matchAll(/\b(?:src|href)="([^"]+)"/g),
    (match) => match[1],
  ).filter((url) => url.startsWith("/") && !url.startsWith("//"));

  await Promise.all(
    [...new Set([...APP_SHELL, ...referencedAssets])].map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // A non-essential asset should not prevent the worker from installing.
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match("/") : undefined)),
  );
});
