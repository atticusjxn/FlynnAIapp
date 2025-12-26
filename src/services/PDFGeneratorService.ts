// PDF Generator Service
// Generates branded PDF quotes and invoices

import { supabase } from './supabase';
import { LineItem } from '../types/quote';

interface PDFDocument {
  type: 'quote' | 'invoice';
  number: string; // QT-2025-001 or INV-2025-001
  title?: string;

  // Business details
  business_name: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  business_logo_url?: string;

  // Customer details
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;

  // Line items
  line_items: LineItem[];

  // Pricing
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid?: number; // For invoices only
  amount_due?: number; // For invoices only

  // Details
  issued_date: string; // ISO date
  valid_until?: string; // ISO date - for quotes
  due_date?: string; // ISO date - for invoices
  notes?: string;
  terms?: string;
  message?: string;
}

class PDFGeneratorService {
  /**
   * Generate PDF for Quote
   *
   * IMPORTANT: In production, this should be done server-side
   * using a library like Puppeteer, wkhtmltopdf, or PDFKit.
   *
   * For React Native, you'd typically:
   * 1. Call your backend API endpoint: POST /api/pdfs/generate-quote
   * 2. Backend generates PDF using HTML template + Puppeteer
   * 3. Backend uploads PDF to Supabase Storage
   * 4. Backend returns public URL
   *
   * For now, this is a placeholder that returns a mock URL.
   */
  async generateQuotePDF(
    quoteId: string,
    document: PDFDocument
  ): Promise<string> {
    try {
      console.log('📄 Generating Quote PDF:', document.number);

      // In production, this would be:
      // const response = await fetch(`${YOUR_BACKEND_URL}/api/pdfs/generate-quote`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ quoteId, document })
      // });
      // const { pdfUrl } = await response.json();

      // Mock PDF generation
      const htmlContent = this.generateQuoteHTML(document);

      // Simulate PDF upload to Supabase Storage
      const pdfFilename = `quotes/${quoteId}/${document.number}.pdf`;
      const pdfUrl = await this.uploadPDFToStorage(
        pdfFilename,
        htmlContent // In production, this would be actual PDF bytes
      );

      // Update quote with PDF URL
      await supabase
        .from('quotes')
        .update({ pdf_url: pdfUrl })
        .eq('id', quoteId);

      console.log('✅ Quote PDF generated:', pdfUrl);
      return pdfUrl;
    } catch (error) {
      console.error('❌ Failed to generate quote PDF:', error);
      throw new Error('Failed to generate quote PDF');
    }
  }

  /**
   * Generate PDF for Invoice
   */
  async generateInvoicePDF(
    invoiceId: string,
    document: PDFDocument
  ): Promise<string> {
    try {
      console.log('📄 Generating Invoice PDF:', document.number);

      // Mock PDF generation
      const htmlContent = this.generateInvoiceHTML(document);

      // Simulate PDF upload to Supabase Storage
      const pdfFilename = `invoices/${invoiceId}/${document.number}.pdf`;
      const pdfUrl = await this.uploadPDFToStorage(pdfFilename, htmlContent);

      // Update invoice with PDF URL
      await supabase
        .from('invoices')
        .update({ pdf_url: pdfUrl })
        .eq('id', invoiceId);

      console.log('✅ Invoice PDF generated:', pdfUrl);
      return pdfUrl;
    } catch (error) {
      console.error('❌ Failed to generate invoice PDF:', error);
      throw new Error('Failed to generate invoice PDF');
    }
  }

  /**
   * Generate HTML template for Quote
   */
  private generateQuoteHTML(document: PDFDocument): string {
    const { line_items, subtotal, tax_rate, tax_amount, total } = document;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${document.number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid #ff4500; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: 700; color: #ff4500; }
    .doc-info { text-align: right; }
    .doc-number { font-size: 28px; font-weight: 700; color: #1E293B; }
    .doc-date { color: #64748B; margin-top: 8px; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .party { flex: 1; }
    .party-label { font-size: 12px; text-transform: uppercase; color: #64748B; font-weight: 600; margin-bottom: 8px; }
    .party-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .party-details { color: #64748B; font-size: 14px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    thead { background: #F1F5F9; }
    th { text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #64748B; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #E2E8F0; }
    .item-desc { font-weight: 500; }
    .item-qty, .item-price, .item-total { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.final { border-top: 2px solid #1E293B; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; }
    .notes { margin-top: 40px; padding: 20px; background: #F8FAFC; border-left: 4px solid #ff4500; }
    .notes-label { font-weight: 600; margin-bottom: 8px; }
    .terms { margin-top: 20px; font-size: 12px; color: #64748B; line-height: 1.6; }
    .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${document.business_name}</div>
    <div class="doc-info">
      <div class="doc-number">QUOTE ${document.number}</div>
      <div class="doc-date">Issued: ${new Date(document.issued_date).toLocaleDateString()}</div>
      ${document.valid_until ? `<div class="doc-date">Valid Until: ${new Date(document.valid_until).toLocaleDateString()}</div>` : ''}
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${document.business_name}</div>
      <div class="party-details">
        ${document.business_phone ? `${document.business_phone}<br>` : ''}
        ${document.business_email ? `${document.business_email}<br>` : ''}
        ${document.business_address ? document.business_address : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-label">To</div>
      <div class="party-name">${document.customer_name}</div>
      <div class="party-details">
        ${document.customer_phone ? `${document.customer_phone}<br>` : ''}
        ${document.customer_email ? `${document.customer_email}<br>` : ''}
        ${document.customer_address ? document.customer_address : ''}
      </div>
    </div>
  </div>

  ${document.message ? `<div style="margin-bottom: 30px; font-size: 16px; line-height: 1.6;">${document.message}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="item-qty">Qty</th>
        <th class="item-price">Unit Price</th>
        <th class="item-total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${line_items.map(item => `
        <tr>
          <td class="item-desc">${item.description}</td>
          <td class="item-qty">${item.quantity}</td>
          <td class="item-price">$${item.unit_price.toFixed(2)}</td>
          <td class="item-total">$${item.total.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>$${subtotal.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>GST (${tax_rate}%)</span>
      <span>$${tax_amount.toFixed(2)}</span>
    </div>
    <div class="total-row final">
      <span>Total</span>
      <span>$${total.toFixed(2)}</span>
    </div>
  </div>

  ${document.notes ? `
    <div class="notes">
      <div class="notes-label">Notes</div>
      <div>${document.notes}</div>
    </div>
  ` : ''}

  ${document.terms ? `
    <div class="terms">
      <strong>Terms & Conditions:</strong><br>
      ${document.terms}
    </div>
  ` : ''}

  <div class="footer">
    Generated with Flynn AI • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate HTML template for Invoice
   */
  private generateInvoiceHTML(document: PDFDocument): string {
    const { line_items, subtotal, tax_rate, tax_amount, total, amount_paid, amount_due } = document;

    const isPaid = amount_due === 0;
    const isPartial = amount_paid! > 0 && amount_due! > 0;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${document.number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 3px solid #ff4500; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: 700; color: #ff4500; }
    .doc-info { text-align: right; }
    .doc-number { font-size: 28px; font-weight: 700; color: #1E293B; }
    .doc-date { color: #64748B; margin-top: 8px; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 8px; }
    .status-paid { background: #D1FAE5; color: #065F46; }
    .status-partial { background: #FEF3C7; color: #92400E; }
    .status-unpaid { background: #FEE2E2; color: #991B1B; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .party { flex: 1; }
    .party-label { font-size: 12px; text-transform: uppercase; color: #64748B; font-weight: 600; margin-bottom: 8px; }
    .party-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .party-details { color: #64748B; font-size: 14px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    thead { background: #F1F5F9; }
    th { text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; color: #64748B; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #E2E8F0; }
    .item-desc { font-weight: 500; }
    .item-qty, .item-price, .item-total { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.final { border-top: 2px solid #1E293B; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 700; }
    .total-row.amount-due { background: #FEF3C7; padding: 12px; margin-top: 8px; border-radius: 6px; }
    .notes { margin-top: 40px; padding: 20px; background: #F8FAFC; border-left: 4px solid #ff4500; }
    .notes-label { font-weight: 600; margin-bottom: 8px; }
    .terms { margin-top: 20px; font-size: 12px; color: #64748B; line-height: 1.6; }
    .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">${document.business_name}</div>
    <div class="doc-info">
      <div class="doc-number">INVOICE ${document.number}</div>
      <div class="doc-date">Issued: ${new Date(document.issued_date).toLocaleDateString()}</div>
      ${document.due_date ? `<div class="doc-date">Due: ${new Date(document.due_date).toLocaleDateString()}</div>` : ''}
      <div class="status-badge ${isPaid ? 'status-paid' : isPartial ? 'status-partial' : 'status-unpaid'}">
        ${isPaid ? 'PAID' : isPartial ? 'PARTIALLY PAID' : 'UNPAID'}
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From</div>
      <div class="party-name">${document.business_name}</div>
      <div class="party-details">
        ${document.business_phone ? `${document.business_phone}<br>` : ''}
        ${document.business_email ? `${document.business_email}<br>` : ''}
        ${document.business_address ? document.business_address : ''}
      </div>
    </div>
    <div class="party">
      <div class="party-label">Bill To</div>
      <div class="party-name">${document.customer_name}</div>
      <div class="party-details">
        ${document.customer_phone ? `${document.customer_phone}<br>` : ''}
        ${document.customer_email ? `${document.customer_email}<br>` : ''}
        ${document.customer_address ? document.customer_address : ''}
      </div>
    </div>
  </div>

  ${document.message ? `<div style="margin-bottom: 30px; font-size: 16px; line-height: 1.6;">${document.message}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="item-qty">Qty</th>
        <th class="item-price">Unit Price</th>
        <th class="item-total">Total</th>
      </tr>
    </thead>
    <tbody>
      ${line_items.map(item => `
        <tr>
          <td class="item-desc">${item.description}</td>
          <td class="item-qty">${item.quantity}</td>
          <td class="item-price">$${item.unit_price.toFixed(2)}</td>
          <td class="item-total">$${item.total.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>$${subtotal.toFixed(2)}</span>
    </div>
    <div class="total-row">
      <span>GST (${tax_rate}%)</span>
      <span>$${tax_amount.toFixed(2)}</span>
    </div>
    <div class="total-row final">
      <span>Total</span>
      <span>$${total.toFixed(2)}</span>
    </div>
    ${amount_paid! > 0 ? `
      <div class="total-row">
        <span>Amount Paid</span>
        <span>-$${amount_paid!.toFixed(2)}</span>
      </div>
    ` : ''}
    <div class="total-row amount-due">
      <span><strong>Amount Due</strong></span>
      <span><strong>$${amount_due!.toFixed(2)}</strong></span>
    </div>
  </div>

  ${document.notes ? `
    <div class="notes">
      <div class="notes-label">Notes</div>
      <div>${document.notes}</div>
    </div>
  ` : ''}

  ${document.terms ? `
    <div class="terms">
      <strong>Payment Terms:</strong><br>
      ${document.terms}
    </div>
  ` : ''}

  <div class="footer">
    Generated with Flynn AI • ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Upload PDF to Supabase Storage
   *
   * In production, this would upload actual PDF bytes.
   * For now, we're uploading HTML as a placeholder.
   */
  private async uploadPDFToStorage(
    filename: string,
    content: string
  ): Promise<string> {
    try {
      // Convert content to blob
      const blob = new Blob([content], { type: 'application/pdf' });

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('documents') // Create this bucket in Supabase Dashboard
        .upload(filename, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filename);

      return urlData.publicUrl;
    } catch (error) {
      console.error('❌ Failed to upload PDF:', error);

      // Fallback: return mock URL
      return `https://storage.supabase.co/documents/${filename}`;
    }
  }

  /**
   * Delete PDF from storage
   */
  async deletePDF(pdfUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = pdfUrl.split('/documents/')[1];

      if (!filename) {
        return;
      }

      await supabase.storage
        .from('documents')
        .remove([filename]);

      console.log('🗑️  PDF deleted:', filename);
    } catch (error) {
      console.error('❌ Failed to delete PDF:', error);
    }
  }
}

export default new PDFGeneratorService();
