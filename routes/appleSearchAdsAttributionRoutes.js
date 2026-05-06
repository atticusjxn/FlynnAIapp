const express = require('express');
const authenticateJwt = require('../middleware/authenticateJwt');
const { claimAppleSearchAdsAttribution } = require('../telephony/appleSearchAdsAttributionService');

const router = express.Router();

router.post('/apple-search-ads/claim', authenticateJwt, async (req, res) => {
  const result = await claimAppleSearchAdsAttribution({
    userId: req.user?.id,
    token: req.body?.token,
    tokenCapturedAt: req.body?.tokenCapturedAt,
    appVersion: req.body?.appVersion,
    buildNumber: req.body?.buildNumber,
  });

  if (!result.success) {
    return res.status(result.statusCode || 500).json({ error: result.error || 'claim_failed' });
  }

  return res.status(200).json({
    ok: true,
    attribution: result.attribution,
    status: result.status,
  });
});

module.exports = router;
