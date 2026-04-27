#!/usr/bin/env node
// Patch react-native-iap RNIapModule.kt: currentActivity → getCurrentActivity()
// Required for React Native 0.81 Kotlin compatibility.
try {
  const fs = require('fs');
  const path = require('path');

  const file = path.join(
    __dirname,
    '../node_modules/react-native-iap/android/src/play/java/com/dooboolab/rniap/RNIapModule.kt'
  );

  if (!fs.existsSync(file)) {
    console.log('[postinstall] react-native-iap Kotlin file not found, skipping patch.');
    process.exit(0);
  }

  const original = fs.readFileSync(file, 'utf8');
  const patched = original.replace(
    /\bval activity = currentActivity\b/g,
    'val activity = getCurrentActivity()'
  );

  if (original === patched) {
    console.log('[postinstall] react-native-iap patch already applied or not needed.');
  } else {
    fs.writeFileSync(file, patched, 'utf8');
    console.log('[postinstall] Patched react-native-iap RNIapModule.kt ✓');
  }
} catch (e) {
  console.warn('[postinstall] Warning: react-native-iap patch failed (non-fatal):', e.message);
}
