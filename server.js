// Perfect Insta Post Backend - Version avec Auth
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('./generated/prisma');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const session = require('express-session');

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors({
    origin: [
        'chrome-extension://*',
        'https://checkout.stripe.com',
        'http://localhost:*'
    ]
}));
app.use(express.json());

// Configuration session pour Passport
app.use(session({
    secret: process.env.JWT_SECRET || 'perfect-insta-post-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24h
    }
}));

// Initialisation Passport
app.use(passport.initialize());
app.use(passport.session());

// Test de connexion à la base de données au démarrage
async function testDatabaseConnection() {
    try {
        await prisma.$connect();
        console.log('✅ Connexion PostgreSQL établie');
    } catch (error) {
        console.error('❌ Erreur connexion PostgreSQL:', error);
        process.exit(1);
    }
}

// Configuration Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'production'
        ? "https://perfect-insta-extension-production.up.railway.app/auth/google/callback"
        : "/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('🔐 Google OAuth callback:', profile.emails[0].value);

        // Chercher ou créer l'utilisateur
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
        });

        if (!user) {
            // Créer nouvel utilisateur
            user = await prisma.user.create({
                data: {
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    avatarUrl: profile.photos[0]?.value,
                    monthlyResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                }
            });
            console.log('✅ Nouvel utilisateur créé:', user.email);
        } else {
            // Mettre à jour les infos utilisateur
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    name: profile.displayName,
                    avatarUrl: profile.photos[0]?.value
                }
            });
            console.log('✅ Utilisateur existant connecté:', user.email);
        }

        return done(null, user);
    } catch (error) {
        console.error('❌ Erreur OAuth:', error);
        return done(error, null);
    }
}));

// Sérialisation pour les sessions
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id }
        });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Prix Stripe - À configurer avec tes vrais prix
const PRICES = {
    pro_monthly: process.env.STRIPE_PRICE_ID || 'price_1234567890'
};

// Health check simple
app.get('/', (req, res) => {
    res.json({
        status: 'Perfect Insta Post Backend Online! 🚀 v3 - With Auth',
        timestamp: new Date(),
        version: '2.0.0'
    });
});

// Health check avec stats DB
app.get('/api/health', async (req, res) => {
    try {
        const userCount = await prisma.user.count();
        const sessionCount = await prisma.userSession.count();

        res.json({
            status: 'ok',
            database: 'connected',
            users: userCount,
            sessions: sessionCount,
            environment: process.env.NODE_ENV || 'development',
            timestamp: new Date()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Debug endpoint pour créer/récupérer un utilisateur de test
app.post('/api/debug-user', async (req, res) => {
    try {
        const { email = 'test@example.com', name = 'Test User' } = req.body;

        // Chercher ou créer l'utilisateur
        let user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    googleId: `test-${Date.now()}`,
                    email,
                    name,
                    monthlyResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                }
            });
            console.log(`✅ Utilisateur créé: ${email}`);
        } else {
            console.log(`✅ Utilisateur trouvé: ${email}`);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                postsThisMonth: user.postsThisMonth,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('❌ Erreur debug-user:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================================================
// ROUTES D'AUTHENTIFICATION GOOGLE OAUTH
// =============================================================================

// Route de connexion Google
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

// Route de callback Google OAuth
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
        try {
            // Générer JWT pour l'extension
            const token = jwt.sign(
                {
                    userId: req.user.id,
                    email: req.user.email,
                    plan: req.user.plan
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            console.log('✅ JWT généré pour:', req.user.email);

            // Pour les tests, afficher le token directement
            res.send(`
                <html>
                <head><title>Perfect Insta Post - Login Success</title></head>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>🎉 Connexion réussie !</h1>
                    <p><strong>Utilisateur :</strong> ${req.user.email}</p>
                    <p><strong>Plan :</strong> ${req.user.plan}</p>
                    <p><strong>Posts ce mois :</strong> ${req.user.postsThisMonth}</p>
                    <hr>
                    <h3>JWT Token généré :</h3>
                    <textarea style="width: 80%; height: 100px;">${token}</textarea>
                    <p><em>Ce token sera utilisé par l'extension pour s'authentifier</em></p>
                </body>
                </html>
            `);
        } catch (error) {
            console.error('❌ Erreur génération JWT:', error);
            res.redirect(`chrome-extension://${process.env.EXTENSION_ID}/popup.html?login=error`);
        }
    }
);

// Route de déconnexion
app.post('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, message: 'Déconnexion réussie' });
    });
});

// Middleware d'authentification JWT
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer TOKEN

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Token invalide' });
            }

            // Récupérer l'utilisateur depuis la base
            try {
                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId }
                });

                if (!user) {
                    return res.status(404).json({ error: 'Utilisateur non trouvé' });
                }

                req.user = user;
                next();
            } catch (error) {
                console.error('❌ Erreur récupération utilisateur:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });
    } else {
        res.status(401).json({ error: 'Token d\'authentification requis' });
    }
}

// Route pour récupérer les infos utilisateur (protégée)
app.get('/api/user/me', authenticateJWT, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            avatarUrl: req.user.avatarUrl,
            plan: req.user.plan,
            postsThisMonth: req.user.postsThisMonth,
            createdAt: req.user.createdAt
        }
    });
});

// Route pour générer un post (protégée)
app.post('/api/generate-post', authenticateJWT, async (req, res) => {
    try {
        const { imageData, config } = req.body;

        // Vérifier les quotas utilisateur
        const user = req.user;
        const maxPosts = user.plan === 'pro' ? 50 : 5;

        if (user.postsThisMonth >= maxPosts) {
            return res.status(403).json({
                success: false,
                error: 'Quota de posts atteint',
                quota: {
                    used: user.postsThisMonth,
                    limit: maxPosts,
                    plan: user.plan
                }
            });
        }

        // Simuler la génération de contenu (ici on peut intégrer OpenAI + Google Vision)
        // Pour l'instant, on retourne un contenu exemple
        const content = {
            caption: `Belle image partagée ! ✨ #${config.postType} #inspiration`,
            hashtags: [`${config.postType}`, 'inspiration', 'beautiful', config.tone, 'lifestyle'],
            suggestions: [
                'Ajoutez une story pour plus d\'engagement',
                'Postez aux heures de forte affluence',
                'Engagez avec votre communauté'
            ]
        };

        // Incrémenter le compteur de posts
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { postsThisMonth: user.postsThisMonth + 1 }
        });

        console.log(`📊 Post généré pour ${user.email} (${updatedUser.postsThisMonth}/${maxPosts})`);

        res.json({
            success: true,
            content: content,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                plan: updatedUser.plan,
                postsThisMonth: updatedUser.postsThisMonth
            }
        });

    } catch (error) {
        console.error('❌ Erreur génération post:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la génération'
        });
    }
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
const PORT = process.env.PORT || 8080;

// Fonction de démarrage
async function startServer() {
    console.log('🔍 Starting server...');
    console.log('🌍 Environment variables:');
    console.log('PORT:', process.env.PORT || 'using default 8090');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

    // Test de connexion à la base de données
    await testDatabaseConnection();

    // Démarrage du serveur
    app.listen(PORT, '0.0.0.0', (err) => {
        if (err) {
            console.error('❌ Failed to start server:', err);
            process.exit(1);
        }
        console.log(`🚀 Perfect Insta Backend v2 running on port ${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`💳 Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
        console.log(`🗄️ Database: Connected to PostgreSQL`);
        console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });
}

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down server...');
    await prisma.$disconnect();
    process.exit(0);
});

// Démarrer le serveur
startServer().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

module.exports = app;