import { Linking, Alert, Platform } from 'react-native';

/**
 * Service for sharing pre-made Siri Shortcuts via iCloud links
 * This approach is used by many popular apps for easy 1-tap shortcut installation
 */
export class ShortcutSharingService {
  // Official Flynn AI iCloud shortcut link for 1-tap installation
  // This shortcut takes a screenshot and sends it to Flynn AI for processing
  private static SHORTCUT_ICLOUD_URL = 'https://www.icloud.com/shortcuts/011f7e0db25c498ab569b1640356162e';
  
  // Backup: Direct shortcut installation URL (for iOS 16+)
  private static SHORTCUT_INSTALL_URL = 'shortcuts://import-shortcut?url=https://flynnai.app/shortcuts/screenshot-processor.shortcut';

  /**
   * Opens the pre-made shortcut for 1-tap installation
   */
  static async installShortcut(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      Alert.alert('iOS Only', 'Shortcuts are only available on iOS devices.');
      return false;
    }

    try {
      // Try the iCloud link first (most reliable)
      const canOpenICloud = await Linking.canOpenURL(this.SHORTCUT_ICLOUD_URL);
      
      if (canOpenICloud || this.SHORTCUT_ICLOUD_URL.includes('icloud.com/shortcuts/')) {
        await Linking.openURL(this.SHORTCUT_ICLOUD_URL);
        return true;
      }

      // Fallback to shortcuts:// URL scheme
      const shortcutsURL = 'shortcuts://create-shortcut';
      const canOpenShortcuts = await Linking.canOpenURL(shortcutsURL);
      
      if (canOpenShortcuts) {
        await Linking.openURL(shortcutsURL);
        Alert.alert(
          'Create Shortcut',
          'Add these actions:\n1. Take Screenshot\n2. Open URL: flynn-ai://process-screenshot',
          [{ text: 'OK' }]
        );
        return true;
      }

      // Last resort: Open Shortcuts app
      await Linking.openURL('shortcuts://');
      return true;
    } catch (error) {
      console.error('Error installing shortcut:', error);
      return false;
    }
  }

  /**
   * Creates the shortcut data that would be shared
   * This is the structure for when you create your own shortcut file
   */
  static getShortcutDefinition() {
    return {
      WFWorkflowActions: [
        {
          WFWorkflowActionIdentifier: 'is.workflow.actions.takescreenshot',
          WFWorkflowActionParameters: {}
        },
        {
          WFWorkflowActionIdentifier: 'is.workflow.actions.base64encode',
          WFWorkflowActionParameters: {
            WFInput: {
              Value: {
                attachmentsByRange: {
                  '{0, 1}': {
                    Type: 'ActionOutput',
                    OutputUUID: 'SCREENSHOT_OUTPUT_ID'
                  }
                }
              },
              WFSerializationType: 'WFTextTokenString'
            }
          }
        },
        {
          WFWorkflowActionIdentifier: 'is.workflow.actions.openurl',
          WFWorkflowActionParameters: {
            WFURLActionURL: {
              Value: {
                string: 'flynn-ai://process-screenshot?imageData=',
                attachmentsByRange: {
                  '{41, 1}': {
                    Type: 'ActionOutput', 
                    OutputUUID: 'BASE64_OUTPUT_ID'
                  }
                }
              },
              WFSerializationType: 'WFTextTokenString'
            }
          }
        }
      ],
      WFWorkflowClientVersion: '2510.0.4',
      WFWorkflowHasOutputFallback: false,
      WFWorkflowHasShortcutInputVariables: false,
      WFWorkflowIcon: {
        WFWorkflowIconGlyphNumber: 59446,
        WFWorkflowIconStartColor: 2071128575
      },
      WFWorkflowImportQuestions: [],
      WFWorkflowInputContentItemClasses: [],
      WFWorkflowMinimumClientVersion: 900,
      WFWorkflowMinimumClientVersionString: '900',
      WFWorkflowName: 'Process Screenshot with Flynn AI',
      WFWorkflowOutputContentItemClasses: [],
      WFWorkflowTypes: ['NCWidget', 'WatchKit']
    };
  }
}

export default ShortcutSharingService;