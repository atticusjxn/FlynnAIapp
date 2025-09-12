import * as Linking from 'expo-linking';
import { NavigationContainerRef } from '@react-navigation/native';
import openAIService, { ExtractedJobData } from './OpenAIService';

export interface ShortcutData {
  action: 'process-screenshot';
  imageData?: string; // base64 encoded image
  timestamp?: number;
}

class ShortcutHandler {
  private navigationRef: NavigationContainerRef<any> | null = null;

  setNavigationRef(ref: NavigationContainerRef<any>) {
    this.navigationRef = ref;
  }

  parseShortcutURL(url: string): ShortcutData | null {
    try {
      console.log('[ShortcutHandler] Parsing URL:', url);
      
      const parsed = Linking.parse(url);
      
      // Check if this is our shortcut URL scheme
      if (parsed.scheme !== 'flynn-ai') {
        return null;
      }

      // Parse different shortcut actions
      if (parsed.hostname === 'process-screenshot') {
        return {
          action: 'process-screenshot',
          imageData: parsed.queryParams?.imageData as string,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      console.error('[ShortcutHandler] URL parsing error:', error);
      return null;
    }
  }

  async handleShortcutURL(url: string): Promise<boolean> {
    const shortcutData = this.parseShortcutURL(url);
    
    if (!shortcutData) {
      console.log('[ShortcutHandler] Not a valid shortcut URL');
      return false;
    }

    console.log('[ShortcutHandler] Handling shortcut:', shortcutData.action);

    switch (shortcutData.action) {
      case 'process-screenshot':
        return await this.handleScreenshotProcessing(shortcutData);
      default:
        console.warn('[ShortcutHandler] Unknown shortcut action:', shortcutData.action);
        return false;
    }
  }

  private async handleScreenshotProcessing(data: ShortcutData): Promise<boolean> {
    try {
      if (!this.navigationRef) {
        console.error('[ShortcutHandler] Navigation ref not set');
        return false;
      }

      if (!data.imageData) {
        console.error('[ShortcutHandler] No image data provided');
        return false;
      }

      // Navigate to processing screen first
      this.navigationRef.navigate('UploadFlow', {
        screen: 'Processing',
        params: {
          imageUri: `data:image/jpeg;base64,${data.imageData}`,
          isFromShortcut: true
        }
      });

      // Process the image with OpenAI in the background
      this.processScreenshotAsync(data.imageData);

      return true;
    } catch (error) {
      console.error('[ShortcutHandler] Screenshot processing error:', error);
      return false;
    }
  }

  private async processScreenshotAsync(imageBase64: string): Promise<void> {
    try {
      console.log('[ShortcutHandler] Starting AI processing...');
      
      // Extract job data from the image
      const extractedData = await openAIService.extractJobFromImage(imageBase64);
      
      console.log('[ShortcutHandler] AI processing complete:', extractedData);

      // Navigate to results screen with extracted data
      if (this.navigationRef) {
        // Small delay to ensure processing screen is shown first
        setTimeout(() => {
          this.navigationRef?.navigate('UploadFlow', {
            screen: 'Results',
            params: {
              imageUri: `data:image/jpeg;base64,${imageBase64}`,
              extractedData: this.mapToLegacyFormat(extractedData),
              isFromShortcut: true,
              confidence: extractedData.confidence
            }
          });
        }, 2000); // 2 second delay to show processing
      }
    } catch (error) {
      console.error('[ShortcutHandler] AI processing failed:', error);
      
      // Navigate to results with error state
      if (this.navigationRef) {
        setTimeout(() => {
          this.navigationRef?.navigate('UploadFlow', {
            screen: 'Results',
            params: {
              imageUri: `data:image/jpeg;base64,${imageBase64}`,
              extractedData: {
                clientName: '',
                serviceType: '',
                date: '',
                time: '',
                location: '',
                notes: 'Failed to process screenshot. Please enter details manually.',
                phone: '',
                estimatedDuration: ''
              },
              isFromShortcut: true,
              confidence: 0,
              error: 'Processing failed'
            }
          });
        }, 1000);
      }
    }
  }

  private mapToLegacyFormat(data: ExtractedJobData): any {
    // Map OpenAI response to the format expected by ResultsScreen
    return {
      clientName: data.clientName || '',
      serviceType: data.serviceType || '',
      date: data.date || '',
      time: data.time || '',
      location: data.location || '',
      notes: data.notes || '',
      phone: data.phone || '',
      estimatedDuration: '1-2 hours', // Default estimate
      businessType: data.businessType
    };
  }

  // Generate the iOS Shortcut URL for installation
  generateShortcutInstallationURL(): string {
    // This will be the actual shortcut definition
    // For now, return a placeholder - we'll create the actual shortcut definition later
    return 'shortcuts://x-callback-url/import-shortcut/?url=https://flynn-ai.com/shortcuts/screenshot-processor.shortcut';
  }

  // Test if the shortcut is properly configured
  async testShortcut(): Promise<boolean> {
    try {
      // Try to create a test URL
      const testURL = 'flynn-ai://process-screenshot?test=true';
      const canOpen = await Linking.canOpenURL(testURL);
      return canOpen;
    } catch (error) {
      console.error('[ShortcutHandler] Test failed:', error);
      return false;
    }
  }
}

export const shortcutHandler = new ShortcutHandler();
export default shortcutHandler;