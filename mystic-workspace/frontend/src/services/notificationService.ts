import api from './api'
import type { AppNotification, EventItem, Message } from '../types'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null

  constructor() {
    this.initServiceWorker()
  }

  public async initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      this.swRegistration = registration
      return registration
    } catch (err) {
      console.warn('Service worker registration failed:', err)
      return null
    }
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied'
    }
    return Notification.permission
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (err) {
      console.error('Error requesting notification permission:', err)
      return false
    }
  }

  /**
   * Subscribes the current device to native Web Push notifications for incoming calls and system alerts.
   */
  public async subscribeToPushNotifications(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported in this browser environment')
      return false
    }

    try {
      const reg = await this.initServiceWorker()
      if (!reg) return false

      const permission = await this.requestPermission()
      if (!permission) return false

      // Fetch VAPID public key from backend
      let vapidPublicKey: string | null = null
      try {
        const res = await api.get<{ publicKey: string }>('/notifications/vapid-public-key')
        vapidPublicKey = res.data?.publicKey
      } catch (err) {
        console.warn('Failed to fetch VAPID key from backend, using fallback:', err)
        vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuYkr3qBUYIHBQFLXYp5Nksh8U'
      }

      if (!vapidPublicKey) return false

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

      // Subscribe to PushManager
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      })

      // Send subscription object to backend
      await api.post('/notifications/subscribe', subscription.toJSON())
      console.log('Successfully registered Web Push Subscription for user')
      return true
    } catch (err) {
      console.error('Error subscribing to Push Notifications:', err)
      return false
    }
  }

  /**
   * Unsubscribes current device from Web Push notifications.
   */
  public async unsubscribeFromPushNotifications(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false

    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await api.post('/notifications/unsubscribe', { endpoint })
        return true
      }
      return false
    } catch (err) {
      console.error('Error unsubscribing from Push Notifications:', err)
      return false
    }
  }

  public async showNativeNotification(
    title: string,
    options?: {
      body?: string
      icon?: string
      tag?: string
      url?: string
      data?: any
    }
  ): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return

    const defaultIcon = '/vite.svg'
    const notificationOptions = {
      body: options?.body || '',
      icon: options?.icon || defaultIcon,
      badge: defaultIcon,
      tag: options?.tag || 'nova-alert',
      vibrate: [100, 50, 100],
      data: {
        url: options?.url || '/',
        ...(options?.data || {}),
      },
    }

    // Try via Service Worker first (for mobile background support)
    if (this.swRegistration && 'showNotification' in this.swRegistration) {
      try {
        await this.swRegistration.showNotification(title, notificationOptions as any)
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100])
        }
        return
      } catch (err) {
        console.warn('Service worker showNotification fallback:', err)
      }
    }

    // Standard Window Notification fallback
    try {
      const notif = new Notification(title, notificationOptions)
      notif.onclick = () => {
        window.focus()
        if (options?.url) {
          window.location.href = options.url
        }
        notif.close()
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100])
      }
    } catch (err) {
      console.error('Failed to trigger window Notification:', err)
    }
  }

  /**
   * Evaluates Calendar Events and generates:
   * 1. Evening-before reminders for tomorrow's events
   * 2. Morning-of reminders for today's events
   */
  public evaluateCalendarReminders(events: EventItem[]): AppNotification[] {
    const newNotifications: AppNotification[] = []
    const now = new Date()
    const currentHour = now.getHours()

    const todayStr = now.toDateString()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toDateString()

    events.forEach((ev) => {
      if (!ev.startTime) return
      const eventDate = new Date(ev.startTime)
      const eventDateStr = eventDate.toDateString()
      const timeFormatted = eventDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })

      // 1. Evening-Before Reminder (for tomorrow's events, active from 6:00 PM onwards)
      if (eventDateStr === tomorrowStr && currentHour >= 18) {
        const storageKey = `nova_remind_eve_${ev.id || ev.title}_${tomorrowStr}`
        if (!localStorage.getItem(storageKey)) {
          localStorage.setItem(storageKey, new Date().toISOString())
          const notif: AppNotification = {
            id: `eve-${ev.id || Math.random()}-${Date.now()}`,
            type: 'CALENDAR_EVENING',
            title: `📅 Tomorrow: ${ev.title}`,
            body: `Scheduled for tomorrow at ${timeFormatted}${ev.location ? ` • ${ev.location}` : ''}`,
            targetUrl: '/calendar',
            createdAt: new Date().toISOString(),
            eventId: ev.id,
          }
          newNotifications.push(notif)
          this.showNativeNotification(notif.title, {
            body: notif.body,
            url: notif.targetUrl,
            tag: `cal-eve-${ev.id}`,
          })
        }
      }

      // 2. Morning-Of Reminder (for today's events, active from 6:00 AM onwards)
      if (eventDateStr === todayStr && currentHour >= 6) {
        const storageKey = `nova_remind_morn_${ev.id || ev.title}_${todayStr}`
        if (!localStorage.getItem(storageKey)) {
          localStorage.setItem(storageKey, new Date().toISOString())
          const notif: AppNotification = {
            id: `morn-${ev.id || Math.random()}-${Date.now()}`,
            type: 'CALENDAR_MORNING',
            title: `☀️ Today's Schedule: ${ev.title}`,
            body: `Starting at ${timeFormatted}${ev.location ? ` • ${ev.location}` : ''}`,
            targetUrl: '/calendar',
            createdAt: new Date().toISOString(),
            eventId: ev.id,
          }
          newNotifications.push(notif)
          this.showNativeNotification(notif.title, {
            body: notif.body,
            url: notif.targetUrl,
            tag: `cal-morn-${ev.id}`,
          })
        }
      }
    })

    return newNotifications
  }

  /**
   * Dispatches a native device push notification when a new chat message arrives
   */
  public notifyNewChatMessage(msg: Message, currentUserId?: number): AppNotification | null {
    if (msg.sender && msg.sender.id === currentUserId) return null

    const senderName = msg.sender?.name || 'Teammate'
    const notif: AppNotification = {
      id: `msg-${msg.id || Date.now()}`,
      type: 'MESSAGE',
      title: `${senderName}`,
      body: msg.content || (msg.attachments?.length ? 'Sent an attachment' : 'New message received'),
      targetUrl: '/chat',
      senderName,
      createdAt: msg.createdAt || new Date().toISOString(),
      conversationId: msg.conversationId,
    }

    this.showNativeNotification(notif.title, {
      body: notif.body,
      url: notif.targetUrl,
      tag: `chat-conv-${msg.conversationId}`,
    })

    return notif
  }
}

export const notificationService = new NotificationService()
export default notificationService
