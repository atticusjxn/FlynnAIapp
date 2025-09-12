// iOS Shortcut Configuration for Flynn AI Screenshot Processing
// This file contains the shortcut definition and instructions

export interface ShortcutAction {
  type: string;
  parameters?: Record<string, any>;
}

export interface ShortcutDefinition {
  name: string;
  icon: {
    glyph: string;
    color: string;
  };
  actions: ShortcutAction[];
  description: string;
}

// The actual iOS Shortcut definition
export const flynnAIScreenshotShortcut: ShortcutDefinition = {
  name: "Flynn AI Screenshot",
  description: "Take a screenshot and process it in Flynn AI for job creation",
  icon: {
    glyph: "camera.fill",
    color: "blue"
  },
  actions: [
    {
      type: "is.workflow.actions.takescreenshot",
      parameters: {}
    },
    {
      type: "is.workflow.actions.base64encode",
      parameters: {
        "WFEncodeMode": "Encode"
      }
    },
    {
      type: "is.workflow.actions.url",
      parameters: {
        "WFURLActionURL": "flynn-ai://process-screenshot?imageData="
      }
    },
    {
      type: "is.workflow.actions.appendvariable",
      parameters: {
        "WFVariableName": "Base64 Encoded Image"
      }
    },
    {
      type: "is.workflow.actions.openurl",
      parameters: {}
    },
    {
      type: "is.workflow.actions.notification",
      parameters: {
        "WFNotificationActionTitle": "Processing Screenshot",
        "WFNotificationActionBody": "Flynn AI is analyzing your screenshot..."
      }
    }
  ]
};

// Alternative simple shortcut for testing
export const simpleTestShortcut: ShortcutDefinition = {
  name: "Flynn AI Test",
  description: "Simple test shortcut for Flynn AI",
  icon: {
    glyph: "bolt.fill",
    color: "blue"
  },
  actions: [
    {
      type: "is.workflow.actions.url",
      parameters: {
        "WFURLActionURL": "flynn-ai://process-screenshot?test=true"
      }
    },
    {
      type: "is.workflow.actions.openurl",
      parameters: {}
    }
  ]
};

// Manual setup instructions
export const setupInstructions = {
  title: "Flynn AI iOS Shortcut Setup",
  steps: [
    {
      title: "Open Shortcuts App",
      description: "Find and tap the Shortcuts app on your iPhone home screen"
    },
    {
      title: "Create New Shortcut",
      description: "Tap the '+' button in the top right corner to create a new shortcut"
    },
    {
      title: "Add Take Screenshot Action",
      description: "Search for 'Take Screenshot' and add this action to your shortcut"
    },
    {
      title: "Add Base64 Encode Action",
      description: "Search for 'Base64 Encode' and add this action after Take Screenshot"
    },
    {
      title: "Add Text Action",
      description: "Add a 'Text' action and enter: flynn-ai://process-screenshot?imageData="
    },
    {
      title: "Add Get Variable Action",
      description: "Add 'Get Variable' action and select the Base64 encoded image"
    },
    {
      title: "Add Combine Text Action", 
      description: "Add 'Combine Text' to join the URL and the base64 image data"
    },
    {
      title: "Add Open URLs Action",
      description: "Add 'Open URLs' action to open the combined URL"
    },
    {
      title: "Configure Shortcut Settings",
      description: "Tap the settings icon, name your shortcut 'Flynn AI Screenshot', and choose an icon"
    },
    {
      title: "Add to Control Center",
      description: "Enable 'Use with Control Center' in the shortcut settings"
    }
  ],
  troubleshooting: [
    {
      issue: "Shortcut doesn't appear in Control Center",
      solution: "Make sure you enabled 'Use with Control Center' in the shortcut settings"
    },
    {
      issue: "Flynn AI doesn't open",
      solution: "Check that your URL is exactly: flynn-ai://process-screenshot"
    },
    {
      issue: "Screenshot processing fails",
      solution: "Ensure the screenshot contains clear, readable text"
    }
  ]
};

// Generate the shortcut URL for sharing/installation
export const generateShortcutURL = (shortcut: ShortcutDefinition): string => {
  // In a real implementation, this would generate a proper .shortcut file
  // For now, we'll return instructions to manually create the shortcut
  return `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(shortcut.name)}`;
};

export const SHORTCUT_URL_SCHEME = 'flynn-ai://process-screenshot';

// Siri Shortcut configuration for react-native-siri-shortcut
export const SIRI_SHORTCUT_DEFINITION = {
  activityType: 'com.flynnai.screenshot-processing',
  title: 'Process Screenshot with Flynn AI',
  userInfo: {
    url: SHORTCUT_URL_SCHEME,
  },
  eligibleForSearch: true,
  eligibleForPrediction: true,
  suggestedInvocationPhrase: 'Process screenshot with Flynn',
  isEligibleForHandoff: false,
  needsSave: false,
};

// Export the primary shortcut for use in the app
export default flynnAIScreenshotShortcut;