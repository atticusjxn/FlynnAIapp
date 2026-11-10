/**
 * Flynn AI - Contact Photo Generator
 * Resizes the official high-res iOS App Icon to a 320x320 JPEG
 * and saves its base64 string to services/flynnVcardPhoto.js.
 * Run with: node scripts/generate_vcard_photo.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INPUT_PATH = path.resolve(PROJECT_ROOT, 'brand/logo-concepts/app-icon/ios/Icon-1024.png');
const OUTPUT_PATH = path.resolve(PROJECT_ROOT, 'services/flynnVcardPhoto.js');

if (!fs.existsSync(INPUT_PATH)) {
  console.error('Error: Source AppIcon not found at:', INPUT_PATH);
  process.exit(1);
}

console.log('Loading high-res AppIcon from:', INPUT_PATH);

sharp(INPUT_PATH)
  .resize(320, 320)
  .jpeg({ quality: 85 })
  .toBuffer()
  .then(buffer => {
    const base64Str = buffer.toString('base64');
    const fileContent = `/**
 * Flynn contact-card photo (base64 JPEG, 320x320).
 *
 * Embedded directly in the vCard so iOS Contacts renders the logo — iOS does
 * NOT fetch remote PHOTO URIs, only embedded base64.
 *
 * Generated automatically from brand/logo-concepts/app-icon/ios/Icon-1024.png.
 */
module.exports = "${base64Str}";
`;
    fs.writeFileSync(OUTPUT_PATH, fileContent, 'utf8');
    console.log('SUCCESS: vCard photo generated and saved to:', OUTPUT_PATH);
    console.log(`Base64 length: ${base64Str.length} characters`);
  })
  .catch(err => {
    console.error('Sharp processing error:', err.message);
    process.exit(1);
  });
