# Push Notifications Setup Guide

This guide explains how to set up push notifications for Flynn AI using Firebase Cloud Messaging (Android) and Apple Push Notification service (iOS).

## Overview

Flynn AI uses:
- **FCM HTTP v1 API** for Android push notifications (modern, non-deprecated API)
- **APNs HTTP/2 with token-based authentication** for iOS push notifications

## Android Setup (Firebase Cloud Messaging)

### 1. Get Firebase Project ID

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **FlynnAI** project
3. Click **⚙️ Project Settings**
4. Copy your **Project ID** (e.g., `flynnai-12345`)
5. Add to `.env`:
   ```bash
   FIREBASE_PROJECT_ID=flynnai-12345
   ```

### 2. Generate Service Account Key

The FCM HTTP v1 API requires a service account for authentication:

1. In Firebase Console → **Project Settings**
2. Go to **Service Accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** (downloads a JSON file)
5. **Important**: Keep this file secure - it grants full access to your Firebase project

### 3. Add Service Account to Environment

The service account JSON needs to be added as a single-line environment variable:

#### Option A: Using the JSON file directly (Development)
```bash
# Read the downloaded service account JSON
cat ~/Downloads/flynnai-firebase-adminsdk-xxxxx.json

# Copy the entire output and add to .env as a single line:
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"flynnai-12345",...}'
```

#### Option B: Using a file path (Production recommended)
Alternatively, store the JSON file securely on your server and reference it:

```javascript
// In pushService.js, modify to read from file:
const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
  ? require(process.env.GOOGLE_SERVICE_ACCOUNT_PATH)
  : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
```

Then in `.env`:
```bash
GOOGLE_SERVICE_ACCOUNT_PATH=/secure/path/to/service-account.json
```

### 4. Enable Firebase Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Library**
4. Search for "Firebase Cloud Messaging API"
5. Click **Enable**

---

## iOS Setup (Apple Push Notifications)

### 1. Create APNs Authentication Key

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Keys** → **+** (Create a new key)
4. **Key Name**: "Flynn AI Push Notifications"
5. Check **Apple Push Notifications service (APNs)**
6. Click **Continue** → **Register**
7. **Download the `.p8` file immediately** (you can't download it again!)
8. Note the **Key ID** (10-character string, e.g., `ABC1234DEF`)

### 2. Get Your Team ID

1. In Apple Developer Portal, click your name in top-right
2. Copy your **Team ID** (10-character string)

### 3. Add to Environment Variables

```bash
APNS_KEY_ID=ABC1234DEF
APNS_TEAM_ID=XYZ9876ABC
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...your key here...
...xyz123
-----END PRIVATE KEY-----"
APNS_BUNDLE_ID=com.flynnai.app
APNS_HOST=https://api.sandbox.push.apple.com  # Development
# APNS_HOST=https://api.push.apple.com  # Production (when releasing to App Store)
```

**Important**: When adding `APNS_PRIVATE_KEY` to `.env`, keep the newlines within the quotes:
```bash
# Correct format:
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
line2
line3
-----END PRIVATE KEY-----"

# DO NOT do this (escaped newlines):
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nline2\nline3\n-----END PRIVATE KEY-----"
```

### 4. Enable Push Notifications for App ID

1. In Apple Developer Portal → **Identifiers**
2. Find **com.flynnai.app** (or create it)
3. Check **Push Notifications** capability
4. Click **Save**

---

## Environment Variables Summary

Add these to your `.env` file:

```bash
# Android (FCM v1 API)
FIREBASE_PROJECT_ID=your-firebase-project-id
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...entire JSON...}'

# iOS (APNs)
APNS_KEY_ID=your_10_char_key_id
APNS_TEAM_ID=your_10_char_team_id
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...your key...
-----END PRIVATE KEY-----"
APNS_BUNDLE_ID=com.flynnai.app
APNS_HOST=https://api.sandbox.push.apple.com  # or api.push.apple.com for production
```

---

## Testing Push Notifications

### Test on Physical Devices

**Important**: Simulators do NOT support push notifications. You must test on physical devices.

### Android Testing

```bash
# Build with Firebase integration
npx expo run:android --device

# Watch logs for Firebase initialization
adb logcat | grep -i firebase
```

Expected logs:
```
[Push] Firebase Cloud Messaging initialized
[Push] Device token registered: 123abc...
```

### iOS Testing

```bash
# Build for device
npx expo run:ios --device

# Watch logs
# In Xcode: Window → Devices and Simulators → Select device → View Device Logs
```

Expected logs:
```
[Push] APNs token registered
[Push] Push token sent to backend
```

### Trigger Test Notification

1. Create a voicemail job in the app
2. Backend will automatically send push notification via `sendJobCreatedNotification()`
3. Check device for notification

---

## Troubleshooting

### Android Issues

| Issue | Solution |
|-------|----------|
| "GOOGLE_SERVICE_ACCOUNT_KEY not configured" | Ensure JSON is properly quoted as single-line string in `.env` |
| "Failed to get FCM access token" | Check service account JSON is valid and complete |
| "403 Forbidden" | Enable Firebase Cloud Messaging API in Google Cloud Console |
| "404 Project not found" | Verify FIREBASE_PROJECT_ID matches Firebase console |

### iOS Issues

| Issue | Solution |
|-------|----------|
| "APNs credentials missing" | Check all 3 variables: KEY_ID, TEAM_ID, PRIVATE_KEY |
| "Invalid authentication token" | Verify private key format (must include BEGIN/END lines) |
| "BadDeviceToken" | Using wrong APNS_HOST (sandbox vs production) |
| "Permission denied" | Enable Push Notifications capability for App ID |

### General Issues

| Issue | Solution |
|-------|----------|
| No push token generated | Must test on physical device, not simulator |
| "Permission not granted" | User must enable notifications in device settings |
| Notifications not arriving | Check backend logs for send success/failure |

---

## Security Best Practices

1. **Never commit credentials to git** - `.env` is in `.gitignore`
2. **Rotate keys periodically** - Regenerate service accounts and APNs keys annually
3. **Use different keys for dev/prod** - Separate Firebase projects for testing
4. **Restrict service account permissions** - Only grant Firebase Messaging permissions
5. **Store production keys securely** - Use AWS Secrets Manager, Google Secret Manager, etc.

---

## Production Deployment

### Environment Variables on Server

For production servers, set environment variables via your hosting platform:

**Heroku:**
```bash
heroku config:set FIREBASE_PROJECT_ID=your-project-id
heroku config:set GOOGLE_SERVICE_ACCOUNT_KEY='...'
```

**AWS / Google Cloud:**
Use their secret management services instead of environment variables.

**Vercel / Netlify:**
Add environment variables in dashboard under project settings.

### Switch to Production APNs

Before App Store release:
```bash
APNS_HOST=https://api.push.apple.com  # Production endpoint
```

---

## Migration from Legacy FCM

If you previously used the deprecated Legacy FCM API:

1. **Remove old env var**: Delete `FCM_SERVER_KEY` from `.env`
2. **Add new env vars**: `FIREBASE_PROJECT_ID` and `GOOGLE_SERVICE_ACCOUNT_KEY`
3. **Test thoroughly**: FCM v1 API has different token formats
4. **Update client tokens**: Existing device tokens remain valid

---

## Additional Resources

- [FCM HTTP v1 API Documentation](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [APNs Provider API Documentation](https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server)
- [Firebase Service Account Setup](https://firebase.google.com/docs/admin/setup#initialize-sdk)

---

**Last Updated**: January 2025
