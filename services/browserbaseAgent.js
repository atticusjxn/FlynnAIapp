/**
 * Browserbase cloud browser sessions.
 *
 * Creates remote Puppeteer sessions on Browserbase for web automation:
 * Xero invoicing, Reece parts ordering, and generic AI-guided tasks.
 *
 * Each function is responsible for closing the browser when done.
 * Sessions are billed per minute on Browserbase, so always clean up.
 */

const puppeteer = require('puppeteer');
const { getLLMClient } = require('../llmClient');

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
const BROWSERBASE_API_URL = 'https://api.browserbase.com/v1';

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

async function createSession() {
  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID are required');
  }

  const res = await fetch(`${BROWSERBASE_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bb-api-key': BROWSERBASE_API_KEY,
    },
    body: JSON.stringify({ projectId: BROWSERBASE_PROJECT_ID }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Browserbase session create failed (${res.status}): ${text}`);
  }

  const session = await res.json();
  const connectUrl = `wss://connect.browserbase.com?apiKey=${BROWSERBASE_API_KEY}&sessionId=${session.id}`;

  const browser = await puppeteer.connect({
    browserWSEndpoint: connectUrl,
    defaultViewport: { width: 1280, height: 900 },
  });

  const [page] = await browser.pages();

  console.log('[Browserbase] Session created:', session.id);
  return { sessionId: session.id, browser, page };
}

async function closeSession(browser, sessionId) {
  try {
    await browser.close();
    console.log('[Browserbase] Session closed:', sessionId);
  } catch (err) {
    console.warn('[Browserbase] Error closing session:', err?.message);
  }
}

// ---------------------------------------------------------------------------
// Xero — create and send invoice
// ---------------------------------------------------------------------------

/**
 * credentials: { email, password } — Xero login
 * invoiceData: { clientName, clientEmail, description, amountCents, date }
 */
async function xeroInvoice(credentials, invoiceData) {
  const { sessionId, browser, page } = await createSession();

  try {
    // Log in to Xero
    await page.goto('https://login.xero.com', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('#email', credentials.email, { delay: 40 });
    await page.click('#xero-identity-login-button');
    await page.waitForSelector('#password', { timeout: 10000 });
    await page.type('#password', credentials.password, { delay: 40 });
    await page.click('#xero-identity-login-button');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

    // Navigate to new invoice
    await page.goto('https://go.xero.com/AccountsReceivable/Edit.aspx', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Fill contact
    const contactInput = await page.waitForSelector('[data-automationid="contact-name-input"]', { timeout: 10000 });
    await contactInput.type(invoiceData.clientName, { delay: 40 });
    await page.waitForTimeout(800);

    // Pick first autocomplete suggestion or create new
    const suggestion = await page.$('[data-automationid="contact-suggestion-0"]');
    if (suggestion) {
      await suggestion.click();
    }

    // Fill line item description
    const descInput = await page.waitForSelector('[data-automationid="line-item-description-0"]', { timeout: 10000 });
    await descInput.type(invoiceData.description || 'Services rendered', { delay: 30 });

    // Fill amount
    const amountInput = await page.$('[data-automationid="line-item-unit-price-0"]');
    if (amountInput) {
      await amountInput.click({ clickCount: 3 });
      await amountInput.type(String((invoiceData.amountCents / 100).toFixed(2)), { delay: 30 });
    }

    // Approve and send
    await page.click('[data-automationid="approve-and-email-button"]');
    await page.waitForSelector('[data-automationid="send-invoice-modal"]', { timeout: 10000 });

    // Fill client email if present in send modal
    if (invoiceData.clientEmail) {
      const emailInput = await page.$('[data-automationid="send-to-email-input"]');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(invoiceData.clientEmail, { delay: 30 });
      }
    }

    await page.click('[data-automationid="send-invoice-submit-button"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

    console.log('[Browserbase] Xero invoice sent', { clientName: invoiceData.clientName });
    return { ok: true };
  } finally {
    await closeSession(browser, sessionId);
  }
}

// ---------------------------------------------------------------------------
// Reece — add items to cart and check out
// ---------------------------------------------------------------------------

/**
 * credentials: { email, password } — Reece trade account login
 * items: [{ name: string, qty: number, productCode?: string }]
 */
async function reeceOrder(credentials, items) {
  const { sessionId, browser, page } = await createSession();

  try {
    // Log in
    await page.goto('https://www.reece.com.au/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('[name="email"]', credentials.email, { delay: 40 });
    await page.type('[name="password"]', credentials.password, { delay: 40 });
    await page.click('[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });

    // Add each item to cart
    for (const item of items) {
      const searchUrl = `https://www.reece.com.au/search?q=${encodeURIComponent(item.productCode || item.name)}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

      // Click first product result
      const firstResult = await page.$('[data-testid="product-card"]:first-child a, .product-list-item:first-child a');
      if (firstResult) {
        await firstResult.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      }

      // Set quantity
      const qtyInput = await page.$('[data-testid="quantity-input"], input[name="quantity"]');
      if (qtyInput) {
        await qtyInput.click({ clickCount: 3 });
        await qtyInput.type(String(item.qty || 1), { delay: 30 });
      }

      // Add to cart
      const addBtn = await page.$('[data-testid="add-to-cart-button"], button[data-action="addToCart"]');
      if (addBtn) {
        await addBtn.click();
        await page.waitForTimeout(800);
      }
    }

    // Proceed to checkout
    await page.goto('https://www.reece.com.au/cart', { waitUntil: 'networkidle2', timeout: 20000 });

    // Get cart total for confirmation
    const totalEl = await page.$('[data-testid="cart-total"], .cart-summary__total');
    const totalText = totalEl ? await page.evaluate(el => el.textContent, totalEl) : 'unknown';

    console.log('[Browserbase] Reece cart ready', { items: items.length, total: totalText });

    // Note: we stop here and return the total — the confirm flow in flynnSMS
    // will call this function again with a flag to actually submit once user confirms
    return { ok: true, cartTotal: totalText.trim() };
  } finally {
    await closeSession(browser, sessionId);
  }
}

// ---------------------------------------------------------------------------
// Generic — AI-guided browser task
// ---------------------------------------------------------------------------

/**
 * url:         starting URL
 * goal:        plain-English description of what to accomplish
 * credentials: any credentials the task needs (passed as context to the AI)
 * maxSteps:    safety cap on AI action steps (default 12)
 */
async function run(url, goal, credentials = {}, maxSteps = 12) {
  const { sessionId, browser, page } = await createSession();
  const client = getLLMClient('compatible');
  const QWEN_MODEL = process.env.SMS_LLM_MODEL || 'qwen3.6-flash';

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    const credentialHint = Object.keys(credentials).length
      ? `Credentials available: ${Object.keys(credentials).join(', ')}.`
      : '';

    for (let step = 0; step < maxSteps; step++) {
      // Snapshot the current page state
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      const currentUrl = page.url();

      const prompt = `You are controlling a browser to complete a task.

Goal: ${goal}
${credentialHint}
Current URL: ${currentUrl}
Page content (truncated): ${pageText}

What is the single next action to take? Respond with JSON only:
{
  "done": <true if goal is complete>,
  "action": "click | type | navigate | wait | none",
  "selector": "<CSS selector if click or type>",
  "value": "<text to type, or URL to navigate to>",
  "reasoning": "<one sentence>"
}`;

      const raw = await client.chat.completions.create({
        model: QWEN_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        enable_thinking: false,
        response_format: { type: 'json_object' },
      });

      let action;
      try {
        action = JSON.parse(raw.choices[0].message.content);
      } catch {
        break;
      }

      console.log(`[Browserbase] Step ${step + 1}:`, action.reasoning);

      if (action.done) {
        return { ok: true, steps: step + 1 };
      }

      switch (action.action) {
        case 'click':
          await page.click(action.selector).catch(() => {});
          await page.waitForTimeout(600);
          break;
        case 'type':
          await page.type(action.selector, action.value, { delay: 35 }).catch(() => {});
          break;
        case 'navigate':
          await page.goto(action.value, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
          break;
        case 'wait':
          await page.waitForTimeout(1500);
          break;
        default:
          break;
      }
    }

    return { ok: false, error: 'Max steps reached without completing goal' };
  } finally {
    await closeSession(browser, sessionId);
  }
}

// ---------------------------------------------------------------------------

module.exports = { createSession, xeroInvoice, reeceOrder, run };
