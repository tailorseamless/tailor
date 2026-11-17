/*
 * TailorFlow app service worker (Frontend Guide §13.4, §27.1).
 * Makes the app installable and shows an offline page when a page can't load.
 * It deliberately caches NOTHING else — no scripts, no API responses — so a
 * new deploy is live on the next page load and nobody sees stale data.
 */
const CACHE = "tailorflow-offline-v2";
const OFFLINE_ASSETS = ["/offline.html", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Only page navigations are handled; everything else goes straight to the network.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

// Push notifications. The server sends data-only FCM messages: { id, type, title, body, link }.
self.addEventListener("push", (event) => {
  let message = {};
  try {
    const payload = event.data ? event.data.json() : {};
    message = payload.data || payload;
  } catch {
    message = { title: "TailorFlow", body: event.data ? event.data.text() : "" };
  }
  const link = typeof message.link === "string" && message.link.startsWith("/") ? message.link : "/notifications";
  event.waitUntil(
    self.registration.showNotification(message.title || "TailorFlow", {
      body: message.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: message.id || undefined,
      data: { link },
    }),
  );
});

// Tapping a notification opens its page, reusing an open TailorFlow tab when there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(link);
      // navigate() only works on tabs this worker controls; otherwise open a new one.
      return open
        .navigate(link)
        .then((client) => (client ? client.focus() : self.clients.openWindow(link)))
        .catch(() => self.clients.openWindow(link));
    }),
  );
});
