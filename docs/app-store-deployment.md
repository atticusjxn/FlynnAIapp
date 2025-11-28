# Flynn AI - App Store & Google Play Deployment Guide

This comprehensive guide walks you through publishing Flynn AI to both the Apple App Store and Google Play Store.

## 📋 Pre-Deployment Checklist

Before starting the deployment process, ensure you have:

- [ ] **Apple Developer Account** ($99/year) - [developer.apple.com](https://developer.apple.com)
- [ ] **Google Play Developer Account** ($25 one-time) - [play.google.com/console](https://play.google.com/console)
- [ ] All app features tested on physical devices (iOS and Android)
- [ ] Push notifications working (APNs and FCM configured)
- [ ] All environment variables set correctly
- [ ] App icons and screenshots ready (see Asset Requirements below)
- [ ] Privacy Policy and Terms of Service URLs ready
- [ ] App Store descriptions and keywords prepared

---

## 🍎 Part 1: Apple App Store Deployment

### Step 1: Prepare Your App Identifier

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (if not already created)
4. Select **App IDs** → **Continue**
5. **Description**: Flynn AI
6. **Bundle ID**: `com.flynnai.app` (must match `app.config.js`)
7. **Capabilities**: Enable:
   - ✅ Push Notifications
   - ✅ Background Modes (for VoIP if needed)
   - ✅ Associated Domains (if using universal links)
8. Click **Continue** → **Register**

### Step 2: Create App Store Connect App

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platforms**: iOS
   - **Name**: Flynn AI
   - **Primary Language**: English (US)
   - **Bundle ID**: Select `com.flynnai.app`
   - **SKU**: `flynnai-001` (unique identifier for your records)
   - **User Access**: Full Access
4. Click **Create**

### Step 3: Configure App Information

#### A. App Information Section
1. In App Store Connect, go to your app
2. Navigate to **App Information**
3. Fill in:
   - **Category**: Business or Productivity
   - **Secondary Category**: (optional)
   - **Content Rights**: Check if you own all rights
   - **Age Rating**: Complete the questionnaire (likely 4+)

#### B. Privacy Policy
1. **Privacy Policy URL**: Your hosted privacy policy
   - Required by Apple
   - Must explain: data collection, voicemail recording, push notifications, call forwarding
   - Example: `https://flynnai.app/privacy`

#### C. Contact Information
- **Name**: Your name or company name
- **Phone**: Support phone number
- **Email**: Support email
- **Support URL**: `https://flynnai.app/support`
- **Account Deletion URL**: `https://flynnai.app/delete-account`

### Step 4: Prepare App Store Listing

#### A. Version Information
1. Go to **App Store** tab → **iOS App**
2. Click on version (e.g., 1.0)
3. Fill in:

**App Name**: Flynn AI

**Subtitle** (30 chars max):
```
Turn Missed Calls Into Jobs
```

**Description** (4000 chars max):
```
Never miss a lead again! Flynn AI is your intelligent voicemail receptionist that automatically captures missed calls, transcribes voicemails, and helps you convert leads into booked jobs.

PERFECT FOR SERVICE PROFESSIONALS
• Tradespeople (plumbers, electricians, contractors)
• Beauty & wellness professionals (hairdressers, massage therapists)
• Small business owners who can't answer every call
• Office managers handling call overflow

KEY FEATURES
✓ Voicemail Transcription - AI-powered transcription of every voicemail
✓ Smart Job Extraction - Automatically creates job cards with client details
✓ Instant Follow-Up - AI-drafted responses ready for your approval
✓ Calendar Integration - Sync with Google Calendar, Outlook, Apple Calendar
✓ Screenshot Processing - Extract job details from text conversations
✓ Client Management - Keep all client information organized
✓ Push Notifications - Never miss important leads

HOW IT WORKS
1. Forward missed calls to your Flynn number
2. Flynn transcribes and processes voicemails with AI
3. Review extracted job details and drafted responses
4. Approve and send - Flynn handles the rest!

HUMAN-IN-THE-LOOP DESIGN
Flynn drafts responses but never sends without your approval. You stay in control while saving hours of manual data entry.

CALL FORWARDING SETUP
Flynn works with your existing phone number. Simply set up conditional call forwarding (when busy/unanswered) to route voicemails through Flynn.

PRIVACY & SECURITY
• End-to-end encryption for all voicemail recordings
• GDPR compliant with configurable data retention
• No data sold to third parties
• Full audit logs of all access

TRY FLYNN RISK-FREE
Start with our free tier and upgrade as you grow. Cancel anytime.

---
Support: support@flynnai.com
Privacy Policy: https://flynnai.app/privacy
Terms: https://flynnai.app/terms
```

**Keywords** (100 chars max):
```
voicemail,transcription,business,receptionist,calls,jobs,clients,calendar,ai,assistant
```

**Promotional Text** (170 chars, can be updated anytime):
```
New: AI-powered voicemail transcription turns missed calls into booked jobs. Perfect for service professionals who can't answer every call!
```

#### B. What's New in This Version
```
Version 1.0 - Initial Release

Welcome to Flynn AI! Your intelligent voicemail receptionist that never misses a lead.

• Voicemail transcription and AI processing
• Automatic job card creation
• Smart follow-up drafting
• Calendar integration
• Screenshot job extraction
• iOS Shortcuts support
• Push notifications

Thank you for trying Flynn AI!
```

### Step 5: Prepare Screenshots and Assets

#### Required Sizes for iPhone:
- **6.5" Display** (iPhone 14 Pro Max, etc.): 1290 x 2796 pixels
- **5.5" Display** (iPhone 8 Plus): 1242 x 2208 pixels

#### iPad (if supporting):
- **12.9" Display**: 2048 x 2732 pixels

#### App Preview Videos (Optional but Recommended):
- 15-30 seconds showing key features
- Portrait orientation
- Max file size: 500 MB

#### Screenshots You'll Need (3-10 per device size):
1. **Dashboard** - Shows voicemail activity and job overview
2. **Voicemail Transcript** - AI transcription with extracted details
3. **Job Card** - Pre-filled job information
4. **Approval Flow** - Review and approve drafted response
5. **Calendar Integration** - Synced events
6. **Settings** - Call forwarding setup

**Tips:**
- Use real-looking data (not "Lorem Ipsum")
- Add text overlays explaining features
- Keep consistent branding (use Flynn AI blue: #2563EB)
- Tools: Use Figma, Sketch, or Screenshot Framer

### Step 6: Build & Upload with EAS

Flynn AI uses Expo, so we'll use EAS (Expo Application Services) to build.

#### A. Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

#### B. Configure EAS Build
```bash
# Initialize EAS in your project
eas build:configure
```

This creates `eas.json`. Update it:

```json
{
  "cli": {
    "version": ">= 5.9.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium",
        "bundleIdentifier": "com.flynnai.app",
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

#### C. Update app.config.js for Production

Ensure your `app.config.js` has:
```javascript
export default {
  expo: {
    name: "Flynn AI",
    slug: "FlynnAI",
    version: "1.0.0",
    ios: {
      bundleIdentifier: "com.flynnai.app",
      buildNumber: "1",
      supportsTablet: true,
      infoPlist: {
        NSUserNotificationUsageDescription: "Flynn AI sends push notifications when new jobs are created so you never miss important follow-ups.",
        NSMicrophoneUsageDescription: "Flynn AI uses the microphone to record and transcribe phone calls with clients to automatically capture job details and create bookings.",
        // ... other permissions
      }
    },
    android: {
      package: "com.flynnai.app",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#3B82F6"
      },
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "USE_FINGERPRINT",
        "RECORD_AUDIO"
      ]
    }
  }
}
```

#### D. Build for iOS Production
```bash
# Create production build for iOS
eas build --platform ios --profile production

# This will:
# 1. Prompt you to log in with your Apple Developer account
# 2. Create provisioning profiles automatically
# 3. Build your app on Expo's servers
# 4. Generate an .ipa file

# Wait 10-20 minutes for build to complete
```

#### E. Submit to App Store
```bash
# Option 1: Auto-submit via EAS
eas submit --platform ios --latest

# Option 2: Manual upload
# Download the .ipa file from EAS dashboard
# Upload via Xcode → Organizer → Distribute App
```

### Step 7: App Store Review Preparation

#### A. App Review Information
In App Store Connect:
1. Go to **App Review Information**
2. Fill in:
   - **Sign-In Required**: No (or provide demo account)
   - **Contact Information**: Your email and phone
   - **Notes**:
   ```
   Flynn AI requires phone call forwarding setup to function fully.

   To test voicemail features:
   1. Open app and create an account
   2. Navigate to Settings → Call Setup
   3. Follow carrier-specific forwarding instructions
   4. Test by calling your number and leaving a voicemail

   Key features to test:
   - Voicemail transcription
   - Job card creation
   - Screenshot processing (Settings → iOS Shortcuts)
   - Calendar sync
   - Push notifications

   Demo credentials (if needed):
   Email: demo@flynnai.com
   Password: FlynDemo2025!
   ```

#### B. Export Compliance
1. **Uses Encryption**: Yes (for HTTPS network calls)
2. **Exempt**: Yes (uses standard HTTPS only)
3. No need for documentation

### Step 8: Submit for Review
1. In App Store Connect, go to your app
2. Click **Submit for Review**
3. Review timeline: 1-3 days typically
4. Monitor review status in App Store Connect

### Step 9: Common App Review Rejections & Fixes

| Rejection Reason | Solution |
|-----------------|----------|
| **Guideline 2.1** - App crashes | Test thoroughly on physical devices, fix all crashes |
| **Guideline 4.0** - Incomplete features | Ensure all advertised features work |
| **Guideline 5.1.1** - Privacy policy missing | Add privacy policy URL in App Information |
| **Guideline 4.2** - Minimum functionality | Ensure app provides value even without call forwarding |

---

## 🤖 Part 2: Google Play Store Deployment

### Step 1: Create Google Play Console Account

1. Go to [Google Play Console](https://play.google.com/console)
2. Sign in with Google account
3. Pay $25 one-time registration fee
4. Complete account setup (personal or company)
5. Verify identity (may require ID verification)

### Step 2: Create Your App

1. Click **Create app**
2. Fill in:
   - **App name**: Flynn AI
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free (or Paid if charging)
3. Declarations:
   - ✅ Developer Program Policies
   - ✅ US export laws
4. Click **Create app**

### Step 3: Set Up Store Listing

#### A. Main Store Listing
Navigate to **Main store listing** in left sidebar:

**App name**: Flynn AI

**Short description** (80 chars max):
```
AI voicemail receptionist that turns missed calls into booked jobs
```

**Full description** (4000 chars max):
```
Never miss a lead again! Flynn AI is your intelligent voicemail receptionist that automatically captures missed calls, transcribes voicemails, and helps you convert leads into booked jobs.

🎯 PERFECT FOR SERVICE PROFESSIONALS
• Tradespeople (plumbers, electricians, contractors)
• Beauty & wellness professionals (hairdressers, massage therapists)
• Small business owners who can't answer every call
• Office managers handling call overflow

✨ KEY FEATURES

📞 Voicemail Transcription
AI-powered transcription of every voicemail with intelligent extraction of client details, job requirements, and urgency levels.

📋 Smart Job Extraction
Automatically creates job cards with:
• Client name and contact info
• Service type and description
• Preferred date and time
• Location details
• Special requirements

💬 Instant Follow-Up
AI drafts professional SMS/email responses for your approval. Review, edit, and send in seconds.

📅 Calendar Integration
Sync seamlessly with Google Calendar, Outlook, and Apple Calendar. Never double-book again.

📸 Screenshot Processing
Extract job details from text conversations and email screenshots with AI-powered recognition.

👥 Client Management
Keep all client information organized in one place with full contact history.

🔔 Push Notifications
Get instant alerts for new voicemails and jobs so you never miss important leads.

📱 HOW IT WORKS

1. Forward Your Calls
   Set up conditional call forwarding (when busy/unanswered) to route voicemails through Flynn.

2. Flynn Processes
   AI transcribes voicemails, extracts job details, and drafts follow-up responses.

3. You Review
   See transcript, extracted details, and drafted response in one screen.

4. Approve & Send
   Tap to approve - Flynn handles the rest!

🛡️ HUMAN-IN-THE-LOOP DESIGN
Flynn drafts responses but never sends without your approval. You stay in control while saving hours of manual data entry.

🔧 EASY SETUP
Works with your existing phone number. Simply configure call forwarding through your carrier (instructions provided in-app for all major carriers).

🔒 PRIVACY & SECURITY
• End-to-end encryption for all recordings
• GDPR compliant with configurable retention
• No data sold to third parties
• Full audit logs
• Secure cloud storage

💰 PRICING
Start free with limited voicemails. Upgrade as you grow:
• Starter: 50 voicemails/month
• Professional: 200 voicemails/month
• Business: Unlimited voicemails

Cancel anytime, no contracts.

📞 SUPPORT
We're here to help! Contact us:
• Email: support@flynnai.com
• Help Center: https://flynnai.app/help
• Privacy: https://flynnai.app/privacy
• Terms: https://flynnai.app/terms

Download Flynn AI today and never miss another lead!
```

#### B. App Category & Tags
- **App category**: Business
- **Tags**:
  - Voicemail
  - Transcription
  - Business Communication
  - AI Assistant
  - Customer Management

#### C. Contact Details
- **Email**: support@flynnai.com
- **Phone**: (optional but recommended)
- **Website**: https://flynnai.app
- **Privacy Policy**: https://flynnai.app/privacy (REQUIRED)

### Step 4: Prepare Graphics Assets

#### App Icon
- **512 x 512 pixels**, 32-bit PNG
- No transparency
- Cannot be generic (e.g., just text)

#### Feature Graphic (Banner)
- **1024 x 500 pixels**, JPG or 24-bit PNG
- Displayed at top of store listing
- No text or buttons (Google may reject)

#### Phone Screenshots (Required)
- **Minimum 2, maximum 8**
- JPEG or 24-bit PNG (no alpha)
- Min dimension: 320px
- Max dimension: 3840px
- **Recommended**: 1080 x 2340 pixels (9:19.5 aspect ratio)

Screenshots needed:
1. Dashboard with voicemails
2. Voicemail transcript screen
3. Job card with extracted details
4. Approval/review screen
5. Calendar integration
6. Client management
7. Settings/call forwarding setup

#### 7-inch Tablet Screenshots (Optional)
- 1200 x 1920 pixels

#### 10-inch Tablet Screenshots (Optional)
- 1920 x 2560 pixels

### Step 5: Content Rating

1. Navigate to **Content rating**
2. Fill out questionnaire:
   - **Violence**: None
   - **Sexuality**: None
   - **Language**: None (business app)
   - **Controlled substances**: None
   - **User-generated content**: No (voicemails are private)
   - **Sharing user data**: Yes (with user consent)
   - **Location**: May request location for jobs
3. Submit for rating (usually results in "Everyone" or "Teen")

### Step 6: Build Android App Bundle

#### A. Generate Upload Key (First Time Only)
```bash
# Create upload keystore
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore flynn-upload-key.keystore \
  -alias flynn-upload-key -keyalg RSA -keysize 2048 -validity 10000

# You'll be prompted for:
# - Keystore password (save this securely!)
# - Key password (can be same as keystore)
# - Your name, organization, city, etc.

# IMPORTANT: Back up this file and passwords securely!
# You cannot publish updates without it!
```

#### B. Configure Gradle for Signing
Edit `android/gradle.properties`:
```properties
FLYNN_UPLOAD_STORE_FILE=flynn-upload-key.keystore
FLYNN_UPLOAD_KEY_ALIAS=flynn-upload-key
FLYNN_UPLOAD_STORE_PASSWORD=your-keystore-password
FLYNN_UPLOAD_KEY_PASSWORD=your-key-password
```

Edit `android/app/build.gradle`, add above `buildTypes`:
```groovy
signingConfigs {
    release {
        if (project.hasProperty('FLYNN_UPLOAD_STORE_FILE')) {
            storeFile file(FLYNN_UPLOAD_STORE_FILE)
            storePassword FLYNN_UPLOAD_STORE_PASSWORD
            keyAlias FLYNN_UPLOAD_KEY_ALIAS
            keyPassword FLYNN_UPLOAD_KEY_PASSWORD
        }
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        // ... rest of release config
    }
}
```

#### C. Build with EAS
```bash
# Build Android App Bundle (.aab)
eas build --platform android --profile production

# Wait for build to complete (10-20 minutes)
# Download the .aab file from EAS dashboard
```

### Step 7: Upload to Play Console

#### A. Create a Release
1. In Play Console, go to **Production** → **Create new release**
2. Click **Upload** and select your `.aab` file
3. **Release name**: `1.0.0 (1)` (version + build number)
4. **Release notes** (for all languages):
```
Welcome to Flynn AI v1.0! 🎉

Your intelligent voicemail receptionist that never misses a lead.

What's New:
• AI-powered voicemail transcription
• Automatic job card creation from calls
• Smart follow-up response drafting
• Google Calendar integration
• Screenshot job extraction
• Client management
• Push notifications for new jobs

Get started by setting up call forwarding in the app!

Questions? Contact support@flynnai.com
```

#### B. Review Release
Review the warnings/errors:
- **Green check**: All good
- **Yellow warning**: Review but can proceed
- **Red error**: Must fix before publishing

Common warnings:
- **Missing device compatibility**: Usually safe to ignore
- **Missing translation**: Add translations or ignore

### Step 8: Complete App Content

#### A. Target Audience & Content
1. **Target age group**: 18+ (business app)
2. **Store presence**: Not primarily for children
3. Click **Save**

#### B. News Apps
- Select **No** (not a news app)

#### C. COVID-19 Contact Tracing
- Select **No**

#### D. Data Safety
This is CRITICAL - explain what data you collect:

**Data Types Collected**:
- ✅ **Personal info**: Name, Email, Phone number
- ✅ **Audio**: Voicemail recordings
- ✅ **App activity**: In-app interactions
- ✅ **Device ID**: For push notifications

**Data Usage**:
- **Purpose**: App functionality, Analytics
- **Shared**: No (not shared with third parties)
- **Optional**: No (required for core functionality)
- **User can request deletion**: Yes

**Security Practices**:
- ✅ Data encrypted in transit
- ✅ Data encrypted at rest
- ✅ User can request data deletion
- Link to privacy policy: https://flynnai.app/privacy
- Account deletion page: https://flynnai.app/delete-account (share this URL in the Play privacy questionnaire)

### Step 9: Set Up Pricing & Distribution

#### A. Countries
- Select **All countries** or specific countries
- Ensure you comply with local laws (especially GDPR for EU)

#### B. Pricing
- **Free** or set price
- Cannot change from free to paid later (but can add in-app purchases)

#### C. Content Declarations
- **Contains ads**: No (unless you add ads)
- **In-app purchases**: No (unless implementing subscriptions)

### Step 10: Submit for Review

1. Review all sections - should all show green checks
2. Click **Review release**
3. Click **Start rollout to Production**
4. Confirm rollout

**Review Timeline**:
- Usually 1-7 days
- Can take longer for first submission
- Monitor status in Play Console

### Step 11: Common Google Play Rejections & Fixes

| Rejection Reason | Solution |
|-----------------|----------|
| **Privacy Policy** | Must be accessible, comprehensive, and match data safety form |
| **Permissions** | Only request necessary permissions, explain why in description |
| **Crashes** | Test on multiple Android versions/devices |
| **Misleading content** | Screenshots/description must accurately represent app |
| **Data safety violations** | Ensure data safety form is accurate and complete |
| **Broken features** | All advertised features must work |

---

## 📱 Part 3: Post-Launch Checklist

### Immediately After Approval

- [ ] Test downloading app from App Store/Play Store
- [ ] Verify in-app purchases work (if applicable)
- [ ] Test push notifications on production
- [ ] Monitor crash reports (Xcode/Play Console)
- [ ] Check reviews daily and respond

### First Week

- [ ] Monitor analytics (downloads, retention, crashes)
- [ ] Respond to all user reviews
- [ ] Fix any critical bugs with hotfix update
- [ ] Share on social media
- [ ] Send to beta testers for feedback

### First Month

- [ ] Analyze user feedback and reviews
- [ ] Plan version 1.1 with improvements
- [ ] Optimize app store listing based on keywords
- [ ] Create support documentation
- [ ] Set up analytics tracking (Firebase, Mixpanel, etc.)

---

## 🔄 Updating Your App

### Version Numbering
Follow semantic versioning: `MAJOR.MINOR.PATCH`
- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features
- **PATCH** (x.x.1): Bug fixes

Example:
```
1.0.0 → Initial release
1.0.1 → Bug fixes
1.1.0 → New features (e.g., email integration)
2.0.0 → Major redesign
```

### iOS Updates
```bash
# Update version in app.config.js
version: "1.1.0"
buildNumber: "2"  # Increment for each submission

# Build and submit
eas build --platform ios --profile production
eas submit --platform ios --latest
```

### Android Updates
```bash
# Update version in app.config.js
version: "1.1.0"
versionCode: 2  # Must increment

# Build and submit
eas build --platform android --profile production
# Upload to Play Console manually
```

---

## 🆘 Troubleshooting

### EAS Build Fails
```bash
# Clear cache and retry
eas build:configure
eas build --platform ios --clear-cache
```

### iOS Provisioning Issues
```bash
# Regenerate credentials
eas credentials -p ios
# Select: Delete credentials
# Rebuild - EAS will create new ones
```

### Android Signing Issues
- Verify keystore password is correct in `gradle.properties`
- Ensure keystore file path is relative to `android/app/`
- Never commit keystore files to git!

### App Store Connect Upload Fails
- Check bundle identifier matches Apple Developer Portal
- Verify you have proper permissions in App Store Connect
- Try uploading via Xcode Organizer instead of EAS

---

## 📊 Analytics & Monitoring

### Crash Reporting
- **iOS**: Xcode Organizer → Crashes
- **Android**: Play Console → Quality → Crashes & ANRs
- **Third-party**: Sentry, Bugsnag, Firebase Crashlytics

### User Analytics
- **Firebase Analytics** (free, recommended)
- **Mixpanel** (user behavior tracking)
- **Amplitude** (product analytics)

### App Store Optimization (ASO)
- Monitor keyword rankings
- A/B test screenshots and descriptions
- Analyze conversion rates (impressions → downloads)
- Tools: Sensor Tower, App Annie, Mobile Action

---

## 💰 Monetization (Future)

If you plan to monetize:

### In-App Purchases
```bash
# Configure in App Store Connect / Play Console
# Implement with expo-in-app-purchases or RevenueCat

# Products:
- Starter Plan: $9.99/month
- Pro Plan: $29.99/month
- Business Plan: $99.99/month
```

### Subscriptions
- Apple takes 30% first year, 15% thereafter
- Google takes 30% first year, 15% thereafter
- Consider offering annual plans (better retention)

---

## 📧 Support Resources

### Apple
- **Developer Support**: developer.apple.com/support
- **App Review Status**: appstoreconnect.apple.com
- **Guidelines**: developer.apple.com/app-store/review/guidelines

### Google
- **Play Console Support**: support.google.com/googleplay/android-developer
- **Policy Center**: play.google.com/about/developer-content-policy
- **Developer Community**: developer.android.com/community

### Expo/EAS
- **Documentation**: docs.expo.dev
- **Forums**: forums.expo.dev
- **Discord**: discord.gg/expo

---

## ✅ Final Checklist Before Launch

- [ ] All environment variables set in production
- [ ] Push notifications working on physical devices
- [ ] Call forwarding tested with real carriers
- [ ] Privacy policy and terms of service published
- [ ] Support email set up and monitored
- [ ] App icons and screenshots finalized
- [ ] Both store listings reviewed for typos
- [ ] Analytics/crash reporting configured
- [ ] Backup of signing certificates/keystores
- [ ] Marketing plan ready
- [ ] PR/social media posts drafted

---

**Good luck with your launch! 🚀**

Questions? Need help? Check the troubleshooting section or contact Expo support.

**Last Updated**: January 2025
