const API_BASE_URL = process.env.APP_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://flynnai-telephony.fly.dev';

export default {
  expo: {
    scheme: "flynnai",
    plugins: [
      "expo-asset",
      "expo-secure-store",
      "expo-notifications",
      "expo-font",
      "expo-web-browser",
      [
        "expo-image-picker",
        {
          "photosPermission": "FlynnAI accesses your photo library to select images containing job details that can be automatically processed into calendar events and client information.",
          "cameraPermission": "FlynnAI uses the camera to capture screenshots of job details, quotes, and work orders. This helps automatically extract information and create calendar events for your business.",
          "androidUsesGalleryAsImagePicker": true
        }
      ],
    ],
    name: "FlynnAI",
    slug: "FlynnAI",
    version: "1.1.4",
    orientation: "portrait",
    icon: "./assets/images/adaptive-icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    updates: {
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0
    },
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#3B82F6"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.flynnai.app",
      deploymentTarget: "13.4",
      buildNumber: "54",
      icon: "./assets/images/adaptive-icon.png",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "FlynnAI uses the camera to capture screenshots of job details, quotes, and work orders. This helps automatically extract information and create calendar events for your business.",
        NSPhotoLibraryUsageDescription: "FlynnAI accesses your photo library to select images containing job details that can be automatically processed into calendar events and client information.",
        NSMicrophoneUsageDescription: "FlynnAI uses the microphone to record and transcribe phone calls with clients to automatically capture job details and create bookings.",
        NSUserNotificationUsageDescription: "FlynnAI sends push notifications when new jobs are created so you never miss important follow-ups."
      }
    },
    android: {
      versionCode: 54,
      permissions: [
        "RECORD_AUDIO",
        "READ_PHONE_STATE",
        "POST_NOTIFICATIONS",
        "INTERNET",
        "WAKE_LOCK",
        "VIBRATE"
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#FF6B35"
      },
      edgeToEdgeEnabled: true,
      package: "com.flynnai.app"
    },
    web: {
      favicon: "./assets/images/favicon.png"
    },
    extra: {
      // Hardcode for production builds to avoid undefined env vars
      supabaseUrl: "https://zvfeafmmtfplzpnocyjw.supabase.co",
      supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmVhZm1tdGZwbHpwbm9jeWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDE1NDMsImV4cCI6MjA3MTc3NzU0M30.PnSY6rFvczDiDucsyN0nr-luR_Jb6a6O2uAeZxgBiRI",
      releaseChannel: process.env.APP_ENV || "production",
      apiBaseUrl: API_BASE_URL,
      eas: {
        projectId: "799dd441-a3f1-4b18-a45d-bea10b3f9dc8"
      }
    }
  }
};
