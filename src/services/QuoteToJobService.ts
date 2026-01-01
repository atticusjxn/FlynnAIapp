/**
 * Quote to Job Service
 *
 * Handles auto-creation of job cards from quote submissions.
 * Links quotes, clients, and calendar events.
 */

import { supabase } from './supabase';
import QuoteSubmissionService from './QuoteSubmissionService';
import type { QuoteSubmission, QuoteSubmissionWithMedia } from '../types/quoteLinks';

interface CreateJobFromQuoteRequest {
  submissionId: string;
  scheduledDate?: Date;
  assignedTo?: string;
}

interface JobCard {
  id: string;
  org_id: string;
  client_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  scheduled_date?: string;
  assigned_to?: string;
  quote_submission_id: string;
  created_at: string;
  updated_at: string;
}

class QuoteToJobService {
  /**
   * Auto-create a job card from a quote submission
   */
  async createJobFromQuote(request: CreateJobFromQuoteRequest): Promise<JobCard> {
    const { submissionId, scheduledDate, assignedTo } = request;

    // Get submission with all details
    const submission = await QuoteSubmissionService.getSubmissionWithMedia(submissionId);
    if (!submission) {
      throw new Error('Quote submission not found');
    }

    // Get the quote form to understand the questions
    const { data: form, error: formError } = await supabase
      .from('business_quote_forms')
      .select('*')
      .eq('id', submission.form_id)
      .single();

    if (formError || !form) {
      throw new Error('Quote form not found');
    }

    // Find or create client
    const client = await this.findOrCreateClient(submission);

    // Generate job title and description from answers
    const { title, description } = this.generateJobDetails(submission, form);

    // Create job card
    const jobData = {
      org_id: submission.org_id,
      client_id: client.id,
      title,
      description,
      status: 'new', // new, in_progress, completed, cancelled
      priority: this.determinePriority(submission, form),
      scheduled_date: scheduledDate?.toISOString() || null,
      assigned_to: assignedTo || null,
      quote_submission_id: submissionId,
      source: 'quote_form',
      metadata: {
        form_title: form.title,
        answers: submission.answers,
        media_count: submission.media.length,
        has_estimate: submission.estimated_price_min !== null,
        estimate_range: submission.estimated_price_min
          ? `${submission.estimated_price_min}-${submission.estimated_price_max}`
          : null,
      },
    };

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      throw new Error('Failed to create job card');
    }

    // Link submission to job
    await QuoteSubmissionService.linkToJob(submissionId, job.id);

    // Link submission to client
    await QuoteSubmissionService.linkToClient(submissionId, client.id);

    // Update submission status
    await QuoteSubmissionService.updateStatus(submissionId, 'reviewing');

    // Attach media as job attachments
    if (submission.media.length > 0) {
      await this.attachMediaToJob(job.id, submission.media);
    }

    return job;
  }

  /**
   * Find existing client or create new one
   */
  private async findOrCreateClient(submission: QuoteSubmission): Promise<any> {
    // Try to find existing client by phone
    const { data: existingClient, error: searchError } = await supabase
      .from('clients')
      .select('*')
      .eq('org_id', submission.org_id)
      .eq('phone', submission.customer_phone)
      .single();

    if (existingClient) {
      // Update email/address if provided and not already set
      const updates: any = {};
      if (submission.customer_email && !existingClient.email) {
        updates.email = submission.customer_email;
      }
      if (submission.customer_address && !existingClient.address) {
        updates.address = submission.customer_address;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('clients')
          .update(updates)
          .eq('id', existingClient.id);
      }

      return existingClient;
    }

    // Create new client
    const clientData = {
      org_id: submission.org_id,
      name: submission.customer_name,
      phone: submission.customer_phone,
      email: submission.customer_email || null,
      address: submission.customer_address || null,
      source: 'quote_form',
      notes: `Created from quote request`,
    };

    const { data: newClient, error: createError } = await supabase
      .from('clients')
      .insert(clientData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating client:', createError);
      throw new Error('Failed to create client');
    }

    return newClient;
  }

  /**
   * Generate job title and description from submission
   */
  private generateJobDetails(
    submission: QuoteSubmission,
    form: any
  ): { title: string; description: string } {
    const answers = submission.answers;
    const questions = form.questions;

    // Try to extract main service/issue from first question
    let primaryAnswer = '';
    if (questions.length > 0) {
      const firstQuestion = questions[0];
      const answer = answers[firstQuestion.id];

      if (firstQuestion.type === 'single_choice' || firstQuestion.type === 'multi_select') {
        const options = firstQuestion.options || [];
        if (Array.isArray(answer)) {
          primaryAnswer = options
            .filter((opt: any) => answer.includes(opt.value))
            .map((opt: any) => opt.label)
            .join(', ');
        } else {
          const option = options.find((opt: any) => opt.value === answer);
          primaryAnswer = option?.label || String(answer);
        }
      } else {
        primaryAnswer = String(answer);
      }
    }

    // Generate title
    const title =
      primaryAnswer && primaryAnswer.length > 0
        ? `${form.title.split(' ')[0]} - ${primaryAnswer}`
        : form.title;

    // Generate description with all answers
    let description = `Quote request from ${submission.customer_name}\n\n`;

    questions.forEach((q: any) => {
      const answer = answers[q.id];
      if (answer !== null && answer !== undefined) {
        const formattedAnswer = this.formatAnswer(q, answer);
        description += `**${q.question}**\n${formattedAnswer}\n\n`;
      }
    });

    // Add estimate if available
    if (submission.estimated_price_min !== null) {
      description += `\n**Estimated Price:** $${submission.estimated_price_min}`;
      if (submission.estimated_price_max !== submission.estimated_price_min) {
        description += ` - $${submission.estimated_price_max}`;
      }
      description += `\n`;
    }

    // Add contact details
    description += `\n**Contact:**\n`;
    description += `Phone: ${submission.customer_phone}\n`;
    if (submission.customer_email) {
      description += `Email: ${submission.customer_email}\n`;
    }
    if (submission.customer_address) {
      description += `Address: ${submission.customer_address}\n`;
    }

    return { title: title.substring(0, 100), description };
  }

  /**
   * Format answer for display
   */
  private formatAnswer(question: any, answer: any): string {
    if (answer === null || answer === undefined) return 'Not answered';

    switch (question.type) {
      case 'yes_no':
        return answer ? 'Yes' : 'No';

      case 'single_choice':
        const option = question.options?.find((opt: any) => opt.value === answer);
        return option?.label || String(answer);

      case 'multi_select':
        const selected = question.options?.filter(
          (opt: any) => Array.isArray(answer) && answer.includes(opt.value)
        );
        return selected?.map((opt: any) => opt.label).join(', ') || String(answer);

      case 'number':
        return `${answer}${question.unit ? ' ' + question.unit : ''}`;

      default:
        return String(answer);
    }
  }

  /**
   * Determine job priority based on submission
   */
  private determinePriority(submission: QuoteSubmission, form: any): string {
    // Check for emergency/urgent keywords in answers
    const questions = form.questions;
    const answers = submission.answers;

    for (const question of questions) {
      const answer = answers[question.id];

      // Check for "emergency" or "urgent" type questions
      if (
        question.question.toLowerCase().includes('emergency') ||
        question.question.toLowerCase().includes('urgent')
      ) {
        if (answer === true || answer === 'yes' || answer === 'emergency') {
          return 'high';
        }
      }

      // Check for urgency in text answers
      if (typeof answer === 'string') {
        const lowerAnswer = answer.toLowerCase();
        if (
          lowerAnswer.includes('asap') ||
          lowerAnswer.includes('urgent') ||
          lowerAnswer.includes('emergency')
        ) {
          return 'high';
        }
      }
    }

    return 'medium';
  }

  /**
   * Attach media files to job
   */
  private async attachMediaToJob(jobId: string, media: any[]): Promise<void> {
    const attachments = media.map((m) => ({
      job_id: jobId,
      file_url: m.file_url,
      file_type: m.media_type,
      file_name: m.original_filename,
      file_size: m.file_size_bytes,
      thumbnail_url: m.thumbnail_url,
      uploaded_at: m.created_at,
    }));

    const { error } = await supabase.from('job_attachments').insert(attachments);

    if (error) {
      console.error('Error attaching media to job:', error);
      // Non-fatal - job already created
    }
  }

  /**
   * Get all jobs created from quote submissions
   */
  async getJobsFromQuotes(orgId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        `
        *,
        quote_submission:quote_submissions(*)
      `
      )
      .eq('org_id', orgId)
      .not('quote_submission_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs from quotes:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Auto-create job when submission is marked as "reviewing"
   * Call this from webhook or background job
   */
  async autoCreateJobForNewSubmissions(orgId: string): Promise<void> {
    // Get all "new" submissions without linked jobs
    const { data: submissions, error } = await supabase
      .from('quote_submissions')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'new')
      .is('job_id', null);

    if (error || !submissions || submissions.length === 0) {
      return;
    }

    // Create jobs for each submission
    for (const submission of submissions) {
      try {
        await this.createJobFromQuote({ submissionId: submission.id });
      } catch (error) {
        console.error(
          `Error auto-creating job for submission ${submission.id}:`,
          error
        );
        // Continue with next submission
      }
    }
  }
}

export default new QuoteToJobService();
