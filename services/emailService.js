// Email Service using Resend
// Sends booking confirmations and reminders

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Flynn AI <noreply@flynnai.app>';

/**
 * Send booking confirmation email to customer
 */
async function sendCustomerConfirmation(booking, businessName) {
  if (!RESEND_API_KEY) {
    console.warn('[Email] Resend API key not configured, skipping email');
    return null;
  }

  if (!booking.customer_email) {
    console.log('[Email] No customer email provided, skipping');
    return null;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.customer_email,
        subject: `Appointment Confirmed - ${businessName}`,
        html: generateCustomerConfirmationHtml(booking, businessName),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await response.json();
    console.log('[Email] Customer confirmation sent:', data.id);
    return data.id;
  } catch (error) {
    console.error('[Email] Failed to send customer confirmation:', error);
    return null;
  }
}

/**
 * Send booking notification email to business owner
 */
async function sendBusinessNotification(booking, businessName, businessEmail) {
  if (!RESEND_API_KEY) {
    console.warn('[Email] Resend API key not configured, skipping email');
    return null;
  }

  if (!businessEmail) {
    console.log('[Email] No business email provided, skipping');
    return null;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: businessEmail,
        subject: `New Booking: ${booking.customer_name}`,
        html: generateBusinessNotificationHtml(booking, businessName),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await response.json();
    console.log('[Email] Business notification sent:', data.id);
    return data.id;
  } catch (error) {
    console.error('[Email] Failed to send business notification:', error);
    return null;
  }
}

/**
 * Send reminder email to customer
 */
async function sendReminderEmail(booking, businessName, hoursUntil) {
  if (!RESEND_API_KEY) {
    console.warn('[Email] Resend API key not configured, skipping email');
    return null;
  }

  if (!booking.customer_email) {
    console.log('[Email] No customer email provided, skipping');
    return null;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: booking.customer_email,
        subject: `Reminder: Appointment ${hoursUntil === 24 ? 'Tomorrow' : 'in 1 Hour'} - ${businessName}`,
        html: generateReminderHtml(booking, businessName, hoursUntil),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await response.json();
    console.log('[Email] Reminder sent:', data.id);
    return data.id;
  } catch (error) {
    console.error('[Email] Failed to send reminder:', error);
    return null;
  }
}

// HTML Email Templates

function generateCustomerConfirmationHtml(booking, businessName) {
  const startDate = new Date(booking.start_time);
  const endDate = new Date(booking.end_time);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #E2E8F0;">
              <div style="width: 64px; height: 64px; background-color: #D1FAE5; border-radius: 50%; margin: 0 auto 20px; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1E293B;">Booking Confirmed!</h1>
              <p style="margin: 10px 0 0; font-size: 16px; color: #64748B;">Your appointment has been successfully scheduled</p>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td style="padding: 40px;">
              <div style="background-color: #F8FAFC; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Business</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1E293B;">${businessName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Date & Time</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1E293B;">${formatDate(startDate)}</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #475569;">${formatTime(startDate)} - ${formatTime(endDate)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">Confirmation Number</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; font-family: monospace; color: #1E293B;">${booking.id.substring(0, 8).toUpperCase()}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Info Box -->
              <div style="background-color: #DBEAFE; border-left: 4px solid #2563EB; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1E293B;">📱 Confirmation Sent</p>
                <p style="margin: 8px 0 0; font-size: 14px; color: #475569; line-height: 1.5;">You'll receive a reminder 24 hours before your appointment.</p>
              </div>

              <!-- Contact Info -->
              <div>
                <p style="margin: 0 0 8px; font-size: 14px; color: #64748B;">Your contact information:</p>
                <p style="margin: 0; font-size: 14px; color: #1E293B;"><strong>${booking.customer_name}</strong></p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #64748B;">${booking.customer_phone}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #E2E8F0;">
              <p style="margin: 0 0 12px; font-size: 12px; color: #94A3B8;">Need to make changes? Contact ${businessName} directly.</p>
              <div style="margin-top: 20px;">
                <a href="https://flynnai.app" style="display: inline-flex; align-items: center; text-decoration: none; color: #64748B; font-size: 12px;">
                  <span>Powered by</span>
                  <strong style="margin-left: 6px; color: #2563EB;">Flynn</strong>
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateBusinessNotificationHtml(booking, businessName) {
  const startDate = new Date(booking.start_time);
  const endDate = new Date(booking.end_time);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Booking</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: #1E293B;">New Booking Received</h1>

              <div style="background-color: #F8FAFC; border-radius: 8px; padding: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">CUSTOMER</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1E293B;">${booking.customer_name}</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #64748B;">${booking.customer_phone}</p>
                      ${booking.customer_email ? `<p style="margin: 4px 0 0; font-size: 14px; color: #64748B;">${booking.customer_email}</p>` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">APPOINTMENT</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1E293B;">${formatDate(startDate)}</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #475569;">${formatTime(startDate)} - ${formatTime(endDate)}</p>
                    </td>
                  </tr>
                  ${booking.notes ? `
                  <tr>
                    <td>
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">NOTES</p>
                      <p style="margin: 0; font-size: 14px; color: #475569;">${booking.notes}</p>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="margin-top: 30px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #94A3B8;">This booking was made through your Flynn AI booking page</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateReminderHtml(booking, businessName, hoursUntil) {
  const startDate = new Date(booking.start_time);
  const endDate = new Date(booking.end_time);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8FAFC; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: #FEF3C7; border-radius: 50%; margin: 0 auto 20px; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1E293B;">Appointment Reminder</h1>
              <p style="margin: 10px 0 0; font-size: 18px; color: #F59E0B; font-weight: 600;">
                ${hoursUntil === 24 ? 'Tomorrow' : 'In 1 Hour'}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 40px;">
              <div style="background-color: #F8FAFC; border-radius: 8px; padding: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">WITH</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1E293B;">${businessName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin: 0 0 4px; font-size: 12px; color: #64748B;">WHEN</p>
                      <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1E293B;">${formatDate(startDate)}</p>
                      <p style="margin: 4px 0 0; font-size: 14px; color: #475569;">${formatTime(startDate)} - ${formatTime(endDate)}</p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 40px 40px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 30px;">
              <p style="margin: 0; font-size: 12px; color: #94A3B8;">Need to reschedule? Contact ${businessName} directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

// Helper functions

function formatDate(date) {
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

module.exports = {
  sendCustomerConfirmation,
  sendBusinessNotification,
  sendReminderEmail,
};
