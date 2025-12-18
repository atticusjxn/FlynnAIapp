// services/reminderScheduler.js
// Automated reminder scheduling and sending service

const { createClient } = require('@supabase/supabase-js');

class ReminderScheduler {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /**
   * Schedule all reminders for a job when it's created or updated
   */
  async scheduleRemindersForJob(jobId, orgId) {
    try {
      console.log(`[ReminderScheduler] Scheduling reminders for job ${jobId}`);

      // Get job details
      const { data: job, error: jobError } = await this.supabase
        .from('jobs')
        .select('*, clients(*)')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Check if reminders are enabled for this job
      if (!job.reminders_enabled) {
        console.log(`[ReminderScheduler] Reminders disabled for job ${jobId}`);
        return { scheduled: 0, message: 'Reminders disabled for this job' };
      }

      // Get organization reminder settings
      const { data: settings, error: settingsError } = await this.supabase
        .from('reminder_settings')
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (settingsError || !settings || !settings.enabled) {
        console.log(`[ReminderScheduler] Reminders not enabled for org ${orgId}`);
        return { scheduled: 0, message: 'Reminders not enabled for organization' };
      }

      // Parse job date and time
      if (!job.scheduled_date || !job.scheduled_time) {
        console.log(`[ReminderScheduler] Job ${jobId} missing date/time`);
        return { scheduled: 0, message: 'Job missing scheduled date or time' };
      }

      const jobDateTime = new Date(`${job.scheduled_date}T${job.scheduled_time}`);
      const now = new Date();

      // Validate job is in the future
      if (jobDateTime <= now) {
        console.log(`[ReminderScheduler] Job ${jobId} is in the past`);
        return { scheduled: 0, message: 'Job is in the past' };
      }

      // Cancel existing pending reminders for this job
      await this.cancelPendingReminders(jobId);

      const remindersToSchedule = [];

      // 1. Confirmation reminder (immediate)
      if (settings.confirmation_enabled) {
        const confirmationTime = new Date(now.getTime() + 30000); // 30 seconds from now

        remindersToSchedule.push({
          reminder_type: 'confirmation',
          scheduled_for: confirmationTime.toISOString(),
          message_template: settings.confirmation_template,
        });
      }

      // 2. One day before reminder
      if (settings.one_day_before_enabled) {
        const oneDayBefore = new Date(jobDateTime);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);

        const [hours, minutes] = settings.one_day_before_time.split(':');
        oneDayBefore.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        if (oneDayBefore > now) {
          remindersToSchedule.push({
            reminder_type: 'one_day_before',
            scheduled_for: oneDayBefore.toISOString(),
            message_template: settings.one_day_before_template,
          });
        }
      }

      // 3. Morning of reminder
      if (settings.morning_of_enabled) {
        const morningOf = new Date(jobDateTime);
        const [hours, minutes] = settings.morning_of_time.split(':');
        morningOf.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Skip if weekend and setting enabled
        const isWeekend = morningOf.getDay() === 0 || morningOf.getDay() === 6;
        if (morningOf > now && !(settings.skip_weekends_for_morning && isWeekend)) {
          remindersToSchedule.push({
            reminder_type: 'morning_of',
            scheduled_for: morningOf.toISOString(),
            message_template: settings.morning_of_template,
          });
        }
      }

      // 4. Two hours before reminder
      if (settings.two_hours_before_enabled) {
        const twoHoursBefore = new Date(jobDateTime.getTime() - 2 * 60 * 60 * 1000);

        if (twoHoursBefore > now) {
          remindersToSchedule.push({
            reminder_type: 'two_hours_before',
            scheduled_for: twoHoursBefore.toISOString(),
            message_template: settings.two_hours_before_template,
          });
        }
      }

      // 5. Custom reminders
      if (settings.custom_reminders && Array.isArray(settings.custom_reminders)) {
        for (const customReminder of settings.custom_reminders) {
          if (!customReminder.enabled) continue;

          const scheduledTime = this.calculateCustomReminderTime(
            jobDateTime,
            customReminder.timing
          );

          if (scheduledTime > now) {
            remindersToSchedule.push({
              reminder_type: 'custom',
              custom_reminder_id: customReminder.id,
              scheduled_for: scheduledTime.toISOString(),
              message_template: customReminder.template,
            });
          }
        }
      }

      // Get client phone
      const clientPhone = job.clients?.phone || job.client_phone;
      if (!clientPhone) {
        console.log(`[ReminderScheduler] Job ${jobId} missing client phone`);
        return { scheduled: 0, message: 'Client phone number not found' };
      }

      // Insert all reminders into database
      const reminderRecords = remindersToSchedule.map((reminder) => ({
        org_id: orgId,
        job_id: jobId,
        client_id: job.client_id,
        reminder_type: reminder.reminder_type,
        custom_reminder_id: reminder.custom_reminder_id || null,
        scheduled_for: reminder.scheduled_for,
        message_template: reminder.message_template,
        recipient_phone: clientPhone,
        status: 'pending',
      }));

      if (reminderRecords.length === 0) {
        console.log(`[ReminderScheduler] No reminders to schedule for job ${jobId}`);
        return { scheduled: 0, message: 'No reminders configured' };
      }

      const { data: insertedReminders, error: insertError } = await this.supabase
        .from('scheduled_reminders')
        .insert(reminderRecords)
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log(
        `[ReminderScheduler] Scheduled ${insertedReminders.length} reminders for job ${jobId}`
      );

      return {
        scheduled: insertedReminders.length,
        reminders: insertedReminders,
        message: `Successfully scheduled ${insertedReminders.length} reminders`
      };
    } catch (error) {
      console.error('[ReminderScheduler] Error scheduling reminders:', error);
      throw error;
    }
  }

  /**
   * Calculate custom reminder time based on timing configuration
   */
  calculateCustomReminderTime(jobDateTime, timing) {
    const reminderTime = new Date(jobDateTime);

    const multiplier = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
    }[timing.unit];

    reminderTime.setTime(reminderTime.getTime() - timing.value * multiplier);

    // If specific time is set, adjust to that time
    if (timing.specificTime) {
      const [hours, minutes] = timing.specificTime.split(':');
      reminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    return reminderTime;
  }

  /**
   * Cancel pending reminders for a job (when rescheduled or cancelled)
   */
  async cancelPendingReminders(jobId) {
    try {
      const { error } = await this.supabase
        .from('scheduled_reminders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('job_id', jobId)
        .eq('status', 'pending');

      if (error) {
        console.error('[ReminderScheduler] Error cancelling reminders:', error);
        throw error;
      }

      console.log(`[ReminderScheduler] Cancelled pending reminders for job ${jobId}`);
    } catch (error) {
      console.error('[ReminderScheduler] Error in cancelPendingReminders:', error);
      throw error;
    }
  }

  /**
   * Process pending reminders (run via cron job every minute)
   */
  async processPendingReminders() {
    try {
      const now = new Date();

      // Get all pending reminders that should be sent
      const { data: reminders, error } = await this.supabase
        .from('scheduled_reminders')
        .select('*, jobs(*), clients(*)')
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(100); // Process in batches

      if (error) {
        throw error;
      }

      if (!reminders || reminders.length === 0) {
        return { processed: 0 };
      }

      console.log(`[ReminderScheduler] Processing ${reminders.length} pending reminders`);

      let successCount = 0;
      let failCount = 0;

      for (const reminder of reminders) {
        try {
          await this.sendReminder(reminder);
          successCount++;
        } catch (error) {
          console.error(`[ReminderScheduler] Failed to send reminder ${reminder.id}:`, error);
          failCount++;
        }
      }

      console.log(
        `[ReminderScheduler] Processed ${reminders.length} reminders: ${successCount} sent, ${failCount} failed`
      );

      return { processed: reminders.length, success: successCount, failed: failCount };
    } catch (error) {
      console.error('[ReminderScheduler] Error processing reminders:', error);
      throw error;
    }
  }

  /**
   * Send a single reminder
   */
  async sendReminder(reminder) {
    try {
      // Get Twilio service
      const { sendSMS } = require('./twilioService');

      // Replace template variables with actual data
      const message = this.replaceTemplateVariables(
        reminder.message_template,
        reminder.jobs,
        reminder.clients
      );

      // Get phone number to send from (job's associated Flynn number)
      const fromNumber = reminder.jobs.phone_number;
      if (!fromNumber) {
        throw new Error(`No phone number associated with job ${reminder.job_id}`);
      }

      // Send SMS via Twilio
      const result = await sendSMS({
        to: reminder.recipient_phone,
        body: message,
        from: fromNumber,
      });

      // Update reminder status
      await this.supabase
        .from('scheduled_reminders')
        .update({
          status: 'sent',
          executed_at: new Date().toISOString(),
          message_sent: message,
          twilio_sid: result.sid,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reminder.id);

      // Log to history
      await this.supabase.from('reminder_history').insert({
        org_id: reminder.org_id,
        job_id: reminder.job_id,
        reminder_id: reminder.id,
        event_type: 'sent',
        message,
        recipient_phone: reminder.recipient_phone,
        twilio_sid: result.sid,
      });

      // Update job's last reminder sent time
      await this.supabase
        .from('jobs')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminder_count: (reminder.jobs.reminder_count || 0) + 1,
        })
        .eq('id', reminder.job_id);

      console.log(`[ReminderScheduler] ✓ Sent reminder ${reminder.id} for job ${reminder.job_id}`);

      return { success: true, sid: result.sid };
    } catch (error) {
      console.error(`[ReminderScheduler] Error sending reminder ${reminder.id}:`, error);

      // Update reminder with error status
      const shouldRetry = reminder.retry_count < reminder.max_retries;

      await this.supabase
        .from('scheduled_reminders')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          retry_count: reminder.retry_count + 1,
          error_message: error.message,
          scheduled_for: shouldRetry
            ? new Date(Date.now() + 5 * 60 * 1000).toISOString() // Retry in 5 minutes
            : reminder.scheduled_for,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reminder.id);

      // Log failure to history
      await this.supabase.from('reminder_history').insert({
        org_id: reminder.org_id,
        job_id: reminder.job_id,
        reminder_id: reminder.id,
        event_type: 'failed',
        message: error.message,
        recipient_phone: reminder.recipient_phone,
      });

      throw error;
    }
  }

  /**
   * Replace template variables with actual job data
   */
  replaceTemplateVariables(template, job, client) {
    let message = template;

    const variables = {
      clientName: client?.name || job.client_name || 'there',
      serviceType: job.service_type || 'appointment',
      date: job.scheduled_date
        ? new Date(job.scheduled_date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : 'soon',
      time: job.scheduled_time || '',
      location: job.location || 'your location',
      businessName: job.business_name || 'us',
    };

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      message = message.replace(regex, value);
    }

    return message;
  }

  /**
   * Send "on the way" notification manually
   */
  async sendOnTheWayNotification(jobId, eta = 15) {
    try {
      console.log(`[ReminderScheduler] Sending on-the-way notification for job ${jobId}`);

      // Get job details
      const { data: job, error: jobError } = await this.supabase
        .from('jobs')
        .select('*, clients(*)')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Get reminder settings for template
      const { data: settings } = await this.supabase
        .from('reminder_settings')
        .select('on_the_way_template')
        .eq('org_id', job.org_id)
        .single();

      let message = settings?.on_the_way_template ||
        'Hi {{clientName}}! We\'re on our way to your location. We\'ll arrive in approximately {{eta}} minutes.';

      message = this.replaceTemplateVariables(message, job, job.clients);
      message = message.replace(/{{eta}}/g, eta.toString());

      // Get client phone
      const clientPhone = job.clients?.phone || job.client_phone;
      if (!clientPhone) {
        throw new Error('Client phone number not found');
      }

      // Get from phone number
      const fromNumber = job.phone_number;
      if (!fromNumber) {
        throw new Error('No phone number associated with job');
      }

      // Send SMS
      const { sendSMS } = require('./twilioService');
      const result = await sendSMS({
        to: clientPhone,
        body: message,
        from: fromNumber,
      });

      // Log to history
      await this.supabase.from('reminder_history').insert({
        org_id: job.org_id,
        job_id: jobId,
        event_type: 'sent',
        message,
        recipient_phone: clientPhone,
        twilio_sid: result.sid,
      });

      console.log(`[ReminderScheduler] ✓ Sent on-the-way notification for job ${jobId}`);

      return { success: true, message, sid: result.sid };
    } catch (error) {
      console.error('[ReminderScheduler] Error sending on-the-way notification:', error);
      throw error;
    }
  }

  /**
   * Get reminder statistics for an organization
   */
  async getReminderStats(orgId, startDate = null, endDate = null) {
    try {
      let query = this.supabase
        .from('scheduled_reminders')
        .select('status, reminder_type, executed_at')
        .eq('org_id', orgId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: reminders, error } = await query;

      if (error) throw error;

      // Calculate stats
      const stats = {
        total: reminders.length,
        sent: reminders.filter(r => r.status === 'sent').length,
        pending: reminders.filter(r => r.status === 'pending').length,
        failed: reminders.filter(r => r.status === 'failed').length,
        cancelled: reminders.filter(r => r.status === 'cancelled').length,
        byType: {},
      };

      // Group by reminder type
      for (const reminder of reminders) {
        if (!stats.byType[reminder.reminder_type]) {
          stats.byType[reminder.reminder_type] = { total: 0, sent: 0, failed: 0 };
        }
        stats.byType[reminder.reminder_type].total++;
        if (reminder.status === 'sent') {
          stats.byType[reminder.reminder_type].sent++;
        } else if (reminder.status === 'failed') {
          stats.byType[reminder.reminder_type].failed++;
        }
      }

      return stats;
    } catch (error) {
      console.error('[ReminderScheduler] Error getting stats:', error);
      throw error;
    }
  }
}

module.exports = new ReminderScheduler();
