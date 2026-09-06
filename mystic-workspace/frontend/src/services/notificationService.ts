import type { AppNotification, EventItem, Message } from '../types'

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
