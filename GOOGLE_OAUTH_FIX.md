# Google Sign-In OAuth Fix

## Problem
The "Sign in with Google" button did nothing when clicked. Users would tap the button and nothing would happen - no browser would open, no error would show.

## Root Cause
The `signInWithGoogle()` function in `AuthContext.tsx` was calling `supabase.auth.signInWithOAuth()` but wasn't handling the OAuth URL that gets returned. OAuth requires:

1. Getting the OAuth URL from Supabase
2. Opening a browser with that URL
3. Handling the redirect back to the app

The original implementation just called the API but never opened the browser.

## Solution

### 1. Installed Required Packages
```bash
npm install expo-web-browser expo-auth-session
```

These packages provide:
- `expo-web-browser`: Opens OAuth URLs in a secure browser session
- `expo-auth-session`: Generates proper redirect URIs for OAuth flows

### 2. Updated AuthContext.tsx

**Before:**
```typescript
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'flynnai://auth/callback',
    }
  });
  if (error) throw error;
};
```

**After:**
```typescript
const signInWithGoogle = async () => {
  try {
    // Generate the redirect URI for the OAuth flow
    const redirectTo = makeRedirectUri({
      scheme: 'flynnai',
      path: 'auth/callback'
    });

    // Start the OAuth flow
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      }
    });

    if (error) throw error;
    if (!data?.url) throw new Error('No OAuth URL returned');

    // Open the OAuth URL in the browser
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    if (result.type === 'success') {
      // Session is set automatically by onAuthStateChange
      console.log('Google OAuth successful');
    } else if (result.type === 'cancel') {
      throw new Error('Google sign-in was cancelled');
    } else {
      throw new Error('Google sign-in failed');
    }
  } catch (error) {
    console.error('[AuthContext] signInWithGoogle error:', error);
    throw error;
  }
};
```

### 3. Added Plugin to app.config.js
```javascript
plugins: [
  "expo-asset",
  "expo-secure-store",
  "expo-notifications",
  "expo-font",
  "expo-web-browser",  // <-- Added this
  // ... other plugins
]
```

## How It Works Now

1. User taps "Sign in with Google" button
2. App calls `signInWithGoogle()`
3. Function generates proper redirect URI: `flynnai://auth/callback`
4. Supabase returns Google OAuth URL
5. `WebBrowser.openAuthSessionAsync()` opens the OAuth URL in browser
6. User signs in with Google
7. Browser redirects to `flynnai://auth/callback` with auth tokens
8. Supabase's `onAuthStateChange` listener detects the session
9. User is signed in automatically

## Testing

To test the fix:
1. Open the app
2. Tap "Sign in with Google" or "Continue with Google"
3. Browser should open with Google sign-in page
4. Sign in with your Google account
5. Browser should close and app should be authenticated

## Error Handling

The implementation now handles:
- ✅ Missing OAuth URL from Supabase
- ✅ User cancelling the OAuth flow
- ✅ Failed OAuth attempts
- ✅ Network errors
- ✅ All errors are logged with `[AuthContext]` prefix for debugging

## Notes

- The app must have Google OAuth configured in Supabase dashboard
- The redirect URI `flynnai://auth/callback` must be added to Supabase OAuth allowed redirect URLs
- Deep linking scheme `flynnai://` is already configured in app.config.js
