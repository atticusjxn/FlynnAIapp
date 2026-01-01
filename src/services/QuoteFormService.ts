/**
 * Quote Form Service
 *
 * Handles CRUD operations for quote form templates and business quote forms.
 * Manages form publishing, slug generation, and template application.
 */

import { supabase } from './supabase';
import type {
  QuoteFormTemplate,
  BusinessQuoteForm,
  CreateBusinessQuoteFormRequest,
  UpdateBusinessQuoteFormRequest,
  QuoteFormWithTemplate,
} from '../types/quoteLinks';

class QuoteFormService {
  // ============================================================================
  // Quote Form Templates (Global Library)
  // ============================================================================

  /**
   * Get all active quote form templates
   */
  async getTemplates(): Promise<QuoteFormTemplate[]> {
    const { data, error } = await supabase
      .from('quote_form_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching quote form templates:', error);
      throw new Error('Failed to load quote form templates');
    }

    return data || [];
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string): Promise<QuoteFormTemplate | null> {
    const { data, error } = await supabase
      .from('quote_form_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.error('Error fetching quote form template:', error);
      return null;
    }

    return data;
  }

  /**
   * Get templates by industry
   */
  async getTemplatesByIndustry(industry: string): Promise<QuoteFormTemplate[]> {
    const { data, error } = await supabase
      .from('quote_form_templates')
      .select('*')
      .eq('industry', industry)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates by industry:', error);
      throw new Error('Failed to load templates');
    }

    return data || [];
  }

  // ============================================================================
  // Business Quote Forms
  // ============================================================================

  /**
   * Get all quote forms for an organization
   */
  async getQuoteForms(orgId: string): Promise<BusinessQuoteForm[]> {
    const { data, error } = await supabase
      .from('business_quote_forms')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quote forms:', error);
      throw new Error('Failed to load quote forms');
    }

    return data || [];
  }

  /**
   * Get a single quote form by ID with optional template data
   */
  async getQuoteForm(formId: string, includeTemplate = false): Promise<QuoteFormWithTemplate | null> {
    let query = supabase
      .from('business_quote_forms')
      .select('*')
      .eq('id', formId)
      .single();

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching quote form:', error);
      return null;
    }

    if (!data) return null;

    // Optionally fetch template data
    if (includeTemplate && data.template_id) {
      const template = await this.getTemplate(data.template_id);
      return { ...data, template: template || undefined };
    }

    return data;
  }

  /**
   * Get quote form by slug (for public access)
   */
  async getQuoteFormBySlug(slug: string): Promise<BusinessQuoteForm | null> {
    const { data, error } = await supabase
      .from('business_quote_forms')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();

    if (error) {
      console.error('Error fetching quote form by slug:', error);
      return null;
    }

    return data;
  }

  /**
   * Get the published quote form for an organization
   */
  async getPublishedQuoteForm(orgId: string): Promise<BusinessQuoteForm | null> {
    const { data, error } = await supabase
      .from('business_quote_forms')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching published quote form:', error);
    }

    return data || null;
  }

  /**
   * Create a new quote form
   */
  async createQuoteForm(request: CreateBusinessQuoteFormRequest): Promise<BusinessQuoteForm> {
    // Generate slug from business name or title
    const slug = await this.generateSlug(request.title, request.org_id);

    const formData = {
      org_id: request.org_id,
      slug,
      template_id: request.template_id || null,
      title: request.title,
      description: request.description || null,
      questions: request.questions,
      version: 1,
      is_published: false,
      logo_url: request.logo_url || null,
      primary_color: request.primary_color || '#2563EB',
      allow_media_upload: request.allow_media_upload !== false,
      max_photos: request.max_photos || 10,
      max_videos: request.max_videos || 3,
      require_phone: request.require_phone !== false,
      require_email: request.require_email || false,
      disclaimer: request.disclaimer || null,
    };

    const { data, error } = await supabase
      .from('business_quote_forms')
      .insert(formData)
      .select()
      .single();

    if (error) {
      console.error('Error creating quote form:', error);
      throw new Error('Failed to create quote form');
    }

    return data;
  }

  /**
   * Create quote form from template
   */
  async createFromTemplate(
    orgId: string,
    templateId: string,
    customizations?: Partial<CreateBusinessQuoteFormRequest>
  ): Promise<BusinessQuoteForm> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const formData: CreateBusinessQuoteFormRequest = {
      org_id: orgId,
      template_id: templateId,
      title: customizations?.title || template.name,
      description: customizations?.description || template.description || undefined,
      questions: customizations?.questions || template.questions,
      disclaimer: customizations?.disclaimer || template.disclaimer_template || undefined,
      ...customizations,
    };

    return this.createQuoteForm(formData);
  }

  /**
   * Update a quote form
   */
  async updateQuoteForm(
    formId: string,
    updates: UpdateBusinessQuoteFormRequest
  ): Promise<BusinessQuoteForm> {
    // If publishing, set published_at
    const updateData: any = { ...updates };
    if (updates.is_published && !updates.hasOwnProperty('published_at')) {
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('business_quote_forms')
      .update(updateData)
      .eq('id', formId)
      .select()
      .single();

    if (error) {
      console.error('Error updating quote form:', error);
      throw new Error('Failed to update quote form');
    }

    return data;
  }

  /**
   * Publish a quote form
   */
  async publishQuoteForm(formId: string): Promise<BusinessQuoteForm> {
    return this.updateQuoteForm(formId, {
      is_published: true,
    });
  }

  /**
   * Unpublish a quote form
   */
  async unpublishQuoteForm(formId: string): Promise<BusinessQuoteForm> {
    return this.updateQuoteForm(formId, {
      is_published: false,
    });
  }

  /**
   * Delete a quote form
   */
  async deleteQuoteForm(formId: string): Promise<void> {
    const { error } = await supabase
      .from('business_quote_forms')
      .delete()
      .eq('id', formId);

    if (error) {
      console.error('Error deleting quote form:', error);
      throw new Error('Failed to delete quote form');
    }
  }

  /**
   * Duplicate a quote form
   */
  async duplicateQuoteForm(formId: string): Promise<BusinessQuoteForm> {
    const original = await this.getQuoteForm(formId);
    if (!original) {
      throw new Error('Quote form not found');
    }

    const newSlug = await this.generateSlug(original.title + ' Copy', original.org_id);

    const duplicateData = {
      org_id: original.org_id,
      slug: newSlug,
      template_id: original.template_id,
      title: `${original.title} (Copy)`,
      description: original.description,
      questions: original.questions,
      version: 1,
      is_published: false,
      logo_url: original.logo_url,
      primary_color: original.primary_color,
      allow_media_upload: original.allow_media_upload,
      max_photos: original.max_photos,
      max_videos: original.max_videos,
      require_phone: original.require_phone,
      require_email: original.require_email,
      disclaimer: original.disclaimer,
      terms_url: original.terms_url,
      privacy_url: original.privacy_url,
    };

    const { data, error } = await supabase
      .from('business_quote_forms')
      .insert(duplicateData)
      .select()
      .single();

    if (error) {
      console.error('Error duplicating quote form:', error);
      throw new Error('Failed to duplicate quote form');
    }

    return data;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate a unique slug for a quote form
   */
  private async generateSlug(title: string, orgId: string): Promise<string> {
    // Create base slug from title
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    baseSlug = `${baseSlug}-quote`;

    let slug = baseSlug;
    let counter = 0;

    // Check for uniqueness and append number if needed
    while (await this.slugExists(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  /**
   * Check if a slug already exists
   */
  private async slugExists(slug: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('business_quote_forms')
      .select('id')
      .eq('slug', slug)
      .limit(1);

    if (error) {
      console.error('Error checking slug existence:', error);
      return false;
    }

    return data.length > 0;
  }

  /**
   * Get the public URL for a quote form
   */
  getQuoteFormUrl(slug: string): string {
    const domain = process.env.QUOTE_DOMAIN || process.env.BOOKING_DOMAIN || 'flynnai.app';
    return `https://${domain}/quote/${slug}`;
  }

  /**
   * Get the shareable SMS message for a quote form
   */
  getQuoteFormSMSMessage(businessName: string, slug: string): string {
    const url = this.getQuoteFormUrl(slug);
    return `Hi, this is ${businessName}. Share your project details and photos here: ${url}\n\nReply STOP to opt out.`;
  }

  /**
   * Validate question configuration
   */
  validateQuestions(questions: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(questions) || questions.length === 0) {
      errors.push('At least one question is required');
      return { valid: false, errors };
    }

    questions.forEach((q, index) => {
      if (!q.id) {
        errors.push(`Question ${index + 1}: Missing ID`);
      }
      if (!q.type) {
        errors.push(`Question ${index + 1}: Missing type`);
      }
      if (!q.question || q.question.trim() === '') {
        errors.push(`Question ${index + 1}: Question text is required`);
      }
      if (typeof q.required !== 'boolean') {
        errors.push(`Question ${index + 1}: 'required' must be true or false`);
      }
      if (typeof q.order !== 'number') {
        errors.push(`Question ${index + 1}: Order must be a number`);
      }

      // Type-specific validation
      if (['single_choice', 'multi_select'].includes(q.type)) {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`Question ${index + 1}: Choice questions need at least 2 options`);
        }
      }

      if (q.type === 'number') {
        if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
          errors.push(`Question ${index + 1}: Min cannot be greater than max`);
        }
      }
    });

    // Check for duplicate question IDs
    const questionIds = questions.map((q) => q.id);
    const duplicateIds = questionIds.filter((id, index) => questionIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate question IDs found: ${duplicateIds.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new QuoteFormService();
