# Fonts

Drop these four `.ttf` files into this directory before building:

- `SpaceGrotesk-Bold.ttf`
- `SpaceGrotesk-SemiBold.ttf`
- `Inter-Regular.ttf`
- `Inter-Medium.ttf`

## How to get them

### Option A — from the RN project (after `npm install`)

```bash
cd /Users/atticus/FlynnAIapp
npm install  # installs @expo-google-fonts/inter + @expo-google-fonts/space-grotesk

# Copy the four weights the design system uses
cp node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf \
   ios-native/FlynnAI/Resources/Fonts/Inter-Regular.ttf
cp node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf \
   ios-native/FlynnAI/Resources/Fonts/Inter-Medium.ttf
cp node_modules/@expo-google-fonts/space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf \
   ios-native/FlynnAI/Resources/Fonts/SpaceGrotesk-SemiBold.ttf
cp node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf \
   ios-native/FlynnAI/Resources/Fonts/SpaceGrotesk-Bold.ttf
```

### Option B — direct from Google Fonts

- https://fonts.google.com/specimen/Space+Grotesk — download Bold (700) and SemiBold (600)
- https://fonts.google.com/specimen/Inter — download Regular (400) and Medium (500)

Rename to the exact filenames above. PostScript names must match what `Typography.swift` references (`SpaceGrotesk-Bold`, etc).

## Verify registration

After copying, run:

```bash
cd ios-native && xcodegen
```

Then build in Xcode. In DEBUG, `FlynnFontDebug.logAvailable()` (called from `FlynnAIApp.init`) will warn in the console if any PostScript name is missing.
