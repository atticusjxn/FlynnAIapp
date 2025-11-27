import { Alert, Linking, Platform } from 'react-native';

const sanitizePhoneNumber = (raw: string) => raw?.replace(/[^0-9+*#,;]/g, '') || '';

export const openPhoneDialer = async (rawPhone: string, context?: string): Promise<boolean> => {
  const phone = sanitizePhoneNumber(rawPhone);

  if (!phone) {
    Alert.alert('Call unavailable', 'No phone number is available to dial.');
    return false;
  }

  const scheme = Platform.OS === 'android' ? 'tel' : 'tel';
  const telUrl = `${scheme}:${phone}`;

  const canOpen = await Linking.canOpenURL(telUrl);
  if (!canOpen) {
    Alert.alert(
      'Call unavailable',
      'This device cannot start calls. Try from a phone with calling enabled or copy the number.'
    );
    return false;
  }

  try {
    await Linking.openURL(telUrl);
    return true;
  } catch (error) {
    console.error('[Dialer] Failed to open phone dialer', { error, context });
    Alert.alert('Call failed', 'Unable to start the call. Please try again from a phone device.');
    return false;
  }
};

export default {
  openPhoneDialer,
};
