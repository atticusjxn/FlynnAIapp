/**
 * Anthropic Claude Haiku 4.5 — generates a per-target Instagram DM for a trade business.
 *
 * The system prompt is sent with ephemeral cache_control so a 20-target run
 * (well under the 5-min cache TTL) only pays full-rate input tokens once.
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You write short, friendly Instagram DMs from Atticus, founder of Flynn AI — an AI receptionist for Australian tradies that answers missed calls and texts back booking links so they never lose a lead.

The recipient is a trade business in Australia. Write a 2-3 sentence opener (max 60 words) that:
1. References something specific from their bio or trade.
2. Names the pain point (missed calls = lost jobs).
3. Ends with a soft ask to try Flynn free for a month.

Rules:
- No emojis.
- No "I hope this finds you well" or any opener clichés.
- Plain text only — no markdown, no bullet points, no quotes.
- Don't sign off; the user adds their name manually.
- Don't include "Hi @handle" — just open with their first/business name or trade reference.
- Output ONLY the message body. No preamble, no explanation.`;

export interface TradeIGDMInput {
  businessName: string;
  trade: string;
  city: string;
  bio: string;
  handle: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing env ANTHROPIC_API_KEY');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function generateTradeIGDM(input: TradeIGDMInput): Promise<{ message: string; model: string }> {
  const userPayload = [
    `Business name: ${input.businessName || '(unknown)'}`,
    `Trade: ${input.trade || '(unknown)'}`,
    `City: ${input.city || '(unknown)'}`,
    `Handle: @${input.handle.replace(/^@/, '')}`,
    `Bio: ${input.bio || '(no bio)'}`,
  ].join('\n');

  const res = await getClient().messages.create({
    model: MODEL,
    max_tokens: 220,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPayload }],
  });

  const block = res.content.find((b) => b.type === 'text');
  const text = block && block.type === 'text' ? block.text.trim() : '';
  return { message: text, model: MODEL };
}
