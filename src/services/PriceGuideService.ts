/**
 * Price Guide Service
 *
 * Implements the rules-based pricing estimation engine.
 * Evaluates form answers against configured rules to calculate price estimates.
 */

import { supabase } from './supabase';
import type {
  PriceGuide,
  CreatePriceGuideRequest,
  UpdatePriceGuideRequest,
  PriceRule,
  PriceRuleCondition,
  PriceEstimate,
  AppliedRule,
} from '../types/quoteLinks';

class PriceGuideService {
  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Get price guide for a form
   */
  async getPriceGuide(formId: string): Promise<PriceGuide | null> {
    const { data, error } = await supabase
      .from('price_guides')
      .select('*')
      .eq('form_id', formId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching price guide:', error);
    }

    return data || null;
  }

  /**
   * Get price guide by ID
   */
  async getPriceGuideById(priceGuideId: string): Promise<PriceGuide | null> {
    const { data, error } = await supabase
      .from('price_guides')
      .select('*')
      .eq('id', priceGuideId)
      .single();

    if (error) {
      console.error('Error fetching price guide by ID:', error);
      return null;
    }

    return data;
  }

  /**
   * Create a new price guide
   */
  async createPriceGuide(request: CreatePriceGuideRequest): Promise<PriceGuide> {
    const priceGuideData = {
      form_id: request.form_id,
      org_id: request.org_id,
      estimate_mode: request.estimate_mode || 'internal',
      show_to_customer: request.show_to_customer || false,
      base_price: request.base_price || null,
      base_callout_fee: request.base_callout_fee || null,
      currency: request.currency || 'AUD',
      rules: request.rules || [],
      min_price: request.min_price || null,
      max_price: request.max_price || null,
      disclaimer:
        request.disclaimer ||
        'This is an estimate only based on the information provided. Final price will be confirmed after inspection.',
      internal_notes: request.internal_notes || null,
      version: 1,
      is_active: true,
    };

    const { data, error } = await supabase
      .from('price_guides')
      .insert(priceGuideData)
      .select()
      .single();

    if (error) {
      console.error('Error creating price guide:', error);
      throw new Error('Failed to create price guide');
    }

    return data;
  }

  /**
   * Update a price guide
   */
  async updatePriceGuide(priceGuideId: string, updates: UpdatePriceGuideRequest): Promise<PriceGuide> {
    const { data, error } = await supabase
      .from('price_guides')
      .update(updates)
      .eq('id', priceGuideId)
      .select()
      .single();

    if (error) {
      console.error('Error updating price guide:', error);
      throw new Error('Failed to update price guide');
    }

    return data;
  }

  /**
   * Delete a price guide (soft delete by setting is_active = false)
   */
  async deletePriceGuide(priceGuideId: string): Promise<void> {
    const { error } = await supabase
      .from('price_guides')
      .update({ is_active: false })
      .eq('id', priceGuideId);

    if (error) {
      console.error('Error deleting price guide:', error);
      throw new Error('Failed to delete price guide');
    }
  }

  // ============================================================================
  // Rules Engine
  // ============================================================================

  /**
   * Calculate price estimate from answers
   */
  calculateEstimate(
    answers: Record<string, any>,
    priceGuide: PriceGuide
  ): PriceEstimate {
    let min = priceGuide.base_price || 0;
    let max = priceGuide.base_price || 0;

    // Add base callout fee if set
    if (priceGuide.base_callout_fee) {
      min += priceGuide.base_callout_fee;
      max += priceGuide.base_callout_fee;
    }

    const appliedRules: AppliedRule[] = [];

    // Sort rules by execution order
    const sortedRules = [...priceGuide.rules]
      .filter((rule) => rule.enabled)
      .sort((a, b) => a.order - b.order);

    // Evaluate each rule
    for (const rule of sortedRules) {
      const answer = answers[rule.condition.questionId];

      if (this.evaluateCondition(answer, rule.condition)) {
        const { newMin, newMax } = this.applyRuleAction(min, max, rule);
        min = newMin;
        max = newMax;

        appliedRules.push({
          ruleName: rule.name,
          adjustment: rule.action.value,
          note: rule.action.note,
        });
      }
    }

    // Apply min/max constraints
    if (priceGuide.min_price !== null) {
      min = Math.max(min, priceGuide.min_price);
      max = Math.max(max, priceGuide.min_price);
    }

    if (priceGuide.max_price !== null) {
      min = Math.min(min, priceGuide.max_price);
      max = Math.min(max, priceGuide.max_price);
    }

    // Ensure min <= max
    if (min > max) {
      max = min;
    }

    return {
      min,
      max,
      appliedRules,
      mode: priceGuide.estimate_mode,
      disclaimer: priceGuide.disclaimer,
      showToCustomer: priceGuide.show_to_customer,
    };
  }

  /**
   * Evaluate a rule condition against an answer
   */
  private evaluateCondition(answer: any, condition: PriceRuleCondition): boolean {
    const { operator, value } = condition;

    if (answer === null || answer === undefined) {
      return false;
    }

    switch (operator) {
      case 'equals':
        if (typeof answer === 'boolean') {
          return answer === value;
        }
        return String(answer) === String(value);

      case 'contains':
        if (Array.isArray(answer)) {
          return answer.includes(value);
        }
        return String(answer).toLowerCase().includes(String(value).toLowerCase());

      case 'greater_than':
        return Number(answer) > Number(value);

      case 'less_than':
        return Number(answer) < Number(value);

      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          const numAnswer = Number(answer);
          return numAnswer >= Number(value[0]) && numAnswer <= Number(value[1]);
        }
        return false;

      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Apply a rule action to current min/max prices
   */
  private applyRuleAction(
    currentMin: number,
    currentMax: number,
    rule: PriceRule
  ): { newMin: number; newMax: number } {
    const { action } = rule;

    switch (action.type) {
      case 'add':
        return {
          newMin: currentMin + Number(action.value),
          newMax: currentMax + Number(action.value),
        };

      case 'multiply':
        return {
          newMin: currentMin * Number(action.value),
          newMax: currentMax * Number(action.value),
        };

      case 'set_band':
        if (typeof action.value === 'object' && 'min' in action.value && 'max' in action.value) {
          return {
            newMin: action.value.min,
            newMax: action.value.max,
          };
        }
        // If single value, set both min and max
        return {
          newMin: Number(action.value),
          newMax: Number(action.value),
        };

      default:
        console.warn(`Unknown action type: ${action.type}`);
        return { newMin: currentMin, newMax: currentMax };
    }
  }

  /**
   * Format estimate for display to customer
   */
  formatEstimateForCustomer(estimate: PriceEstimate, currency = 'AUD'): string {
    const symbol = this.getCurrencySymbol(currency);

    if (estimate.mode === 'disabled' || !estimate.showToCustomer) {
      return '';
    }

    const minFormatted = this.formatCurrency(estimate.min, symbol);
    const maxFormatted = this.formatCurrency(estimate.max, symbol);

    switch (estimate.mode) {
      case 'range':
        if (estimate.min === estimate.max) {
          return `Estimated: ${minFormatted}`;
        }
        return `Estimated range: ${minFormatted} – ${maxFormatted}`;

      case 'starting_from':
        return `Starting from ${minFormatted}`;

      case 'internal':
      default:
        return '';
    }
  }

  /**
   * Format estimate for internal display
   */
  formatEstimateForInternal(estimate: PriceEstimate, currency = 'AUD'): string {
    const symbol = this.getCurrencySymbol(currency);
    const minFormatted = this.formatCurrency(estimate.min, symbol);
    const maxFormatted = this.formatCurrency(estimate.max, symbol);

    if (estimate.min === estimate.max) {
      return `${minFormatted}`;
    }

    return `${minFormatted} – ${maxFormatted}`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get currency symbol
   */
  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      AUD: '$',
      USD: '$',
      GBP: '£',
      EUR: '€',
      NZD: '$',
    };
    return symbols[currency] || currency;
  }

  /**
   * Format currency value
   */
  private formatCurrency(value: number, symbol: string): string {
    return `${symbol}${Math.round(value).toLocaleString()}`;
  }

  /**
   * Validate rules configuration
   */
  validateRules(rules: PriceRule[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(rules)) {
      errors.push('Rules must be an array');
      return { valid: false, errors };
    }

    rules.forEach((rule, index) => {
      if (!rule.id) {
        errors.push(`Rule ${index + 1}: Missing ID`);
      }
      if (!rule.name || rule.name.trim() === '') {
        errors.push(`Rule ${index + 1}: Name is required`);
      }
      if (typeof rule.enabled !== 'boolean') {
        errors.push(`Rule ${index + 1}: 'enabled' must be true or false`);
      }
      if (!rule.condition || !rule.condition.questionId) {
        errors.push(`Rule ${index + 1}: Condition must reference a question`);
      }
      if (!rule.condition.operator) {
        errors.push(`Rule ${index + 1}: Condition must have an operator`);
      }
      if (rule.condition.value === undefined || rule.condition.value === null) {
        errors.push(`Rule ${index + 1}: Condition must have a value`);
      }
      if (!rule.action || !rule.action.type) {
        errors.push(`Rule ${index + 1}: Action type is required`);
      }
      if (rule.action.value === undefined || rule.action.value === null) {
        errors.push(`Rule ${index + 1}: Action value is required`);
      }
      if (typeof rule.order !== 'number') {
        errors.push(`Rule ${index + 1}: Order must be a number`);
      }
    });

    // Check for duplicate rule IDs
    const ruleIds = rules.map((r) => r.id);
    const duplicateIds = ruleIds.filter((id, index) => ruleIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate rule IDs found: ${duplicateIds.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test rules with sample answers
   */
  testRules(
    rules: PriceRule[],
    sampleAnswers: Record<string, any>,
    basePrice: number = 0,
    baseCalloutFee: number = 0
  ): PriceEstimate {
    const mockPriceGuide: PriceGuide = {
      id: 'test',
      form_id: 'test',
      org_id: 'test',
      estimate_mode: 'range',
      show_to_customer: true,
      base_price: basePrice,
      base_callout_fee: baseCalloutFee,
      currency: 'AUD',
      rules,
      min_price: null,
      max_price: null,
      disclaimer: 'Test estimate',
      internal_notes: null,
      version: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return this.calculateEstimate(sampleAnswers, mockPriceGuide);
  }

  /**
   * Generate suggested rules from template
   */
  generateSuggestedRules(templateRules: any[], questions: any[]): PriceRule[] {
    if (!Array.isArray(templateRules)) {
      return [];
    }

    // Filter out rules that reference non-existent questions
    const questionIds = new Set(questions.map((q) => q.id));

    return templateRules
      .filter((rule) => questionIds.has(rule.condition?.questionId))
      .map((rule, index) => ({
        ...rule,
        order: index + 1,
      }));
  }

  /**
   * Get confidence level for estimate
   */
  getEstimateConfidence(estimate: PriceEstimate, totalQuestions: number): 'high' | 'medium' | 'low' {
    const rulesApplied = estimate.appliedRules.length;
    const questionsUsed = rulesApplied;

    // High confidence: Most questions answered and used in rules
    if (questionsUsed >= totalQuestions * 0.7) {
      return 'high';
    }

    // Medium confidence: Some questions used
    if (questionsUsed >= totalQuestions * 0.3) {
      return 'medium';
    }

    // Low confidence: Few questions used or no rules applied
    return 'low';
  }
}

export default new PriceGuideService();
