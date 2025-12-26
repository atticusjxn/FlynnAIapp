// Quote Service
// CRUD operations and business logic for quotes

import { supabase } from './supabase';
import StripePaymentService from './StripePaymentService';
import PDFGeneratorService from './PDFGeneratorService';
import TwilioService from './TwilioService';
import {
  Quote,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  SendQuoteRequest,
  QuoteCalculation,
  LineItem,
} from '../types/quote';

class QuoteService {
  /**
   * Calculate quote totals
   */
  calculateTotals(lineItems: LineItem[], taxRate: number = 10.0): QuoteCalculation {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const tax_amount = subtotal * (taxRate / 100);
    const total = subtotal + tax_amount;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_amount: parseFloat(tax_amount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    };
  }

  /**
   * Create a new quote
   */
  async createQuote(request: CreateQuoteRequest): Promise<Quote> {
    try {
      // Generate quote number
      const { data: quoteNumberData, error: quoteNumberError } = await supabase
        .rpc('generate_quote_number', { p_org_id: request.org_id });

      if (quoteNumberError) {
        throw quoteNumberError;
      }

      const quote_number = quoteNumberData as string;

      // Calculate totals
      const taxRate = request.tax_rate || 10.0;
      const { subtotal, tax_amount, total } = this.calculateTotals(request.line_items, taxRate);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert quote
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          org_id: request.org_id,
          job_id: request.job_id,
          client_id: request.client_id,
          event_id: request.event_id,
          quote_number,
          title: request.title,
          line_items: request.line_items,
          subtotal,
          tax_rate: taxRate,
          tax_amount,
          total,
          notes: request.notes,
          terms: request.terms,
          valid_until: request.valid_until,
          message: request.message,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Quote created:', data.quote_number);
      return data as Quote;
    } catch (error) {
      console.error('❌ Failed to create quote:', error);
      throw error;
    }
  }

  /**
   * Get quote by ID
   */
  async getQuote(quoteId: string): Promise<Quote | null> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (error) {
        throw error;
      }

      return data as Quote;
    } catch (error) {
      console.error('❌ Failed to get quote:', error);
      return null;
    }
  }

  /**
   * Get all quotes for an organization
   */
  async getQuotes(orgId: string, filters?: {
    status?: string;
    clientId?: string;
    jobId?: string;
  }): Promise<Quote[]> {
    try {
      let query = supabase
        .from('quotes')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.jobId) {
        query = query.eq('job_id', filters.jobId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data as Quote[];
    } catch (error) {
      console.error('❌ Failed to get quotes:', error);
      return [];
    }
  }

  /**
   * Update quote
   */
  async updateQuote(quoteId: string, updates: UpdateQuoteRequest): Promise<Quote> {
    try {
      // Recalculate totals if line items changed
      let calculatedFields = {};
      if (updates.line_items) {
        const taxRate = updates.tax_rate || 10.0;
        const { subtotal, tax_amount, total } = this.calculateTotals(updates.line_items, taxRate);
        calculatedFields = { subtotal, tax_amount, total };
      }

      const { data, error } = await supabase
        .from('quotes')
        .update({
          ...updates,
          ...calculatedFields,
        })
        .eq('id', quoteId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Quote updated:', data.quote_number);
      return data as Quote;
    } catch (error) {
      console.error('❌ Failed to update quote:', error);
      throw error;
    }
  }

  /**
   * Delete quote
   */
  async deleteQuote(quoteId: string): Promise<void> {
    try {
      // Get quote to delete PDF if exists
      const quote = await this.getQuote(quoteId);

      // Delete quote
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) {
        throw error;
      }

      // Delete PDF if exists
      if (quote?.pdf_url) {
        await PDFGeneratorService.deletePDF(quote.pdf_url);
      }

      console.log('✅ Quote deleted');
    } catch (error) {
      console.error('❌ Failed to delete quote:', error);
      throw error;
    }
  }

  /**
   * Send quote to customer
   */
  async sendQuote(request: SendQuoteRequest): Promise<void> {
    try {
      const quote = await this.getQuote(request.quote_id);
      if (!quote) {
        throw new Error('Quote not found');
      }

      // Generate payment link if requested
      if (request.generate_payment_link !== false) {
        await StripePaymentService.createQuotePaymentLink(quote.id, {
          total: quote.total,
          title: quote.title,
          org_id: quote.org_id,
          line_items: quote.line_items,
        });

        // Refresh quote to get payment link URL
        const updatedQuote = await this.getQuote(quote.id);
        if (updatedQuote) {
          quote.stripe_payment_link_url = updatedQuote.stripe_payment_link_url;
        }
      }

      // Generate PDF if requested
      if (request.generate_pdf !== false) {
        // Get business info
        const { data: orgData } = await supabase
          .from('organizations')
          .select('display_name')
          .eq('id', quote.org_id)
          .single();

        await PDFGeneratorService.generateQuotePDF(quote.id, {
          type: 'quote',
          number: quote.quote_number,
          title: quote.title,
          business_name: orgData?.display_name || 'Flynn AI',
          customer_name: 'Customer', // You'd get this from client_id
          line_items: quote.line_items,
          subtotal: quote.subtotal,
          tax_rate: quote.tax_rate,
          tax_amount: quote.tax_amount,
          total: quote.total,
          issued_date: quote.created_at,
          valid_until: quote.valid_until,
          notes: quote.notes,
          terms: quote.terms,
          message: quote.message,
        });
      }

      // Compose SMS message
      const message = `${quote.title || 'Quote'} ${quote.quote_number}\n\n` +
        `Total: $${quote.total.toFixed(2)}\n` +
        (quote.valid_until ? `Valid until: ${new Date(quote.valid_until).toLocaleDateString()}\n` : '') +
        (quote.message ? `\n${quote.message}\n` : '') +
        (quote.stripe_payment_link_url ? `\n\nView & Pay: ${quote.stripe_payment_link_url}` : '');

      // Send via SMS or email
      if (request.send_via === 'sms') {
        await TwilioService.sendSMS(request.send_to, message);
      } else {
        // TODO: Implement email sending
        console.log('📧 Email sending not yet implemented');
      }

      // Update quote status
      await supabase
        .from('quotes')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: request.send_to,
        })
        .eq('id', quote.id);

      console.log('✅ Quote sent to:', request.send_to);
    } catch (error) {
      console.error('❌ Failed to send quote:', error);
      throw error;
    }
  }

  /**
   * Mark quote as accepted
   */
  async acceptQuote(quoteId: string): Promise<void> {
    try {
      await supabase
        .from('quotes')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      console.log('✅ Quote accepted');
    } catch (error) {
      console.error('❌ Failed to accept quote:', error);
      throw error;
    }
  }

  /**
   * Mark quote as declined
   */
  async declineQuote(quoteId: string): Promise<void> {
    try {
      await supabase
        .from('quotes')
        .update({
          status: 'declined',
          declined_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      console.log('✅ Quote declined');
    } catch (error) {
      console.error('❌ Failed to decline quote:', error);
      throw error;
    }
  }

  /**
   * Convert quote to invoice
   */
  async convertToInvoice(quoteId: string, dueDate?: string): Promise<string> {
    try {
      const quote = await this.getQuote(quoteId);
      if (!quote) {
        throw new Error('Quote not found');
      }

      // Import InvoiceService to avoid circular dependency
      const InvoiceService = require('./InvoiceService').default;

      const invoice = await InvoiceService.createInvoice({
        org_id: quote.org_id,
        job_id: quote.job_id,
        client_id: quote.client_id,
        event_id: quote.event_id,
        quote_id: quote.id,
        title: quote.title,
        line_items: quote.line_items,
        tax_rate: quote.tax_rate,
        notes: quote.notes,
        terms: quote.terms,
        due_date: dueDate,
        message: quote.message,
      });

      console.log('✅ Quote converted to invoice:', invoice.invoice_number);
      return invoice.id;
    } catch (error) {
      console.error('❌ Failed to convert quote to invoice:', error);
      throw error;
    }
  }
}

export default new QuoteService();
