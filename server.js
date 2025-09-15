// Perfect Insta Post Backend - Version MVP
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(cors({
    origin: [
        'chrome-extension://*',
        'https://checkout.stripe.com',
        'http://localhost:*'
    ]
}));
app.use(express.json());

// Simple in-memory storage (remplacer par DB plus tard)
const users = new Map();
const subscriptions = new Map();

// Prix Stripe - À configurer avec tes vrais prix
const PRICES = {
    pro_monthly: process.env.STRIPE_PRICE_ID || 'price_1234567890'
};

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'Perfect Insta Post Backend Online! 🚀',
        timestamp: new Date(),
        version: '1.0.0'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        users: users.size,
        subscriptions: subscriptions.size,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Créer session checkout Stripe
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { userEmail = 'anonymous@example.com' } = req.body;

        console.log('Creating checkout session for:', userEmail);

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: PRICES.pro_monthly,
                quantity: 1,
            }],
            customer_email: userEmail,
            success_url: `chrome-extension://${process.env.EXTENSION_ID}/popup.html?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `chrome-extension://${process.env.EXTENSION_ID}/popup.html?payment_cancelled=true`,
            metadata: {
                source: 'chrome_extension',
                userEmail: userEmail
            }
        });

        res.json({
            success: true,
            id: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Checkout session error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Vérifier statut abonnement
app.get('/api/subscription-status', async (req, res) => {
    try {
        const { userEmail } = req.query;

        if (!userEmail || userEmail === 'anonymous@example.com') {
            return res.json({
                success: true,
                status: 'free',
                plan: 'free'
            });
        }

        // Chercher dans notre "DB" simple
        const userData = subscriptions.get(userEmail);

        if (!userData) {
            return res.json({
                success: true,
                status: 'free',
                plan: 'free'
            });
        }

        // Vérifier avec Stripe si toujours actif
        try {
            const subscription = await stripe.subscriptions.retrieve(userData.subscription_id);

            res.json({
                success: true,
                status: subscription.status,
                plan: subscription.status === 'active' ? 'pro' : 'free',
                current_period_end: subscription.current_period_end,
                subscription_id: subscription.id
            });

        } catch (stripeError) {
            console.error('Stripe check error:', stripeError);
            res.json({
                success: true,
                status: 'free',
                plan: 'free'
            });
        }

    } catch (error) {
        console.error('Subscription status error:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// Webhook Stripe (simplifié)
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } else {
            console.warn('⚠️  No webhook secret - using raw body');
            event = JSON.parse(req.body);
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log('🎉 Checkout completed:', session.customer_email);

                // Sauvegarder l'utilisateur Pro
                if (session.customer_email) {
                    subscriptions.set(session.customer_email, {
                        subscription_id: session.subscription,
                        status: 'active',
                        plan: 'pro',
                        created_at: new Date()
                    });
                }
                break;

            case 'customer.subscription.deleted':
                const deletedSub = event.data.object;
                console.log('❌ Subscription deleted:', deletedSub.id);

                // Supprimer de notre storage
                for (const [email, data] of subscriptions.entries()) {
                    if (data.subscription_id === deletedSub.id) {
                        subscriptions.delete(email);
                        break;
                    }
                }
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Server error');
    }
});

// Analytics endpoint (simple)
app.post('/api/analytics/batch', (req, res) => {
    const { events, user_id } = req.body;

    // Pour l'instant on log juste (ajouter vraie DB plus tard)
    console.log(`📊 Analytics: ${events.length} events from ${user_id}`);

    res.json({ success: true, processed: events.length });
});

// Démarrage serveur
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Perfect Insta Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💳 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});

module.exports = app;