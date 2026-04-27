/**
 * Puppeteer is used server-side only. Skip Chromium download in all
 * environments (EAS builds, CI, local) — the server provides its own browser
 * or uses puppeteer-core with a system Chromium.
 */
module.exports = {
  skipDownload: true,
};
