// LEMON Web Push Service Worker
self.addEventListener("push", (event) => {
  let data = {
    title: "LEMON Section Alert 🍋",
    body: "A course or timetable section in your plan was updated.",
    url: "/",
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: "/notification-icon.png",
    badge: "/notification-icon.png",
    data: { url: data.url || "/" },
    requireInteraction: false,
    tag: data.tag || "lemon-section-alert",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
