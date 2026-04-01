/**
 * Safe wrappers around expo-notifications. No Expo account or EAS project is required:
 * remote push registration is skipped when unset / Expo Go / invalid id. Local notifications
 * for chat can still work with OS permission.
 *
 * expo-notifications must NOT be imported at module top level: Expo Go (SDK 53+) throws on
 * Android when the package loads. We lazy-require after first use.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { NotificationContentInput } from 'expo-notifications';

type ExpoNotifications = typeof import('expo-notifications');

/** Must match `defaultChannel` in app.json expo-notifications plugin (rebuild native app after change). */
export const ORBIT_NOTIFICATION_CHANNEL_ID = 'orbit-default';

let notificationsRef: ExpoNotifications | null | undefined;

/** SDK 53+ Expo Go on Android throws when the native module loads — avoid `require` entirely. */
function isExpoGoAndroid(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

function getNotifications(): ExpoNotifications | null {
  if (Platform.OS === 'web') return null;
  if (isExpoGoAndroid()) {
    notificationsRef = null;
    return null;
  }
  if (notificationsRef === null) return null;
  if (notificationsRef !== undefined) return notificationsRef;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notificationsRef = require('expo-notifications') as ExpoNotifications;
    return notificationsRef;
  } catch (e) {
    notificationsRef = null;
    if (__DEV__) {
      console.warn(
        '[notifications] expo-notifications unavailable (Expo Go SDK 53+ on Android, etc.):',
        e
      );
    }
    return null;
  }
}

let handlerInstalled = false;
let androidChannelReady = false;

async function ensureAndroidDefaultChannel(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS !== 'android' || androidChannelReady) return;
  try {
    // Omit `sound` so native uses Settings.System.DEFAULT_NOTIFICATION_URI (see expo-notifications Android channel manager).
    await Notifications.setNotificationChannelAsync(ORBIT_NOTIFICATION_CHANNEL_ID, {
      name: 'Messages & alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      showBadge: true,
    });
    androidChannelReady = true;
  } catch (e) {
    console.warn('[notifications] setNotificationChannelAsync failed:', e);
  }
}

/**
 * Create Android channel + request OS permission once the user is in the main app.
 * Without this, builds with no EAS project never call `tryRegisterExpoPushToken`, so Android 13+
 * POST_NOTIFICATIONS was never requested and local chat alerts fail silently.
 */
export async function prepareNotificationEnvironment(): Promise<void> {
  if (Platform.OS === 'web' || !getNotifications()) return;
  await ensureAndroidDefaultChannel();
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return;
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {},
    });
  } catch (e) {
    console.warn('[notifications] prepareNotificationEnvironment failed:', e);
  }
}

function isInvalidEasProjectId(id: unknown): boolean {
  if (id == null || typeof id !== 'string') return true;
  const t = id.trim();
  if (!t) return true;
  if (t === 'your-project-id') return true;
  if (/^your-/i.test(t)) return true;
  return false;
}

/** Call once on app start (native only). */
export function installNotificationHandlerSafe(): void {
  if (Platform.OS === 'web' || handlerInstalled) return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerInstalled = true;
  } catch (e) {
    console.warn('[notifications] setNotificationHandler failed:', e);
  }
  void ensureAndroidDefaultChannel();
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export type RegisterPushOptions = {
  /** Return true to abort before calling registerFn (e.g. effect cleanup). */
  isCancelled?: () => boolean;
};

export type RegisterPushResult =
  | { status: 'registered'; token: string }
  | { status: 'skipped'; reason: string };

/**
 * Registers Expo push token with your API. No-op on web, simulator, Expo Go, or invalid EAS project.
 */
export async function tryRegisterExpoPushToken(
  registerFn: (token: string) => Promise<void>,
  options?: RegisterPushOptions
): Promise<RegisterPushResult> {
  if (Platform.OS === 'web') return { status: 'skipped', reason: 'web-platform' };
  const cancelled = () => options?.isCancelled?.() === true;

  try {
    const { isDevice } = await import('expo-device');
    if (!isDevice) return { status: 'skipped', reason: 'not-physical-device' };
  } catch {
    return { status: 'skipped', reason: 'expo-device-unavailable' };
  }

  if (isExpoGo()) {
    console.warn(
      '[notifications] Remote push is not available in Expo Go; use a development build (EAS) for FCM/APNs.'
    );
    return { status: 'skipped', reason: 'expo-go' };
  }

  const Notifications = getNotifications();
  if (!Notifications) return { status: 'skipped', reason: 'notifications-module-unavailable' };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

  if (isInvalidEasProjectId(projectId)) {
    console.warn(
      '[notifications] Skipping Expo push: set expo.extra.eas.projectId in app.json to your real EAS project UUID.'
    );
    return { status: 'skipped', reason: 'missing-or-invalid-eas-project-id' };
  }

  try {
    if (cancelled()) return { status: 'skipped', reason: 'cancelled' };
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
        android: {},
      });
      final = status;
    }
    if (final !== 'granted') return { status: 'skipped', reason: 'notifications-permission-denied' };
    if (cancelled()) return { status: 'skipped', reason: 'cancelled' };

    const tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId: projectId as string,
    });
    if (cancelled()) return { status: 'skipped', reason: 'cancelled' };
    if (tokenRes?.data) {
      await registerFn(tokenRes.data);
      return { status: 'registered', token: tokenRes.data };
    }
    return { status: 'skipped', reason: 'empty-token-response' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (Platform.OS === 'android' && /firebase|fcm|google services/i.test(msg)) {
      console.warn(
        '[notifications] Android push needs FCM: add google-services.json from Firebase to your project and rebuild (EAS).',
        msg
      );
    } else {
      console.warn('[notifications] Push token registration failed (ignored):', e);
    }
    return { status: 'skipped', reason: 'registration-error' };
  }
}

/** Local notification for in-app chat alerts; no-op if permissions denied or API errors. */
export async function tryScheduleLocalNotification(
  content: NotificationContentInput
): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await ensureAndroidDefaultChannel();
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: next } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
        android: {},
      });
      if (next !== 'granted') return;
    }

    const mergedContent: NotificationContentInput =
      Platform.OS === 'android'
        ? {
            ...content,
            priority: Notifications.AndroidNotificationPriority.MAX,
            color: '#6D5AE6',
          }
        : content;

    /**
     * Android 8+ requires a channel on the trigger; `trigger: null` often yields
     * ERR_NOTIFICATIONS_FAILED_TO_SCHEDULE in native builds.
     */
    await Notifications.scheduleNotificationAsync({
      content: mergedContent,
      trigger:
        Platform.OS === 'android'
          ? { channelId: ORBIT_NOTIFICATION_CHANNEL_ID }
          : null,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn('[notifications] Local notification failed:', e);
    } else {
      console.warn('[notifications] Local notification skipped:', e);
    }
  }
}

export function addNotificationResponseListenerSafe(
  callback: (data: Record<string, unknown> | undefined) => void
): { remove: () => void } {
  if (Platform.OS === 'web') {
    return { remove: () => {} };
  }
  const Notifications = getNotifications();
  if (!Notifications) {
    return { remove: () => {} };
  }
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        callback(data);
      } catch (e) {
        console.warn('[notifications] response listener error:', e);
      }
    });
    return sub;
  } catch (e) {
    console.warn('[notifications] addNotificationResponseReceivedListener failed:', e);
    return { remove: () => {} };
  }
}
