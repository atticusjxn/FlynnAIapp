/**
 * Trial Expiry Email Templates
 *
 * HTML email templates for trial expiry notifications
 */

const getTrialExpiryEmailHTML = (daysRemaining) => {
  const subject = daysRemaining === 5
    ? 'Your Flynn AI trial ends in 5 days'
    : daysRemaining === 1
    ? 'Your Flynn AI trial ends tomorrow!'
    : 'Your Flynn AI trial has ended';

  const heading = daysRemaining === 5
    ? 'Your trial ends in 5 days'
    : daysRemaining === 1
    ? 'Your trial ends tomorrow!'
    : 'Your trial has ended';

  const message = daysRemaining === 5
    ? 'Your card will be charged in 5 days. Cancel anytime before then with no charge - or let it continue and keep capturing leads automatically!'
    : daysRemaining === 1
    ? 'Your card will be charged tomorrow! Cancel now if you don\'t want to continue, or sit back and let Flynn keep converting calls into jobs.'
    : 'Your trial has ended and billing has begun. Manage your subscription anytime in the app settings.';

  const buttonText = daysRemaining > 0 ? 'Manage Subscription' : 'View Billing';
  const buttonLink = 'flynnai://settings/billing';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      background-color: #f8fafc;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #ff4500;
      padding: 40px 24px;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }
    .content {
      padding: 40px 24px;
    }
    .heading {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 16px 0;
      text-align: center;
    }
    .message {
      font-size: 16px;
      line-height: 24px;
      color: #475569;
      margin: 0 0 32px 0;
      text-align: center;
    }
    .cta {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background-color: #ff4500;
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
    }
    .features {
      background-color: #f8fafc;
      padding: 24px;
      border-radius: 12px;
      margin: 32px 0;
    }
    .feature {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .feature:last-child {
      margin-bottom: 0;
    }
    .checkmark {
      color: #10b981;
      font-size: 20px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    .feature-text {
      font-size: 14px;
      line-height: 20px;
      color: #475569;
    }
    .footer {
      padding: 24px;
      text-align: center;
      color: #94a3b8;
      font-size: 14px;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #ff4500;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 class="logo">Flynn AI</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <h2 class="heading">${heading}</h2>
      <p class="message">${message}</p>

      <!-- CTA Button -->
      <div class="cta">
        <a href="${buttonLink}" class="button">${buttonText}</a>
      </div>

      <!-- Features -->
      <div class="features">
        <div class="feature">
          <span class="checkmark">✓</span>
          <span class="feature-text">Never miss a lead - AI answers every call</span>
        </div>
        <div class="feature">
          <span class="checkmark">✓</span>
          <span class="feature-text">Auto-generate job cards from voicemails</span>
        </div>
        <div class="feature">
          <span class="checkmark">✓</span>
          <span class="feature-text">Send instant follow-up messages</span>
        </div>
        <div class="feature">
          <span class="checkmark">✓</span>
          <span class="feature-text">Custom voice and greeting configuration</span>
        </div>
      </div>

      <p class="message" style="margin-top: 32px; font-size: 14px;">
        Questions? Reply to this email or visit our <a href="https://flynn.ai/support" style="color: #ff4500;">support page</a>.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>© ${new Date().getFullYear()} Flynn AI. All rights reserved.</p>
      <p>
        <a href="https://flynn.ai/privacy">Privacy Policy</a> ·
        <a href="https://flynn.ai/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

module.exports = {
  getTrialExpiryEmailHTML,
};
