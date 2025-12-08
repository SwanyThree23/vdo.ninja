const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Credit packages
const CREDIT_PACKAGES = {
  starter: { credits: 100, amount: 999, name: 'Starter Pack' },
  pro: { credits: 500, amount: 3999, name: 'Pro Pack' },
  enterprise: { credits: 2000, amount: 12999, name: 'Enterprise Pack' }
};

// Create payment intent
router.post('/create-intent', authMiddleware, async (req, res) => {
  try {
    const { package_type } = req.body;
    const userId = req.user.id;

    if (!CREDIT_PACKAGES[package_type]) {
      return res.status(400).json({ error: 'Invalid package type' });
    }

    const package = CREDIT_PACKAGES[package_type];

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: package.amount,
      currency: 'usd',
      metadata: {
        userId,
        package_type,
        credits: package.credits
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: package.amount,
      credits: package.credits
    });
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const { userId, credits } = paymentIntent.metadata;

        // Add credits to user
        await db.query(
          'UPDATE users SET credits = credits + $1 WHERE id = $2',
          [parseInt(credits), userId]
        );

        // Record payment
        await db.query(
          `INSERT INTO payments (user_id, stripe_payment_id, amount, credits_purchased, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, paymentIntent.id, paymentIntent.amount, parseInt(credits), 'completed']
        );

        // Log credit transaction
        await db.query(
          `INSERT INTO credit_transactions (user_id, amount, type, description)
           VALUES ($1, $2, $3, $4)`,
          [userId, parseInt(credits), 'purchase', 'Credit pack purchased']
        );

        console.log(`✅ Payment successful for user ${userId}: +${credits} credits`);
        break;

      case 'payment_intent.payment_failed':
        console.error('❌ Payment failed:', event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Get payment history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT id, amount, credits_purchased, status, created_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json({ payments: result.rows });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Get credit packages
router.get('/packages', (req, res) => {
  res.json({ packages: CREDIT_PACKAGES });
});

module.exports = router;