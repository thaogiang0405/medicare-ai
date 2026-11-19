import { LocalReminderService } from './local-reminder-service';

let localReminderService: LocalReminderService | null = null;

/**
 * Defers loading Expo's native notifications module until an opted-in local
 * reminder action or a consented resync actually needs it.
 */
export function getLocalReminderService(): LocalReminderService {
  // Keep AsyncStorage and Expo's native notifications module out of Jest and
  // the default disabled path. They are loaded only after an opted-in sync.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nativePort = require('./expo-local-reminder-port') as typeof import('./expo-local-reminder-port');

  localReminderService ??= new LocalReminderService(
    nativePort.createExpoLocalReminderNotificationPort(),
    nativePort.asyncStorageLocalReminderPort,
  );

  return localReminderService;
}
