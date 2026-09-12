// NOVA / Mystic Workspace - Native Web Push Service Worker for Calls & Alerts

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notifications from server
self.addEventListener('push', (event) => {
  let data = {
    type: 'GENERAL',
    title: 'NOVA Workspace',
    body: 'You have a new update in your workspace.',
    icon: '/vite.svg',
    badge: '/vite.svg',
    url: '/',
    tag: 'nova-notification'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const isCall = data.type === 'INCOMING_CALL';
  const callType = data.callType === 'VIDEO' ? 'Video' : 'Voice';
  const callerName = data.callerName || 'Teammate';

  const title = isCall ? `Incoming ${callType} Call` : data.title;
  const body = isCall ? `${callerName} is calling you...` : data.body;

  const targetUrl = data.url || (
    isCall
      ? `/?action=accept&callerId=${data.callerId || ''}&callerName=${encodeURIComponent(callerName)}&isVideo=${data.isVideo ? 'true' : 'false'}&roomId=${data.roomId || ''}`
      : '/'
  );

  const options = {
    body: body,
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: data.tag || (isCall ? `incoming-call-${data.callerId || Date.now()}` : 'nova-alert'),
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [500, 200, 500, 200, 500, 200, 500] : [100, 50, 100],
    data: {
      ...data,
      url: targetUrl,
      dateOfArrival: Date.now()
    },
    actions: isCall
      ? [
          { action: 'accept', title: '📞 Accept' },
          { action: 'decline', title: '❌ Decline' }
        ]
      : (data.actions || [])
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle user clicking on a native notification or action button
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};

  if (action === 'decline') {
    // Notify clients that call was declined
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'DECLINE_CALL_PUSH',
          callerId: notifData.callerId,
          roomId: notifData.roomId
        });
      }
    });
    return;
  }

  const targetUrl = notifData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (notifData.type === 'INCOMING_CALL') {
            client.postMessage({
              type: 'ACCEPT_CALL_PUSH',
              callerId: notifData.callerId,
              callerName: notifData.callerName,
              isVideo: notifData.isVideo,
              roomId: notifData.roomId
            });
          }
          if (client.navigate) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
