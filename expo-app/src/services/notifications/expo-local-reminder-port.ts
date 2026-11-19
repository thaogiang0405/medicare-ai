import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  LocalReminderNotificationPort,
  LocalReminderNotificationRequest,
  LocalReminderPermission,
  LocalReminderStoragePort,
} from './local-reminder-service';

type ExpoNotificationsModule = {
  IosAuthorizationStatus?: Readonly<{ AUTHORIZED: number; PROVISIONAL: number }>;
  SchedulableTriggerInputTypes: Readonly<{ DATE: string }>;
  getPermissionsAsync(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    ios?: Readonly<{ status?: number }>;
  }>;
  requestPermissionsAsync(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    ios?: Readonly<{ status?: number }>;
  }>;
  getAllScheduledNotificationsAsync(): Promise<readonly Readonly<{ identifier: string }>[]>;
  scheduleNotificationAsync(input: {
    content: LocalReminderNotificationRequest['content'];
    trigger: { type: string; date: Date };
  }): Promise<string>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
};

function getExpoNotifications(): ExpoNotificationsModule {
  // The native module is loaded only if local reminders are actually used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as ExpoNotificationsModule;
}

function normalizePermission(
  result: Awaited<ReturnType<ExpoNotificationsModule['getPermissionsAsync']>>,
  notifications: ExpoNotificationsModule,
): LocalReminderPermission {
  const iosStatus = result.ios?.status;
  const iosAuthorized = notifications.IosAuthorizationStatus
    && (iosStatus === notifications.IosAuthorizationStatus.AUTHORIZED
      || iosStatus === notifications.IosAuthorizationStatus.PROVISIONAL);

  if (result.granted || iosAuthorized) {
    return 'granted';
  }

  return result.canAskAgain ? 'undetermined' : 'denied';
}

export function createExpoLocalReminderNotificationPort(): LocalReminderNotificationPort {
  const notifications = getExpoNotifications();

  return {
    getPermission: async () => normalizePermission(await notifications.getPermissionsAsync(), notifications),
    requestPermission: async () => normalizePermission(await notifications.requestPermissionsAsync(), notifications),
    getScheduledNotificationIds: async () =>
      (await notifications.getAllScheduledNotificationsAsync()).map((notification) => notification.identifier),
    scheduleNotification: async (request) => notifications.scheduleNotificationAsync({
      content: request.content,
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: request.triggerAt,
      },
    }),
    cancelScheduledNotification: (notificationId) => notifications.cancelScheduledNotificationAsync(notificationId),
  };
}

export const asyncStorageLocalReminderPort: LocalReminderStoragePort = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
