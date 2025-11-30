# Flynn AI - App Store Deployment Guide

## ✅ Pre-Deployment Checklist

### 1. Version & Build Numbers
Current version in `app.config.js`:
- **Version**: 1.1.0
- **iOS Build Number**: 19
- **Android Version Code**: 19

**Before deploying, increment these numbers:**
```javascript
// In app.config.js
version: "1.1.1",  // Increment patch version
ios: {
  buildNumber: "20",  // Increment iOS build
},
android: {
  versionCode: 20,  // Increment Android version code
}
```

### 2. Environment Variables
Ensure all required environment variables are set in your EAS secrets:

```bash
# Check current secrets
eas secret:list

# Required secrets (add if missing):
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_supabase_url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_anon_key"
eas secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value "https://flynnai-telephony.fly.dev"
eas secret:create --scope project --name EXPO_PUBLIC_TWILIO_ACCOUNT_SID --value "your_twilio_sid"
eas secret:create --scope project --name EXPO_PUBLIC_TWILIO_AUTH_TOKEN --value "your_twilio_token"
```

### 3. Test Locally First
```bash
# Clean install
rm -rf node_modules
npm install

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Test key features:
# - Login/Signup with Google OAuth
# - Email code (OTP) authentication
# - Test call functionality (CRITICAL!)
# - Job booking from test call
# - Navigation to Calendar after test call
```

---

## 🚀 Deployment Commands

### **Option 1: Build and Submit Automatically (Recommended)**

This builds the app and submits to both app stores in one command:

```bash
# Build and submit to BOTH iOS and Android stores
eas build --platform all --auto-submit

# OR build and submit separately:

# iOS App Store
eas build --platform ios --auto-submit

# Google Play Store
eas build --platform android --auto-submit
```

### **Option 2: Build First, Submit Later**

If you want to test the build before submitting:

```bash
# Step 1: Build for both platforms
eas build --platform all

# Step 2: Submit when ready
eas submit --platform ios
eas submit --platform android
```

### **Option 3: Production Build with Custom Profile**

Using the production profile from your `eas.json`:

```bash
# Build production version
eas build --profile production --platform all

# Submit production build
eas submit --profile production --platform all
```

---

## 📱 Platform-Specific Commands

### **iOS Only**

```bash
# Build for iOS App Store
eas build --profile production --platform ios

# Submit to App Store Connect
eas submit --platform ios

# Check build status
eas build:list --platform ios
```

### **Android Only**

```bash
# Build for Google Play Store
eas build --profile production --platform android

# Submit to Google Play Console
eas submit --platform android

# Check build status
eas build:list --platform android
```

---

## 🔍 Monitor Build Progress

```bash
# View all builds
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# View build logs
eas build:logs [BUILD_ID]
```

---

## 📋 Post-Build Steps

### **iOS App Store Connect**

After submission:
1. Go to https://appstoreconnect.apple.com
2. Select Flynn AI
3. Wait for build to process (10-30 minutes)
4. Fill in "What's New in This Version" release notes
5. Add screenshots if needed
6. Submit for review
7. Wait for Apple approval (1-3 days)

**Release Notes Template:**
```
What's New in v1.1.1:

✅ Real test calls - Talk to your AI receptionist before going live
✅ Job booking from test calls - See exactly how Flynn captures job details
✅ Improved authentication - Sign in with Google or email code
✅ Bug fixes and performance improvements

Flynn turns missed calls into booked jobs. Never lose a lead again!
```

### **Google Play Console**

After submission:
1. Go to https://play.google.com/console
2. Select Flynn AI
3. Navigate to "Production" → "Releases"
4. Review and edit release
5. Add release notes
6. Submit for review
7. Wait for Google approval (1-3 hours typically)

**Release Notes Template:**
```
🎉 What's New in v1.1.1

✅ Test your AI receptionist with real voice calls
✅ Book jobs directly from test calls
✅ Enhanced login options (Google, email code)
✅ Performance improvements and bug fixes

Never miss a lead - Flynn turns voicemails into booked jobs!
```

---

## 🆘 Troubleshooting

### Build Fails

```bash
# Clear EAS cache and retry
eas build --platform all --clear-cache

# Check for TypeScript errors
npx tsc --noEmit

# Verify credentials
eas credentials
```

### Submission Fails

```bash
# Re-submit with latest build
eas submit --latest --platform ios
eas submit --latest --platform android

# Check submission status
eas submit:list
```

### Version Conflict

If you get "version already exists" error:
1. Update version in `app.config.js`
2. Increment buildNumber (iOS) and versionCode (Android)
3. Rebuild and resubmit

---

## 🔐 App Store Credentials

### iOS (Apple Developer)
- **Team ID**: Check in https://developer.apple.com
- **Bundle ID**: com.flynnai.app
- **App Store Connect**: https://appstoreconnect.apple.com

### Android (Google Play)
- **Package Name**: com.flynnai.app
- **Play Console**: https://play.google.com/console
- **Service Account**: Should be configured in EAS

---

## 📊 Key Features to Highlight in App Store Listing

### App Store Description

**Title**: Flynn AI - AI Receptionist

**Subtitle**: Turn Missed Calls Into Booked Jobs

**Description**:
```
Never miss a lead again. Flynn is your 24/7 AI receptionist that answers missed calls, transcribes voicemails, extracts job details, and automates follow-ups.

🎯 KEY FEATURES

📞 AI Receptionist
• Answers calls when you're busy
• Natural, friendly conversations
• Custom greetings and questions
• Low-latency voice AI

✅ Automatic Job Booking
• Captures client details
• Extracts dates, times, locations
• Creates calendar events
• Sends confirmations

🧪 Test Before You Buy
• Try real conversations with your AI
• See exactly how jobs are captured
• Experience the same quality your callers will
• No payment required to test

📅 Calendar Integration
• Syncs with Google Calendar
• Apple Calendar support
• Event reminders
• Job scheduling

💼 Built for Service Businesses
• Tradespeople & contractors
• Beauty & wellness professionals
• Event planners & venues
• Any service-based business

🔒 Secure & Private
• End-to-end encryption
• GDPR compliant
• Secure data storage
• Control over your data

Download Flynn today and never lose another lead!
```

### Keywords (iOS)
```
ai receptionist, voicemail, missed calls, job booking, calendar, service business, contractor, tradesperson, appointment scheduling, voice ai
```

### Category
- **Primary**: Business
- **Secondary**: Productivity

---

## 🎬 Submission Workflow

### Complete One-Line Deployment:

```bash
# 1. Update version numbers in app.config.js first!

# 2. Then run this single command:
eas build --profile production --platform all --auto-submit
```

That's it! This command will:
1. ✅ Build iOS version
2. ✅ Build Android version
3. ✅ Submit to App Store Connect
4. ✅ Submit to Google Play Console

### Or use the helper script (if exists):

```bash
npm run release:eas
```

(This runs: `eas build --profile production --platform all && eas submit --profile production`)

---

## 📧 Contact

If you encounter issues during deployment:
- EAS Build Docs: https://docs.expo.dev/build/introduction/
- EAS Submit Docs: https://docs.expo.dev/submit/introduction/
- Expo Forums: https://forums.expo.dev/

---

## ✅ Final Checklist

Before running deployment:

- [ ] Version numbers incremented in `app.config.js`
- [ ] All tests pass locally
- [ ] Test call feature works correctly
- [ ] Job booking from test calls works
- [ ] Google OAuth configured and tested
- [ ] Email OTP tested
- [ ] All environment variables set in EAS
- [ ] Release notes prepared
- [ ] Screenshots updated (if changed)
- [ ] Privacy policy & terms of service accessible

**Ready to deploy!** 🚀
