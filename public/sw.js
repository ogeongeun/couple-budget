self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "둘의 하루", {
      body: data.body || "새로운 알림이 있어요.",
      icon: "/chorong-mint-collar-no-charm-v2.png",
      badge: "/chorong-mint-collar-no-charm-v2.png",
      data: { url: data.url || "/notifications" },
      tag: data.tag || "couple-budget-notification",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
