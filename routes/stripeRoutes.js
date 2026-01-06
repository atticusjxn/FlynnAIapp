/**
 * Stripe Subscription Management Routes
 * Handles native in-app subscription creation and management
 * Created: January 2025
 */

const Stripe = require('stripe');

module.exports = function attachStripeSubscriptionRoutes(app, {
  authenticateJwt,
  supabaseAdmin,
}) {
  console.log('[StripeRoutes] Attaching subscription management routes');

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  /**
   * POST /api/stripe/create-subscription
   * Create a new subscription with 14-day trial
   * Collects payment method upfront but doesn't charge during trial
   */
  app.post('/api/stripe/create-subscription', authenticateJwt, async (req, res) => {
    try {
      const { priceId, customerEmail, userId } = req.body;
      const authenticatedUserId = req.user?.id;

      // Validate user authorization
      if (!userId || userId !== authenticatedUserId) {
        return res.status(403).json({
          error: true,
          message: 'Unauthorized'
        });
      }

      if (!priceId || !customerEmail) {
        return res.status(400).json({
          error: true,
          message: 'Missing required parameters: priceId, customerEmail'
        });
      }

      console.log(`[StripeRoutes] Creating subscription for user ${userId}, price ${priceId}`);

      // Check if customer already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      let customerId = existingUser?.stripe_customer_id;

      // Create new Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: customerEmail,
          metadata: {
            supabase_user_id: userId,
          },
        });
        customerId = customer.id;

        // Save customer ID to database
        await supabaseAdmin
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);

        console.log(`[StripeRoutes] Created new Stripe customer: ${customerId}`);
      }

      // Create subscription with 14-day trial
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      });

      // Get client_secret from payment intent or setup intent
      const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret ||
        subscription.pending_setup_intent?.client_secret;

      if (!clientSecret) {
        throw new Error('Failed to get client secret from subscription');
      }

      // Save subscription ID to database
      await supabaseAdmin
        .from('users')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        })
        .eq('id', userId);

      console.log(`[StripeRoutes] Subscription created: ${subscription.id}, status: ${subscription.status}`);

      res.status(200).json({
        subscriptionId: subscription.id,
        clientSecret,
        customerId,
        status: subscription.status,
        trialEnd: subscription.trial_end,
      });

    } catch (error) {
      console.error('[StripeRoutes] Error creating subscription:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to create subscription'
      });
    }
  });

  /**
   * GET /api/stripe/subscription/:userId
   * Fetch current subscription details for a user
   */
  app.get('/api/stripe/subscription/:userId', authenticateJwt, async (req, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;

      if (userId !== authenticatedUserId) {
        return res.status(403).json({ error: true, message: 'Unauthorized' });
      }

      // Fetch subscription ID from database
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (!userData?.stripe_subscription_id) {
        return res.status(404).json({
          error: false,
          message: 'No active subscription',
          subscription: null,
        });
      }

      // Fetch subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id, {
        expand: ['default_payment_method', 'items.data.price.product'],
      });

      // Get payment method details
      const paymentMethod = subscription.default_payment_method;
      const cardDetails = paymentMethod?.card ? {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      } : null;

      // Extract plan details
      const planItem = subscription.items.data[0];
      const planDetails = {
        productName: planItem.price.product.name,
        amount: planItem.price.unit_amount / 100,
        currency: planItem.price.currency.toUpperCase(),
        interval: planItem.price.recurring.interval,
      };

      res.status(200).json({
        subscriptionId: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan: planDetails,
        paymentMethod: cardDetails,
      });

    } catch (error) {
      console.error('[StripeRoutes] Error fetching subscription:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to fetch subscription'
      });
    }
  });

  /**
   * POST /api/stripe/cancel-subscription/:userId
   * Cancel subscription at period end
   */
  app.post('/api/stripe/cancel-subscription/:userId', authenticateJwt, async (req, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;

      if (userId !== authenticatedUserId) {
        return res.status(403).json({ error: true, message: 'Unauthorized' });
      }

      // Fetch subscription ID
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_subscription_id')
        .eq('id', userId)
        .single();

      if (!userData?.stripe_subscription_id) {
        return res.status(404).json({
          error: true,
          message: 'No active subscription found'
        });
      }

      // Cancel subscription at period end
      const subscription = await stripe.subscriptions.update(userData.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Update database
      await supabaseAdmin
        .from('users')
        .update({ subscription_status: subscription.status })
        .eq('id', userId);

      console.log(`[StripeRoutes] Subscription ${subscription.id} will cancel at period end`);

      res.status(200).json({
        success: true,
        message: 'Subscription will be cancelled at the end of the billing period',
        cancelAt: subscription.cancel_at,
      });

    } catch (error) {
      console.error('[StripeRoutes] Error cancelling subscription:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to cancel subscription'
      });
    }
  });

  /**
   * POST /api/stripe/create-setup-intent
   * Create Setup Intent for updating payment method
   */
  app.post('/api/stripe/create-setup-intent', authenticateJwt, async (req, res) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: true, message: 'Unauthorized' });
      }

      // Fetch customer ID
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (!userData?.stripe_customer_id) {
        return res.status(404).json({
          error: true,
          message: 'No Stripe customer found'
        });
      }

      // Create Setup Intent
      const setupIntent = await stripe.setupIntents.create({
        customer: userData.stripe_customer_id,
        payment_method_types: ['card'],
      });

      res.status(200).json({
        clientSecret: setupIntent.client_secret,
      });

    } catch (error) {
      console.error('[StripeRoutes] Error creating setup intent:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to create setup intent'
      });
    }
  });

  /**
   * POST /api/stripe/update-payment-method
   * Update default payment method for subscription
   */
  app.post('/api/stripe/update-payment-method', authenticateJwt, async (req, res) => {
    try {
      const { paymentMethodId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: true, message: 'Unauthorized' });
      }

      if (!paymentMethodId) {
        return res.status(400).json({ error: true, message: 'Payment method ID required' });
      }

      // Fetch subscription ID
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (!userData?.stripe_subscription_id) {
        return res.status(404).json({ error: true, message: 'No subscription found' });
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: userData.stripe_customer_id,
      });

      // Set as default payment method
      await stripe.customers.update(userData.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update subscription default payment method
      await stripe.subscriptions.update(userData.stripe_subscription_id, {
        default_payment_method: paymentMethodId,
      });

      console.log(`[StripeRoutes] Updated payment method for user ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Payment method updated successfully',
      });

    } catch (error) {
      console.error('[StripeRoutes] Error updating payment method:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to update payment method'
      });
    }
  });

  /**
   * GET /api/stripe/billing-history/:userId
   * Fetch invoice history for a user
   */
  app.get('/api/stripe/billing-history/:userId', authenticateJwt, async (req, res) => {
    try {
      const { userId } = req.params;
      const authenticatedUserId = req.user?.id;

      if (userId !== authenticatedUserId) {
        return res.status(403).json({ error: true, message: 'Unauthorized' });
      }

      // Fetch customer ID
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (!userData?.stripe_customer_id) {
        return res.status(404).json({
          error: false,
          invoices: [],
        });
      }

      // Fetch invoices from Stripe
      const invoices = await stripe.invoices.list({
        customer: userData.stripe_customer_id,
        limit: 12,
      });

      const formattedInvoices = invoices.data.map(invoice => ({
        id: invoice.id,
        amount: invoice.total / 100,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        created: invoice.created,
        paidAt: invoice.status_transitions.paid_at,
        invoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
      }));

      res.status(200).json({
        invoices: formattedInvoices,
      });

    } catch (error) {
      console.error('[StripeRoutes] Error fetching billing history:', error);
      res.status(500).json({
        error: true,
        message: error.message || 'Failed to fetch billing history'
      });
    }
  });

  console.log('[StripeRoutes] ✅ Subscription routes attached');
  console.log('[StripeRoutes] ℹ️  Webhook handler is configured in server.js');
};
