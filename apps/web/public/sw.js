self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Reminder", body: "", url: "/" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/journal") && "focus" in client) return client.focus();
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});
