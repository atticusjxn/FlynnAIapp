// Booking Reminder Scheduler
// Processes pending booking reminders (24 hours and 1 hour before appointments)

const { createClient } = require('@supabase/supabase-js');
const { sendReminderEmail } = require('./emailService');
const { sendReminderSMS } = require('./smsReminderService');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Process all pending booking reminders
 * Called every minute by the cron job
 */
async function processPendingBookingReminders() {
  try {
    const now = new Date();

    // Process 24-hour reminders
    await process24HourReminders(now);

    // Process 1-hour reminders
    await process1HourReminders(now);

    console.log('[BookingReminders] Processed reminders successfully');
  } catch (error) {
    console.error('[BookingReminders] Error processing reminders:', error);
  }
}

/**
 * Process 24-hour reminders
 */
async function process24HourReminders(now) {
  const reminderTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
  const reminderWindow = 5 * 60 * 1000; // 5-minute window

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      booking_pages (
        business_name
      )
    `)
    .eq('status', 'confirmed')
    .is('reminder_1day_sent_at', null)
    .gte('start_time', new Date(reminderTime.getTime() - reminderWindow).toISOString())
    .lte('start_time', new Date(reminderTime.getTime() + reminderWindow).toISOString());

  if (error) {
    console.error('[BookingReminders] Error fetching 24-hour reminders:', error);
    return;
  }

  if (!bookings || bookings.length === 0) {
    return;
  }

  console.log(`[BookingReminders] Processing ${bookings.length} 24-hour reminders`);

  for (const booking of bookings) {
    await sendReminderForBooking(booking, 24);
  }
}

/**
 * Process 1-hour reminders
 */
async function process1HourReminders(now) {
  const reminderTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  const reminderWindow = 5 * 60 * 1000; // 5-minute window

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      booking_pages (
        business_name
      )
    `)
    .eq('status', 'confirmed')
    .is('reminder_1hour_sent_at', null)
    .gte('start_time', new Date(reminderTime.getTime() - reminderWindow).toISOString())
    .lte('start_time', new Date(reminderTime.getTime() + reminderWindow).toISOString());

  if (error) {
    console.error('[BookingReminders] Error fetching 1-hour reminders:', error);
    return;
  }

  if (!bookings || bookings.length === 0) {
    return;
  }

  console.log(`[BookingReminders] Processing ${bookings.length} 1-hour reminders`);

  for (const booking of bookings) {
    await sendReminderForBooking(booking, 1);
  }
}

/**
 * Send reminder for a specific booking
 */
async function sendReminderForBooking(booking, hoursUntil) {
  const businessName = booking.booking_pages?.business_name || 'the business';

  try {
    // Send reminders (both email and SMS if applicable)
    await Promise.all([
      sendReminderEmail(booking, businessName, hoursUntil),
      sendReminderSMS(booking, businessName, hoursUntil),
    ]);

    // Mark reminder as sent
    const updateColumn = hoursUntil === 24 ? 'reminder_1day_sent_at' : 'reminder_1hour_sent_at';
    await supabase
      .from('bookings')
      .update({ [updateColumn]: new Date().toISOString() })
      .eq('id', booking.id);

    console.log(`[BookingReminders] Sent ${hoursUntil}h reminder for booking ${booking.id}`);
  } catch (error) {
    console.error(`[BookingReminders] Failed to send reminder for booking ${booking.id}:`, error);
  }
}

module.exports = {
  processPendingBookingReminders,
};
