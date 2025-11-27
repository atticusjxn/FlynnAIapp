import { Job } from '../components/jobs/JobCard';

/**
 * Formats a date string into a readable format
 * Example: "Monday, January 15, 2025"
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Formats a time string into a readable format
 * Example: "2:30 PM"
 */
const formatTime = (timeString: string): string => {
  try {
    const time = new Date(`1970-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return timeString;
  }
};

/**
 * Generates an SMS confirmation message for a job
 * The message includes all current job details and updates dynamically
 * when the job is edited.
 */
export const generateSmsConfirmation = (job: Job): string => {
  const date = formatDate(job.date);
  const time = formatTime(job.time);

  // Use follow-up draft if available (for voicemail-sourced jobs)
  if (job.followUpDraft) {
    return job.followUpDraft;
  }

  // Generate standard confirmation message
  let message = `Hi ${job.clientName}! This is a confirmation for your ${job.serviceType.toLowerCase()} appointment.\n\n`;
  message += `📅 Date: ${date}\n`;
  message += `⏰ Time: ${time}\n`;
  message += `📍 Location: ${job.location}\n`;

  // Add description if available
  if (job.description) {
    message += `\nDetails: ${job.description}\n`;
  }

  // Add duration if available
  if (job.estimatedDuration) {
    message += `⏱️ Duration: ${job.estimatedDuration}\n`;
  }

  message += `\nWe'll see you then! Reply STOP to opt out.`;

  return message;
};

/**
 * Opens the native SMS app with a pre-filled message
 * Returns the SMS URL for use with Linking.openURL()
 */
export const createSmsUrl = (phoneNumber: string, message: string): string => {
  // Validate phone number
  if (!phoneNumber) {
    throw new Error('Phone number is required to send SMS');
  }

  // Clean phone number (remove any formatting)
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');

  if (!cleanPhone) {
    throw new Error('Invalid phone number format');
  }

  // URL encode the message
  const encodedMessage = encodeURIComponent(message);

  // Different URL schemes for iOS vs Android
  // iOS uses 'sms:' with & separator, Android uses 'sms:' with ? separator
  // React Native's Linking API handles this automatically, so we use the iOS format
  return `sms:${cleanPhone}&body=${encodedMessage}`;
};
