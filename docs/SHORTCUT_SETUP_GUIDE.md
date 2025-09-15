# Creating Your Flynn AI iCloud Shortcut

This guide will help you create and share your Flynn AI shortcut for easy 1-tap installation by users.

## Step 1: Create the Shortcut on Your iPhone

1. Open the **Shortcuts** app on your iPhone
2. Tap the **+** button to create a new shortcut
3. Add these actions in order:

### Action 1: Take Screenshot
- Search for "Take Screenshot"
- Add it to your shortcut

### Action 2: Get Contents of URL
- Search for "Get Contents of URL"
- Set URL to: `flynn-ai://process-screenshot`
- Method: GET
- Add the screenshot as input (it will automatically encode it)

### Alternative Action 2 (if encoding is needed):
- Add "Base64 Encode" action
- Then add "Text" action with: `flynn-ai://process-screenshot?imageData=`
- Then add "Get Contents of URL" with the combined text

## Step 2: Configure the Shortcut

1. Tap the settings icon (⚙️) at the top of the shortcut
2. Set these properties:
   - **Name**: "Process Screenshot with Flynn AI"
   - **Icon**: Choose a camera or screenshot icon
   - **Color**: Blue (to match your brand)
   - **Use with Siri**: Enable and set phrase to "Process screenshot with Flynn"
   - **Use in Control Center**: Enable
   - **Use with Share Sheet**: Disable (not needed)

## Step 3: Share to iCloud

1. In the shortcut settings, tap **Share**
2. Choose **Copy iCloud Link**
3. The link will look like: `https://www.icloud.com/shortcuts/abc123def456...`

## Step 4: Update Your App

Replace `YOUR_SHORTCUT_ID_HERE` in `ShortcutSharingService.ts` with your actual shortcut ID from the iCloud link.

```typescript
private static SHORTCUT_ICLOUD_URL = 'https://www.icloud.com/shortcuts/YOUR_ACTUAL_ID_HERE';
```

## How It Works for Users

When users tap "Add to Siri" in your app:
1. Opens the iCloud shortcut link
2. Shows shortcut preview in Shortcuts app
3. User taps "Add Shortcut" - **Done!**

## Benefits of This Approach

- ✅ Works immediately (no App Store required)
- ✅ One-tap installation for users
- ✅ You control the shortcut configuration
- ✅ Can update the shortcut anytime
- ✅ Used by major apps like Notion, Things, Drafts

## Testing

1. Create the shortcut on your device
2. Share it and get the iCloud link
3. Update the code with your link
4. Build and test in TestFlight
5. Users will see the Shortcuts app open with your pre-made shortcut

## Alternative: App Shortcuts (iOS 16+)

For future consideration, iOS 16+ supports App Shortcuts that appear automatically:
- No user setup required
- Defined in code using App Intents
- Automatically available after app installation
- Requires more complex implementation

## Troubleshooting

If the iCloud link doesn't work:
- Make sure the shortcut is shared publicly
- Verify the link is accessible
- Check that the flynn-ai:// URL scheme is registered in your app

## App Store Gallery (Future)

Once your app is on the App Store and gains traction:
- Apple may feature your shortcuts in the gallery
- Users discover shortcuts through search
- Requires consistent user engagement and downloads