/**
 * Quote Submission Service
 *
 * Handles quote submission creation, media uploads, and conversion to job cards.
 * Manages the customer-facing submission flow and business-side review workflow.
 */

import { supabase } from './supabase';
import type {
  QuoteSubmission,
  CreateQuoteSubmissionRequest,
  UpdateQuoteSubmissionRequest,
  QuoteSubmissionWithMedia,
  QuoteSubmissionWithRelations,
  QuoteSubmissionMedia,
  CreateMediaRequest,
  UpdateMediaRequest,
} from '../types/quoteLinks';

class QuoteSubmissionService {
  // ============================================================================
  // Quote Submissions
  // ============================================================================

  /**
   * Create a new quote submission
   */
  async createSubmission(request: CreateQuoteSubmissionRequest): Promise<QuoteSubmission> {
    const submissionData = {
      form_id: request.form_id,
      org_id: request.org_id,
      customer_name: request.customer_name,
      customer_phone: request.customer_phone,
      customer_email: request.customer_email || null,
      customer_address: request.customer_address || null,
      answers: request.answers,
      form_version: request.form_version,
      source: request.source || 'web',
      call_sid: request.call_sid || null,
      referrer: request.referrer || null,
      status: 'new',
      submitted_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('quote_submissions')
      .insert(submissionData)
      .select()
      .single();

    if (error) {
      console.error('Error creating quote submission:', error);
      throw new Error('Failed to create quote submission');
    }

    return data;
  }

  /**
   * Get all submissions for an organization
   */
  async getSubmissions(orgId: string, status?: string): Promise<QuoteSubmission[]> {
    let query = supabase
      .from('quote_submissions')
      .select('*')
      .eq('org_id', orgId)
      .order('submitted_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching quote submissions:', error);
      throw new Error('Failed to load quote submissions');
    }

    return data || [];
  }

  /**
   * Get a single submission by ID
   */
  async getSubmission(submissionId: string): Promise<QuoteSubmission | null> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (error) {
      console.error('Error fetching quote submission:', error);
      return null;
    }

    return data;
  }

  /**
   * Get submission with media
   */
  async getSubmissionWithMedia(submissionId: string): Promise<QuoteSubmissionWithMedia | null> {
    const submission = await this.getSubmission(submissionId);
    if (!submission) return null;

    const media = await this.getSubmissionMedia(submissionId);

    return {
      ...submission,
      media,
    };
  }

  /**
   * Get submission with all relations (media, form, job, quote, client)
   */
  async getSubmissionWithRelations(submissionId: string): Promise<QuoteSubmissionWithRelations | null> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .select(
        `
        *,
        form:business_quote_forms(*),
        job:jobs(*),
        quote:quotes(*),
        client:clients(*)
      `
      )
      .eq('id', submissionId)
      .single();

    if (error) {
      console.error('Error fetching quote submission with relations:', error);
      return null;
    }

    const media = await this.getSubmissionMedia(submissionId);

    return {
      ...data,
      media,
    };
  }

  /**
   * Update a submission
   */
  async updateSubmission(
    submissionId: string,
    updates: UpdateQuoteSubmissionRequest
  ): Promise<QuoteSubmission> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .update(updates)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating quote submission:', error);
      throw new Error('Failed to update quote submission');
    }

    return data;
  }

  /**
   * Update submission status
   */
  async updateStatus(submissionId: string, status: string): Promise<QuoteSubmission> {
    const updates: UpdateQuoteSubmissionRequest = { status: status as any };

    if (status === 'reviewing' && !updates.reviewed_at) {
      updates.reviewed_at = new Date().toISOString();
    }
    if (status === 'quoted' && !updates.quoted_at) {
      updates.quoted_at = new Date().toISOString();
    }

    return this.updateSubmission(submissionId, updates);
  }

  /**
   * Link submission to job card
   */
  async linkToJob(submissionId: string, jobId: string): Promise<QuoteSubmission> {
    return this.updateSubmission(submissionId, { job_id: jobId });
  }

  /**
   * Link submission to quote
   */
  async linkToQuote(submissionId: string, quoteId: string): Promise<QuoteSubmission> {
    return this.updateSubmission(submissionId, {
      quote_id: quoteId,
      status: 'quoted',
      quoted_at: new Date().toISOString(),
    });
  }

  /**
   * Link submission to client
   */
  async linkToClient(submissionId: string, clientId: string): Promise<QuoteSubmission> {
    return this.updateSubmission(submissionId, { client_id: clientId });
  }

  /**
   * Delete a submission
   */
  async deleteSubmission(submissionId: string): Promise<void> {
    const { error } = await supabase
      .from('quote_submissions')
      .delete()
      .eq('id', submissionId);

    if (error) {
      console.error('Error deleting quote submission:', error);
      throw new Error('Failed to delete quote submission');
    }
  }

  // ============================================================================
  // Submission Media
  // ============================================================================

  /**
   * Get all media for a submission
   */
  async getSubmissionMedia(submissionId: string): Promise<QuoteSubmissionMedia[]> {
    const { data, error } = await supabase
      .from('quote_submission_media')
      .select('*')
      .eq('submission_id', submissionId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching submission media:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create media record (before upload)
   */
  async createMediaRecord(request: CreateMediaRequest): Promise<QuoteSubmissionMedia> {
    const mediaData = {
      submission_id: request.submission_id,
      media_type: request.media_type,
      original_filename: request.original_filename,
      mime_type: request.mime_type,
      file_size_bytes: request.file_size_bytes,
      upload_status: 'pending',
      upload_progress: 0,
      scan_status: 'pending',
    };

    const { data, error } = await supabase
      .from('quote_submission_media')
      .insert(mediaData)
      .select()
      .single();

    if (error) {
      console.error('Error creating media record:', error);
      throw new Error('Failed to create media record');
    }

    return data;
  }

  /**
   * Update media record (after upload)
   */
  async updateMediaRecord(mediaId: string, updates: UpdateMediaRequest): Promise<QuoteSubmissionMedia> {
    const { data, error } = await supabase
      .from('quote_submission_media')
      .update(updates)
      .eq('id', mediaId)
      .select()
      .single();

    if (error) {
      console.error('Error updating media record:', error);
      throw new Error('Failed to update media record');
    }

    return data;
  }

  /**
   * Update media upload progress
   */
  async updateMediaProgress(mediaId: string, progress: number): Promise<void> {
    await supabase
      .from('quote_submission_media')
      .update({
        upload_progress: progress,
        upload_status: progress === 100 ? 'completed' : 'uploading',
      })
      .eq('id', mediaId);
  }

  /**
   * Mark media upload as completed
   */
  async completeMediaUpload(
    mediaId: string,
    fileUrl: string,
    metadata?: Partial<UpdateMediaRequest>
  ): Promise<QuoteSubmissionMedia> {
    return this.updateMediaRecord(mediaId, {
      file_url: fileUrl,
      upload_status: 'completed',
      upload_progress: 100,
      ...metadata,
    });
  }

  /**
   * Mark media upload as failed
   */
  async failMediaUpload(mediaId: string, error: string): Promise<QuoteSubmissionMedia> {
    return this.updateMediaRecord(mediaId, {
      upload_status: 'failed',
      upload_error: error,
    });
  }

  /**
   * Delete media record
   */
  async deleteMedia(mediaId: string): Promise<void> {
    const { error } = await supabase
      .from('quote_submission_media')
      .delete()
      .eq('id', mediaId);

    if (error) {
      console.error('Error deleting media:', error);
      throw new Error('Failed to delete media');
    }
  }

  /**
   * Get upload URL for media (Supabase Storage)
   */
  async getUploadUrl(
    submissionId: string,
    fileName: string,
    mimeType: string
  ): Promise<{ uploadUrl: string; filePath: string }> {
    // Generate unique file path
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = fileName.split('.').pop();
    const filePath = `submissions/${submissionId}/${timestamp}-${randomString}.${extension}`;

    // Create signed upload URL
    const { data, error } = await supabase.storage
      .from('quote-submissions')
      .createSignedUploadUrl(filePath);

    if (error) {
      console.error('Error creating upload URL:', error);
      throw new Error('Failed to create upload URL');
    }

    return {
      uploadUrl: data.signedUrl,
      filePath,
    };
  }

  /**
   * Get public URL for uploaded media
   */
  getMediaUrl(filePath: string): string {
    const { data } = supabase.storage.from('quote-submissions').getPublicUrl(filePath);
    return data.publicUrl;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get submission statistics
   */
  async getSubmissionStats(orgId: string): Promise<{
    total: number;
    new: number;
    reviewing: number;
    quoted: number;
    won: number;
    lost: number;
    conversionRate: number;
  }> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .select('status')
      .eq('org_id', orgId);

    if (error) {
      console.error('Error fetching submission stats:', error);
      return {
        total: 0,
        new: 0,
        reviewing: 0,
        quoted: 0,
        won: 0,
        lost: 0,
        conversionRate: 0,
      };
    }

    const total = data.length;
    const statusCounts = data.reduce((acc, submission) => {
      acc[submission.status] = (acc[submission.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const won = statusCounts.won || 0;
    const conversionRate = total > 0 ? (won / total) * 100 : 0;

    return {
      total,
      new: statusCounts.new || 0,
      reviewing: statusCounts.reviewing || 0,
      quoted: statusCounts.quoted || 0,
      won,
      lost: statusCounts.lost || 0,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  }

  /**
   * Get recent submissions for an organization
   */
  async getRecentSubmissions(orgId: string, limit = 10): Promise<QuoteSubmission[]> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .select('*')
      .eq('org_id', orgId)
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent submissions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Search submissions by customer name or phone
   */
  async searchSubmissions(orgId: string, query: string): Promise<QuoteSubmission[]> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .select('*')
      .eq('org_id', orgId)
      .or(`customer_name.ilike.%${query}%,customer_phone.ilike.%${query}%`)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error searching submissions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get submissions by form ID
   */
  async getSubmissionsByForm(formId: string): Promise<QuoteSubmission[]> {
    const { data, error } = await supabase
      .from('quote_submissions')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions by form:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Format answers for display
   */
  formatAnswers(answers: Record<string, any>, questions: any[]): Array<{ question: string; answer: string }> {
    return questions
      .filter((q) => answers.hasOwnProperty(q.id))
      .sort((a, b) => a.order - b.order)
      .map((q) => {
        const rawAnswer = answers[q.id];
        let formattedAnswer: string;

        switch (q.type) {
          case 'yes_no':
            formattedAnswer = rawAnswer ? 'Yes' : 'No';
            break;

          case 'single_choice':
            const singleOption = q.options?.find((opt: any) => opt.value === rawAnswer);
            formattedAnswer = singleOption?.label || rawAnswer;
            break;

          case 'multi_select':
            const selectedOptions = q.options?.filter((opt: any) =>
              Array.isArray(rawAnswer) && rawAnswer.includes(opt.value)
            );
            formattedAnswer = selectedOptions?.map((opt: any) => opt.label).join(', ') || rawAnswer;
            break;

          case 'number':
            formattedAnswer = `${rawAnswer}${q.unit ? ' ' + q.unit : ''}`;
            break;

          default:
            formattedAnswer = String(rawAnswer);
        }

        return {
          question: q.question,
          answer: formattedAnswer,
        };
      });
  }
}

export default new QuoteSubmissionService();
