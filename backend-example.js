// Exemple de backend Node.js + Express pour Perfect Insta Post
// Gère les paiements Stripe et les abonnements

const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Variables d'environnement requises
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'chrome-extension://your-extension-id';

// Prix Stripe
const PRICES = {
    pro_monthly: 'price_1234567890', // Remplacer par votre prix Stripe
};

// Base de données simple (remplacer par une vraie DB)
const users = new Map();
const subscriptions = new Map();

// Routes

// Créer une session de checkout Stripe
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { priceId, userEmail } = req.body;

        if (!PRICES[priceId] && !Object.values(PRICES).includes(priceId)) {
            return res.status(400).json({ error: 'Prix invalide' });
        }

        // URLs de retour
        const success_url = `${FRONTEND_URL}/popup.html?payment_success=true&session_id={CHECKOUT_SESSION_ID}`;
        const cancel_url = `${FRONTEND_URL}/popup.html?payment_cancelled=true`;

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: userEmail,
            success_url: success_url,
            cancel_url: cancel_url,
            metadata: {
                source: 'chrome_extension',
                userEmail: userEmail
            },
            subscription_data: {
                metadata: {
                    source: 'chrome_extension',
                    userEmail: userEmail
                }
            }
        });

        res.json({
            id: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Erreur création session:', error);
        res.status(500).json({
            error: 'Erreur lors de la création de la session de paiement'
        });
    }
});

// Vérifier le statut d'abonnement
app.get('/api/subscription-status', async (req, res) => {
    try {
        const { userEmail } = req.query;

        if (!userEmail) {
            return res.json({ status: 'free', plan: 'free' });
        }

        // Rechercher l'abonnement actif pour cet utilisateur
        const subscription = await findActiveSubscription(userEmail);

        if (!subscription) {
            return res.json({
                status: 'free',
                plan: 'free'
            });
        }

        res.json({
            status: subscription.status,
            plan: subscription.status === 'active' ? 'pro' : 'free',
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            subscription_id: subscription.id
        });

    } catch (error) {
        console.error('Erreur vérification abonnement:', error);
        res.status(500).json({
            error: 'Erreur lors de la vérification de l\'abonnement'
        });
    }
});

// Annuler un abonnement
app.post('/api/cancel-subscription', async (req, res) => {
    try {
        const { userEmail } = req.body;

        const subscription = await findActiveSubscription(userEmail);

        if (!subscription) {
            return res.status(404).json({
                error: 'Aucun abonnement trouvé'
            });
        }

        // Annuler à la fin de la période
        const updatedSubscription = await stripe.subscriptions.update(
            subscription.id,
            {
                cancel_at_period_end: true
            }
        );

        res.json({
            success: true,
            message: 'Abonnement programmé pour annulation',
            cancel_at: updatedSubscription.cancel_at,
            current_period_end: updatedSubscription.current_period_end
        });

    } catch (error) {
        console.error('Erreur annulation abonnement:', error);
        res.status(500).json({
            error: 'Erreur lors de l\'annulation de l\'abonnement'
        });
    }
});

// Webhook Stripe pour gérer les événements
app.post('/api/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer les événements Stripe
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Erreur traitement webhook:', error);
        res.status(500).send('Erreur serveur');
    }
});

// Gestionnaires d'événements Stripe

async function handleCheckoutCompleted(session) {
    console.log('🎉 Checkout completed:', session.id);

    const userEmail = session.customer_email || session.metadata?.userEmail;

    if (!userEmail) {
        console.error('Pas d\'email utilisateur dans la session');
        return;
    }

    // Récupérer l'abonnement
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    // Sauvegarder dans notre base de données
    subscriptions.set(userEmail, {
        subscription_id: subscription.id,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        plan: 'pro',
        created_at: new Date()
    });

    console.log(`✅ Utilisateur ${userEmail} upgrade vers Pro`);
}

async function handlePaymentSucceeded(invoice) {
    console.log('💰 Payment succeeded:', invoice.id);

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userEmail = subscription.metadata?.userEmail || invoice.customer_email;

    if (userEmail && subscriptions.has(userEmail)) {
        // Mettre à jour les données d'abonnement
        const userData = subscriptions.get(userEmail);
        userData.status = subscription.status;
        userData.current_period_end = subscription.current_period_end;
        subscriptions.set(userEmail, userData);
    }
}

async function handleSubscriptionUpdated(subscription) {
    console.log('📝 Subscription updated:', subscription.id);

    const userEmail = subscription.metadata?.userEmail;

    if (userEmail && subscriptions.has(userEmail)) {
        const userData = subscriptions.get(userEmail);
        userData.status = subscription.status;
        userData.current_period_end = subscription.current_period_end;
        userData.cancel_at_period_end = subscription.cancel_at_period_end;
        subscriptions.set(userEmail, userData);
    }
}

async function handleSubscriptionDeleted(subscription) {
    console.log('🗑️ Subscription deleted:', subscription.id);

    const userEmail = subscription.metadata?.userEmail;

    if (userEmail) {
        subscriptions.delete(userEmail);
        console.log(`❌ Abonnement supprimé pour ${userEmail}`);
    }
}

// Utilitaires

async function findActiveSubscription(userEmail) {
    // Dans une vraie app, rechercher dans la base de données
    const userData = subscriptions.get(userEmail);

    if (!userData) return null;

    // Vérifier si l'abonnement est toujours actif via Stripe
    try {
        const subscription = await stripe.subscriptions.retrieve(userData.subscription_id);
        return subscription;
    } catch (error) {
        console.error('Erreur récupération abonnement:', error);
        return null;
    }
}

// Route de test
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        users: users.size,
        subscriptions: subscriptions.size
    });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
});

// Export pour les tests
module.exports = app;

/*
INSTRUCTIONS DE DÉPLOIEMENT:

1. Variables d'environnement requises:
   - STRIPE_SECRET_KEY=sk_test_... (clé secrète Stripe)
   - STRIPE_WEBHOOK_SECRET=whsec_... (secret webhook Stripe)
   - NODE_ENV=production (en production)
   - PORT=3000 (ou autre)

2. Installer les dépendances:
   npm install express cors stripe

3. Configurer Stripe:
   - Créer un prix pour "Pro Monthly" à 19€
   - Configurer un webhook pointant vers /api/webhook/stripe
   - Événements webhook à écouter:
     * checkout.session.completed
     * invoice.payment_succeeded
     * customer.subscription.updated
     * customer.subscription.deleted

4. Sécurité supplémentaire (recommandée):
   - Authentification JWT pour les routes protégées
   - Limitation de taux (rate limiting)
   - HTTPS uniquement en production
   - Base de données sécurisée (PostgreSQL/MySQL)
   - Logs et monitoring (Sentry, LogRocket)

5. Déploiement:
   - Heroku: git push heroku main
   - Vercel: vercel deploy
   - DigitalOcean App Platform
   - AWS Elastic Beanstalk

6. Tests:
   - Tester les webhooks avec stripe CLI
   - Tests d'intégration avec Stripe Test Mode
   - Tests de charge pour la scalabilité
*/