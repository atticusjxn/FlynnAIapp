export default {
  expo: {
    name: "FlynnAI",
    slug: "FlynnAI",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#3B82F6"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.flynnai.app",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "FlynnAI uses the camera to capture screenshots of job details, quotes, and work orders. This helps automatically extract information and create calendar events for your business.",
        NSPhotoLibraryUsageDescription: "FlynnAI accesses your photo library to select images containing job details that can be automatically processed into calendar events and client information.",
        NSMicrophoneUsageDescription: "FlynnAI uses the microphone to record and transcribe phone calls with clients to automatically capture job details and create bookings."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#3B82F6"
      },
      edgeToEdgeEnabled: true,
      package: "com.flynnai.app"
    },
    web: {
      favicon: "./assets/images/favicon.png"
    },
    extra: {
      // Add Supabase environment variables for production builds
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://zvfeafmmtfplzpnocyjw.supabase.co",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmVhZm1tdGZwbHpwbm9jeWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDE1NDMsImV4cCI6MjA3MTc3NzU0M30.PnSY6rFvczDiDucsyN0nr-luR_Jb6a6O2uAeZxgBiRI",
      eas: {
        projectId: "799dd441-a3f1-4b18-a45d-bea10b3f9dc8"
      }
    }
  }
};