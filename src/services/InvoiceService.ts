// Invoice Service
// CRUD operations and business logic for invoices

import { supabase } from './supabase';
import StripePaymentService from './StripePaymentService';
import PDFGeneratorService from './PDFGeneratorService';
import TwilioService from './TwilioService';
import {
  Invoice,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  SendInvoiceRequest,
  RecordPaymentRequest,
  InvoiceCalculation,
  LineItem,
  PaymentEvent,
  PAYMENT_TERMS,
} from '../types/invoice';

class InvoiceService {
  /**
   * Calculate invoice totals
   */
  calculateTotals(lineItems: LineItem[], taxRate: number = 10.0, amountPaid: number = 0): InvoiceCalculation {
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const tax_amount = subtotal * (taxRate / 100);
    const total = subtotal + tax_amount;
    const amount_due = total - amountPaid;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_amount: parseFloat(tax_amount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      amount_paid: parseFloat(amountPaid.toFixed(2)),
      amount_due: parseFloat(amount_due.toFixed(2)),
    };
  }

  /**
   * Calculate due date based on payment terms
   */
  calculateDueDate(paymentTerm: string): string {
    const today = new Date();
    let daysToAdd = 0;

    switch (paymentTerm) {
      case PAYMENT_TERMS.DUE_ON_RECEIPT:
        daysToAdd = 0;
        break;
      case PAYMENT_TERMS.NET_7:
        daysToAdd = 7;
        break;
      case PAYMENT_TERMS.NET_14:
        daysToAdd = 14;
        break;
      case PAYMENT_TERMS.NET_30:
        daysToAdd = 30;
        break;
      case PAYMENT_TERMS.NET_60:
        daysToAdd = 60;
        break;
      default:
        daysToAdd = 30;
    }

    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    return dueDate.toISOString().split('T')[0]; // Return YYYY-MM-DD
  }

  /**
   * Create a new invoice
   */
  async createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    try {
      // Generate invoice number
      const { data: invoiceNumberData, error: invoiceNumberError } = await supabase
        .rpc('generate_invoice_number', { p_org_id: request.org_id });

      if (invoiceNumberError) {
        throw invoiceNumberError;
      }

      const invoice_number = invoiceNumberData as string;

      // Calculate totals
      const taxRate = request.tax_rate || 10.0;
      const { subtotal, tax_amount, total, amount_paid, amount_due } =
        this.calculateTotals(request.line_items, taxRate, 0);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Calculate due date if not provided
      const due_date = request.due_date || this.calculateDueDate(request.terms || PAYMENT_TERMS.NET_30);

      // Insert invoice
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          org_id: request.org_id,
          job_id: request.job_id,
          client_id: request.client_id,
          event_id: request.event_id,
          quote_id: request.quote_id,
          invoice_number,
          title: request.title,
          line_items: request.line_items,
          subtotal,
          tax_rate: taxRate,
          tax_amount,
          total,
          amount_paid,
          amount_due,
          notes: request.notes,
          terms: request.terms || PAYMENT_TERMS.NET_30,
          due_date,
          message: request.message,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Invoice created:', data.invoice_number);
      return data as Invoice;
    } catch (error) {
      console.error('❌ Failed to create invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) {
        throw error;
      }

      return data as Invoice;
    } catch (error) {
      console.error('❌ Failed to get invoice:', error);
      return null;
    }
  }

  /**
   * Get all invoices for an organization
   */
  async getInvoices(orgId: string, filters?: {
    status?: string;
    clientId?: string;
    jobId?: string;
  }): Promise<Invoice[]> {
    try {
      let query = supabase
        .from('invoices')
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

      return data as Invoice[];
    } catch (error) {
      console.error('❌ Failed to get invoices:', error);
      return [];
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(invoiceId: string, updates: UpdateInvoiceRequest): Promise<Invoice> {
    try {
      // Recalculate totals if line items changed
      let calculatedFields = {};
      if (updates.line_items) {
        const invoice = await this.getInvoice(invoiceId);
        const taxRate = updates.tax_rate || invoice?.tax_rate || 10.0;
        const amountPaid = invoice?.amount_paid || 0;
        const { subtotal, tax_amount, total, amount_due } =
          this.calculateTotals(updates.line_items, taxRate, amountPaid);
        calculatedFields = { subtotal, tax_amount, total, amount_due };
      }

      const { data, error } = await supabase
        .from('invoices')
        .update({
          ...updates,
          ...calculatedFields,
        })
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log('✅ Invoice updated:', data.invoice_number);
      return data as Invoice;
    } catch (error) {
      console.error('❌ Failed to update invoice:', error);
      throw error;
    }
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(invoiceId: string): Promise<void> {
    try {
      // Get invoice to delete PDF if exists
      const invoice = await this.getInvoice(invoiceId);

      // Delete invoice
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) {
        throw error;
      }

      // Delete PDF if exists
      if (invoice?.pdf_url) {
        await PDFGeneratorService.deletePDF(invoice.pdf_url);
      }

      console.log('✅ Invoice deleted');
    } catch (error) {
      console.error('❌ Failed to delete invoice:', error);
      throw error;
    }
  }

  /**
   * Send invoice to customer
   */
  async sendInvoice(request: SendInvoiceRequest): Promise<void> {
    try {
      const invoice = await this.getInvoice(request.invoice_id);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Generate payment link if requested
      if (request.generate_payment_link !== false) {
        await StripePaymentService.createInvoicePaymentLink(invoice.id, {
          total: invoice.total,
          title: invoice.title,
          org_id: invoice.org_id,
          line_items: invoice.line_items,
        });

        // Refresh invoice to get payment link URL
        const updatedInvoice = await this.getInvoice(invoice.id);
        if (updatedInvoice) {
          invoice.stripe_payment_link_url = updatedInvoice.stripe_payment_link_url;
        }
      }

      // Generate PDF if requested
      if (request.generate_pdf !== false) {
        // Get business info
        const { data: orgData } = await supabase
          .from('organizations')
          .select('display_name')
          .eq('id', invoice.org_id)
          .single();

        await PDFGeneratorService.generateInvoicePDF(invoice.id, {
          type: 'invoice',
          number: invoice.invoice_number,
          title: invoice.title,
          business_name: orgData?.display_name || 'Flynn AI',
          customer_name: 'Customer', // You'd get this from client_id
          line_items: invoice.line_items,
          subtotal: invoice.subtotal,
          tax_rate: invoice.tax_rate,
          tax_amount: invoice.tax_amount,
          total: invoice.total,
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
          issued_date: invoice.issued_date,
          due_date: invoice.due_date,
          notes: invoice.notes,
          terms: invoice.terms,
          message: invoice.message,
        });
      }

      // Compose SMS message
      const message = `${invoice.title || 'Invoice'} ${invoice.invoice_number}\n\n` +
        `Amount Due: $${invoice.amount_due.toFixed(2)}\n` +
        (invoice.due_date ? `Due: ${new Date(invoice.due_date).toLocaleDateString()}\n` : '') +
        (invoice.message ? `\n${invoice.message}\n` : '') +
        (invoice.stripe_payment_link_url ? `\n\nPay Now: ${invoice.stripe_payment_link_url}` : '');

      // Send via SMS or email
      if (request.send_via === 'sms') {
        await TwilioService.sendSMS(request.send_to, message);
      } else {
        // TODO: Implement email sending
        console.log('📧 Email sending not yet implemented');
      }

      // Update invoice status
      await supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          sent_to: request.send_to,
        })
        .eq('id', invoice.id);

      console.log('✅ Invoice sent to:', request.send_to);
    } catch (error) {
      console.error('❌ Failed to send invoice:', error);
      throw error;
    }
  }

  /**
   * Record manual payment (cash, check, bank transfer)
   */
  async recordPayment(request: RecordPaymentRequest): Promise<void> {
    try {
      const invoice = await this.getInvoice(request.invoice_id);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Insert payment event
      await supabase.from('payment_events').insert({
        org_id: invoice.org_id,
        invoice_id: invoice.id,
        amount: request.amount,
        payment_method: request.payment_method,
        status: 'succeeded',
        metadata: { notes: request.notes },
      });

      // The update_invoice_status_from_payments() trigger will automatically
      // update the invoice status, amount_paid, and amount_due

      console.log('✅ Payment recorded:', {
        invoice: invoice.invoice_number,
        amount: request.amount,
        method: request.payment_method,
      });
    } catch (error) {
      console.error('❌ Failed to record payment:', error);
      throw error;
    }
  }

  /**
   * Get payment events for an invoice
   */
  async getPaymentEvents(invoiceId: string): Promise<PaymentEvent[]> {
    try {
      const { data, error } = await supabase
        .from('payment_events')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data as PaymentEvent[];
    } catch (error) {
      console.error('❌ Failed to get payment events:', error);
      return [];
    }
  }

  /**
   * Get revenue stats for an organization
   * @param orgId - Organization ID
   * @param daysBack - Number of days to look back (default: 30)
   */
  async getRevenueStats(orgId: string, daysBack: number = 30): Promise<{
    total_revenue: number;
    paid_invoices_count: number;
    pending_amount: number;
    overdue_amount: number;
  }> {
    try {
      // Calculate date range
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      const startDateStr = startDate.toISOString();

      const { data, error } = await supabase
        .from('invoices')
        .select('total, amount_paid, amount_due, status, due_date')
        .eq('org_id', orgId)
        .gte('created_at', startDateStr);

      if (error) {
        throw error;
      }

      const stats = {
        total_revenue: 0,
        paid_invoices_count: 0,
        pending_amount: 0,
        overdue_amount: 0,
      };

      data?.forEach((invoice: any) => {
        // Total revenue = sum of all paid amounts
        stats.total_revenue += invoice.amount_paid;

        // Count fully paid invoices
        if (invoice.status === 'paid') {
          stats.paid_invoices_count += 1;
        }

        // Pending = outstanding amount on non-overdue invoices
        if (invoice.status === 'sent' || invoice.status === 'draft') {
          stats.pending_amount += invoice.amount_due;
        }

        // Overdue = outstanding amount on overdue invoices
        if (invoice.status === 'overdue') {
          stats.overdue_amount += invoice.amount_due;
        }
      });

      return {
        total_revenue: parseFloat(stats.total_revenue.toFixed(2)),
        paid_invoices_count: stats.paid_invoices_count,
        pending_amount: parseFloat(stats.pending_amount.toFixed(2)),
        overdue_amount: parseFloat(stats.overdue_amount.toFixed(2)),
      };
    } catch (error) {
      console.error('❌ Failed to get revenue stats:', error);
      return {
        total_revenue: 0,
        paid_invoices_count: 0,
        pending_amount: 0,
        overdue_amount: 0,
      };
    }
  }

  /**
   * Mark overdue invoices (should be run periodically)
   */
  async markOverdueInvoices(orgId: string): Promise<void> {
    try {
      await supabase.rpc('mark_overdue_invoices');
      console.log('✅ Overdue invoices marked');
    } catch (error) {
      console.error('❌ Failed to mark overdue invoices:', error);
    }
  }
}

export default new InvoiceService();
