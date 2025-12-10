# Build and Submit Commands

## One-Line Commands to Build and Auto-Submit

### Build and Submit to BOTH iOS and Android App Stores
```bash
eas build --platform all --profile production --auto-submit
```

### Build and Submit to iOS App Store Only
```bash
eas build --platform ios --profile production --auto-submit
```

### Build and Submit to Google Play Store Only
```bash
eas build --platform android --profile production --auto-submit
```

## What Happens

When you run `eas build --platform all --profile production --auto-submit`:

1. ✅ Builds iOS app (version 1.1.3, build 53)
2. ✅ Builds Android app (version 1.1.3, build 53)
3. ✅ Auto-submits iOS build to App Store Connect
4. ✅ Auto-submits Android build to Google Play Console
5. ✅ Both apps use the orange background icon (#FF6B35)

## Prerequisites

Make sure you're logged in to EAS:
```bash
eas login
```

## Configuration

All configuration is already set in:
- `eas.json` - Build and submit settings
- `app.config.js` - App version, icons, and metadata

### Current Settings:
- **Version:** 1.1.3
- **iOS Build:** 53
- **Android Build:** 53
- **Icon:** Orange background (#FF6B35) on both platforms
- **iOS App ID:** 6752254950
- **Apple Team ID:** 69T5H7R46N

## Build Status

Check build status at:
https://expo.dev/accounts/atticusjxn/projects/FlynnAI/builds

## Notes

- The `--auto-submit` flag automatically submits to stores after successful build
- You'll still need to manually release from App Store Connect and Google Play Console
- Build time: ~15-20 minutes per platform
- Both platforms build in parallel when using `--platform all`
