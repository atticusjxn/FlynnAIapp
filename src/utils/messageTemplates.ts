import { Job } from '../components/jobs/JobCard';
import { Platform } from 'react-native';

/**
 * Message Templates Utility
 * Generates pre-filled confirmation messages for text and email
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

export interface EmailMessage {
  subject: string;
  body: string;
}

/**
 * Generate a text message confirmation for a job
 * Prioritizes AI-generated follow-up drafts from voicemail if available
 */
export const generateTextConfirmation = (job: Job): string => {
  // If AI receptionist generated a follow-up draft, use that
  if (job.followUpDraft) {
    return job.followUpDraft;
  }

  // Otherwise, generate standard confirmation
  const date = formatDate(job.date);
  const time = formatTime(job.time);

  return `Hi ${job.clientName}! This is a confirmation for your ${job.serviceType.toLowerCase()} service appointment.\n\n📅 Date: ${date}\n⏰ Time: ${time}\n📍 Location: ${job.location}\n\nWe'll see you then! Reply STOP to opt out.`;
};

/**
 * Generate an email confirmation for a job
 */
export const generateEmailConfirmation = (job: Job): EmailMessage => {
  const date = formatDate(job.date);
  const time = formatTime(job.time);

  const subject = `Appointment Confirmation - ${job.serviceType}`;

  const body = `Dear ${job.clientName},

This email confirms your upcoming service appointment:

Service: ${job.serviceType}
Date: ${date}
Time: ${time}
Location: ${job.location}

${job.description ? `Details: ${job.description}\n\n` : ''}${job.notes ? `Notes: ${job.notes}\n\n` : ''}We look forward to serving you. If you need to make any changes, please contact us as soon as possible.

Best regards,
Your Service Team`;

  return { subject, body };
};

/**
 * Generate a follow-up message for voicemail-captured jobs
 * Uses AI-generated draft if available, otherwise creates a standard message
 */
export const generateFollowUpMessage = (job: Job): string => {
  if (job.followUpDraft) {
    return job.followUpDraft;
  }

  const date = formatDate(job.date);
  const time = formatTime(job.time);

  return `Hi ${job.clientName}, thanks for your voicemail! I've scheduled your ${job.serviceType.toLowerCase()} for ${date} at ${time}. ${job.location ? `Location: ${job.location}. ` : ''}Looking forward to it!`;
};

/**
 * Open native SMS app with pre-filled message
 * Returns the SMS URL for use with Linking.openURL()
 *
 * iOS Messages app doesn't properly decode URL-encoded characters.
 * Solution: Don't encode the message at all - just pass it as-is.
 */
export const createSMSUrl = (phoneNumber: string, message: string): string => {
  // Clean phone number (remove spaces, dashes, etc)
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  if (Platform.OS === 'ios') {
    // iOS: Don't encode the message - iOS handles it properly when unencoded
    // Just escape the ampersand separator from the message body
    const cleanMessage = message.replace(/&/g, '%26');
    return `sms:${cleanPhone}&body=${cleanMessage}`;
  } else {
    // Android: Full URL encoding works fine
    const encodedMessage = encodeURIComponent(message);
    return `sms:${cleanPhone}?body=${encodedMessage}`;
  }
};

/**
 * Open native email app with pre-filled message
 * Returns the mailto URL for use with Linking.openURL()
 */
export const createEmailUrl = (
  email: string,
  subject: string,
  body: string
): string => {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
};
