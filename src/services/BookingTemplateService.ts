// Booking Template Service
// Manages booking form templates

import { supabase } from './supabase';

export interface BookingFormTemplate {
  id: string;
  name: string;
  industry: string;
  description: string;
  icon: string;
  custom_fields: any[];
  recommended_duration_minutes: number;
  recommended_buffer_minutes: number;
  display_order: number;
}

class BookingTemplateService {
  /**
   * Get all active booking form templates
   */
  async getAllTemplates(): Promise<BookingFormTemplate[]> {
    const { data, error } = await supabase
      .from('booking_form_templates')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<BookingFormTemplate | null> {
    const { data, error } = await supabase
      .from('booking_form_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  /**
   * Get templates by industry
   */
  async getTemplatesByIndustry(industry: string): Promise<BookingFormTemplate[]> {
    const { data, error } = await supabase
      .from('booking_form_templates')
      .select('*')
      .eq('industry', industry)
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;

    return data || [];
  }

  /**
   * Search templates by name or industry
   */
  async searchTemplates(query: string): Promise<BookingFormTemplate[]> {
    const { data, error } = await supabase
      .from('booking_form_templates')
      .select('*')
      .or(`name.ilike.%${query}%,industry.ilike.%${query}%`)
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;

    return data || [];
  }
}

export default new BookingTemplateService();
