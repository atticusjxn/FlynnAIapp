declare module 'react-native-siri-shortcut' {
  export interface ShortcutOptions {
    activityType: string;
    title: string;
    userInfo?: Record<string, any>;
    eligibleForSearch?: boolean;
    eligibleForPrediction?: boolean;
    suggestedInvocationPhrase?: string;
    isEligibleForHandoff?: boolean;
    needsSave?: boolean;
  }

  export interface ShortcutCallbackOptions {
    status: 'added' | 'cancelled' | 'failed';
  }

  export type ShortcutCallback = (options: ShortcutCallbackOptions) => void;

  export default class SiriShortcuts {
    static presentShortcut(
      options: ShortcutOptions, 
      callback: ShortcutCallback
    ): Promise<void>;
    
    static donateShortcut(options: ShortcutOptions): Promise<void>;
  }
}