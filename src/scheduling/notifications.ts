import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleTestNotification() {
  return Notifications.scheduleNotificationAsync({
    content: { title: "Test reminder", body: "Notifications are working." },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
}
