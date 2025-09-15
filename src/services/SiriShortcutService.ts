import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { SIRI_SHORTCUT_DEFINITION } from '../utils/shortcutDefinition';

// Safely import SiriShortcuts with fallback for development
let SiriShortcuts: any = null;
try {
  SiriShortcuts = require('react-native-siri-shortcut').default;
} catch (error) {
  console.log('SiriShortcuts not available:', error.message);
}

// Check if we're in a production build environment
const isProductionBuild = () => {
  // Check if we're in Expo Go (development)
  if (Constants.appOwnership === 'expo') {
    return false;
  }
  
  // Check if we're in a standalone app (production)
  if (Constants.appOwnership === 'standalone') {
    return true;
  }
  
  // Check if we're in TestFlight or App Store
  if (Constants.executionEnvironment === 'standalone') {
    return true;
  }
  
  // Fallback: check if __DEV__ is false (production build)
  return !__DEV__;
};

// Check if we're specifically in TestFlight
const isTestFlightBuild = () => {
  try {
    // TestFlight builds have a specific receipt structure
    return Constants.manifest?.extra?.eas?.projectId !== undefined && !__DEV__;
  } catch {
    return false;
  }
};

export class SiriShortcutService {
  /**
   * Donate the shortcut to iOS so it appears in Siri suggestions and Spotlight
   */
  static async donateShortcut() {
    if (Platform.OS !== 'ios') {
      console.log('SiriShortcutService: Skipping donation on non-iOS platform');
      return;
    }

    if (!SiriShortcuts) {
      console.log('SiriShortcutService: Skipping donation - native module not available in development');
      return;
    }

    try {
      await SiriShortcuts.donateShortcut(SIRI_SHORTCUT_DEFINITION);
      console.log('SiriShortcutService: Successfully donated shortcut to iOS');
    } catch (error) {
      console.error('SiriShortcutService: Error donating shortcut:', error);
    }
  }

  /**
   * Present the "Add to Siri" dialog to the user
   */
  static async presentShortcut(callback?: (result: { status: string }) => void) {
    console.log('SiriShortcutService: Starting presentShortcut');
    console.log('SiriShortcutService: Platform.OS:', Platform.OS);
    console.log('SiriShortcutService: isProductionBuild():', isProductionBuild());
    console.log('SiriShortcutService: isTestFlightBuild():', isTestFlightBuild());
    console.log('SiriShortcutService: Constants.appOwnership:', Constants.appOwnership);
    console.log('SiriShortcutService: Constants.executionEnvironment:', Constants.executionEnvironment);
    console.log('SiriShortcutService: __DEV__:', __DEV__);
    console.log('SiriShortcutService: SiriShortcuts available:', !!SiriShortcuts);

    if (Platform.OS !== 'ios') {
      console.log('SiriShortcutService: Skipping presentation on non-iOS platform');
      callback?.({ status: 'unsupported' });
      return;
    }

    if (!SiriShortcuts) {
      if (isProductionBuild()) {
        console.log('SiriShortcutService: Native module not available in production build - module not linked properly');
        callback?.({ status: 'unsupported' });
      } else {
        console.log('SiriShortcutService: Native module not available - development mode');
        callback?.({ status: 'development_mode' });
      }
      return;
    }

    try {
      await SiriShortcuts.presentShortcut(SIRI_SHORTCUT_DEFINITION, (result: any) => {
        console.log('SiriShortcutService: Shortcut presentation result:', result);
        callback?.(result);
      });
    } catch (error) {
      console.error('SiriShortcutService: Error presenting shortcut:', error);
      callback?.({ status: 'error' });
    }
  }

  /**
   * Get all available shortcuts (if the library supports it)
   */
  static async getAvailableShortcuts() {
    if (Platform.OS !== 'ios') {
      return [];
    }

    try {
      // Note: This depends on the library's capabilities
      // Some versions of react-native-siri-shortcut may not support this
      return [];
    } catch (error) {
      console.error('SiriShortcutService: Error getting shortcuts:', error);
      return [];
    }
  }
}

export default SiriShortcutService;