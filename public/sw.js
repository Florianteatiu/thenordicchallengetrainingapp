// Minimal service worker: exists only to receive push events and show a
// notification for them. No offline caching/fetch handling on purpose —
// this app has no offline mode, and an unnecessary fetch handler is the
// most common source of "the app is stuck on an old cached version" bugs.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "The Nordic Challenge", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "The Nordic Challenge";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
