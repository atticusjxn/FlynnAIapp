# Google OAuth Setup Guide

## Overview
This guide shows how to configure Google OAuth for FlynnAI using Supabase's OAuth flow.

## Prerequisites
- Supabase project: `zvfeafmmtfplzpnocyjw.supabase.co`
- Google Cloud Console access
- OAuth Client ID already created (shown in your screenshot)

## Setup Steps

### 1. Get Callback URL from Supabase
The callback URL is shown in your Supabase Dashboard under Authentication > Providers > Google:

```
https://zvfeafmmtfplzpnocyjw.supabase.co/auth/v1/callback
```

### 2. Add Callback URL to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services** > **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   ```
   https://zvfeafmmtfplzpnocyjw.supabase.co/auth/v1/callback
   ```
5. Click **Save**

### 3. Verify Supabase Configuration

In your Supabase Dashboard:

1. Go to **Authentication** > **Providers**
2. Click on **Google**
3. Ensure:
   - ✅ "Enable Sign in with Google" is toggled ON
   - ✅ Client ID is filled in: `27827068188...apps.googleusercontent.com`
   - ✅ Client Secret is filled in (hidden with dots)
   - ✅ Callback URL shows: `https://zvfeafmmtfplzpnocyjw.supabase.co/auth/v1/callback`

## How the OAuth Flow Works

### App Side:
1. User taps "Sign in with Google"
2. App calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. Supabase returns Google OAuth URL
4. App opens URL in browser using `WebBrowser.openAuthSessionAsync()`

### Google Side:
5. User signs in with Google account
6. Google redirects to Supabase callback URL with auth code
7. Supabase exchanges code for tokens and creates session

### Back to App:
8. Browser redirects to `flynnai://` deep link
9. App's `onAuthStateChange` listener detects new session
10. User is authenticated

## Code Implementation

The implementation in `src/context/AuthContext.tsx`:

```typescript
const signInWithGoogle = async () => {
  // Get OAuth URL from Supabase
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      skipBrowserRedirect: false,
    }
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL returned');

  // Open OAuth URL in browser
  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    'flynnai://' // Return to app after OAuth
  );

  // Session is set automatically by Supabase
}
```

## Testing

1. Run the app on device/simulator
2. Tap "Sign in with Google"
3. Browser should open with Google sign-in
4. Sign in with your Google account
5. Browser should close and return to app
6. You should be signed in

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure the Supabase callback URL is added to Google Cloud Console
- Wait a few minutes after saving changes in Google Cloud Console

### Browser doesn't open
- Check that `expo-web-browser` is installed: `npm list expo-web-browser`
- Check app logs for errors

### Sign-in completes but user not authenticated
- Check Supabase Dashboard > Authentication > Users to see if user was created
- Check app logs for `onAuthStateChange` events
- Verify `flynnai://` scheme is configured in app.config.js

### App doesn't return from browser
- The `flynnai://` scheme must be configured in app.config.js (already done)
- On iOS, ensure app is registered for the URL scheme
- On Android, ensure intent filters are configured

## Current Configuration

**Google OAuth Client:**
- Client ID: `27827068188i-ifugpt8a5v16e2frjrae8udbjsz7ib4u.apps.googleusercontent.com`
- Authorized Redirect URI: `https://zvfeafmmtfplzpnocyjw.supabase.co/auth/v1/callback`

**Supabase Project:**
- URL: `https://zvfeafmmtfplzpnocyjw.supabase.co`
- Provider: Google (enabled)

**App Configuration:**
- Deep Link Scheme: `flynnai://`
- Web Browser Plugin: `expo-web-browser` (installed)

## Security Notes

- Never commit Client Secret to version control (it's not in our code)
- Client Secret is only stored in Supabase Dashboard
- OAuth tokens are handled entirely by Supabase
- App only receives the final session via `onAuthStateChange`
