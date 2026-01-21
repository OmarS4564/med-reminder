import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { Medication } from '../models/medication'
import { DB } from '../storage/db'

const ANDROID_CHANNEL_ID = 'dose-reminders'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return
  Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Dose reminders',
    importance: Notifications.AndroidImportance.HIGH,
  })
}

export async function ensureNotificationPermission(): Promise<boolean> {
  ensureAndroidChannel()

  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true

  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

function parseStoredTimeToHourMinute(t: string): { hour: number; minute: number } | null {
  const m = t.trim().match(/^(\d{2}):(\d{2})$/)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null
  return { hour, minute }
}

export async function rescheduleAllDoseNotifications(meds: Medication[]) {
  ensureAndroidChannel()

  await Notifications.cancelAllScheduledNotificationsAsync()

  const activeMeds = meds.filter(m => m.active)

  for (const med of activeMeds) {
    for (const t of med.times) {
      const hm = parseStoredTimeToHourMinute(t)
      if (!hm) continue

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication reminder',
          body: `${med.name} (${med.dosageText})`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hm.hour,
          minute: hm.minute,
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      })
    }
  }
}

export async function rescheduleFromDb() {
  const meds = await DB.getMeds()
  await rescheduleAllDoseNotifications(meds)
}
