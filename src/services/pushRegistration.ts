import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { apiClient } from './apiClient';

let lastRegisteredToken: string | null = null;

export const getPushNotificationStatus = async (): Promise<{
  permissionGranted: boolean;
  tokenRegistered: boolean;
  isDevice: boolean;
}> => {
  const isDevice = Device.isDevice;

  if (!isDevice) {
    return {
      permissionGranted: false,
      tokenRegistered: false,
      isDevice: false,
    };
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    const permissionGranted = status === 'granted';

    return {
      permissionGranted,
      tokenRegistered: !!lastRegisteredToken,
      isDevice,
    };
  } catch (error) {
    console.warn('[Push] Failed to get notification status:', error);
    return {
      permissionGranted: false,
      tokenRegistered: false,
      isDevice,
    };
  }
};

const ensureNotificationChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch (error) {
    console.warn('[Push] Failed to configure Android notification channel:', error);
  }
};

const requestPermissions = async () => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') {
      return existingStatus;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  } catch (error) {
    console.warn('[Push] Failed to request notification permissions:', error);
    return 'denied';
  }
};

interface RegisterOptions {
  force?: boolean;
}

export const registerDevicePushToken = async (options: RegisterOptions = {}): Promise<boolean> => {
  if (!Device.isDevice) {
    console.log('[Push] Skipping push registration on simulator or non-device environment.');
    return false;
  }

  const permissionStatus = await requestPermissions();
  if (permissionStatus !== 'granted') {
    console.log('[Push] Notification permission not granted. Current status:', permissionStatus);
    return false;
  }

  await ensureNotificationChannel();

  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token) {
      console.warn('[Push] Device push token not available.');
      return false;
    }

    if (!options.force && token === lastRegisteredToken) {
      return true;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    await apiClient.post('/me/notifications/token', {
      token,
      platform,
    });

    lastRegisteredToken = token;
    console.log('[Push] Registered device token with backend.');
    return true;
  } catch (error) {
    console.warn('[Push] Failed to register device push token:', error);
    return false;
  }
};
