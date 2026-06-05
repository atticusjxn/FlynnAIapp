/**
 * Business context formatter
 *
 * Turns a business profile row (services, pricing, hours, FAQs, policies, tone)
 * into a compact text block for use in LLM prompts.
 *
 * Extracted from telephony/deepgramVoiceAgent.js so both the parked voice stack
 * and the new text-drafting endpoints can reuse it without importing telephony.
 */

/**
 * Format business hours for display.
 */
const formatBusinessHours = (hours) => {
  if (!hours || typeof hours !== 'object') return '';

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const formatted = [];

  days.forEach((day) => {
    const dayHours = hours[day];
    if (!dayHours) return;

    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    if (dayHours.closed) {
      formatted.push(`${capitalize(day)}: Closed`);
    } else if (dayHours.open && dayHours.close) {
      formatted.push(`${capitalize(day)}: ${dayHours.open} - ${dayHours.close}`);
    }
  });

  return formatted.join('\n');
};

/**
 * Format business context data for AI prompt.
 */
const formatBusinessContext = (contextData) => {
  if (!contextData) return '';

  const sections = [];

  // Business name and type
  if (contextData.business_name) {
    sections.push(`Business: ${contextData.business_name}`);
  }
  if (contextData.business_type) {
    sections.push(`Type: ${contextData.business_type}`);
  }

  // Services
  if (contextData.services && Array.isArray(contextData.services) && contextData.services.length > 0) {
    const servicesList = contextData.services
      .map((s) => {
        let line = `- ${s.name}`;
        if (s.description) line += `: ${s.description}`;
        if (s.price_range) line += ` (${s.price_range})`;
        return line;
      })
      .join('\n');
    sections.push(`Services offered:\n${servicesList}`);
  }

  // Pricing
  if (contextData.pricing_notes) {
    sections.push(`Pricing: ${contextData.pricing_notes}`);
  }

  // Business hours
  if (contextData.business_hours) {
    const hoursText = formatBusinessHours(contextData.business_hours);
    if (hoursText) {
      sections.push(`Business hours:\n${hoursText}`);
    }
  }

  // Location
  if (contextData.service_area) {
    sections.push(`Service area: ${contextData.service_area}`);
  } else if (contextData.city && contextData.state) {
    sections.push(`Location: ${contextData.city}, ${contextData.state}`);
  }

  // Policies
  if (contextData.cancellation_policy) {
    sections.push(`Cancellation policy: ${contextData.cancellation_policy}`);
  }
  if (contextData.payment_terms) {
    sections.push(`Payment terms: ${contextData.payment_terms}`);
  }
  if (contextData.booking_notice) {
    sections.push(`Booking notice: ${contextData.booking_notice}`);
  }

  // FAQs
  if (Array.isArray(contextData.faqs) && contextData.faqs.length > 0) {
    const faqText = contextData.faqs
      .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n');
    sections.push(`Common questions and answers:\n${faqText}`);
  }

  // Brand voice / tone
  if (contextData.receptionist_business_profile?.brand_voice) {
    const bv = contextData.receptionist_business_profile.brand_voice;
    const voiceParts = [];
    if (bv.tone) voiceParts.push(bv.tone);
    if (bv.formality) voiceParts.push(bv.formality);
    if (bv.personality) voiceParts.push(`personality: ${bv.personality}`);
    if (voiceParts.length) sections.push(`Brand voice: ${voiceParts.join(', ')}.`);
  }

  // Custom AI instructions
  if (contextData.ai_instructions) {
    sections.push(`Special instructions: ${contextData.ai_instructions}`);
  }

  return sections.length > 0
    ? `Business Profile:\n${sections.join('\n')}`
    : '';
};

module.exports = {
  formatBusinessContext,
  formatBusinessHours,
};
