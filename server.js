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
const OpenAI = require('openai');

const app = express();
const prisma = new PrismaClient();

// Initialiser OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors({
    origin: [
        'chrome-extension://*',
        'https://checkout.stripe.com',
        'http://localhost:*'
    ]
}));
app.use(express.json({ limit: '50mb' })); // Augmenter la limite pour les images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
const callbackURL = process.env.RAILWAY_ENVIRONMENT
    ? "https://perfect-insta-extension-production.up.railway.app/auth/google/callback"
    : (process.env.NODE_ENV === 'production'
        ? "https://perfect-insta-extension-production.up.railway.app/auth/google/callback"
        : "/auth/google/callback");

console.log('🔗 OAuth Callback URL:', callbackURL);

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL
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

// Route simplifiée pour extension (nouvel approche)
app.get('/auth/extension', (req, res, next) => {
    // Passer un paramètre state pour identifier l'extension
    console.log('🔗 Authentification extension initiée');

    passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: 'extension_auth'
    })(req, res, next);
});

// Route de connexion Google
app.get('/auth/google', (req, res, next) => {
    // Stocker le redirect_uri pour le callback
    req.session.redirect_uri = req.query.redirect_uri;
    console.log('📍 Redirect URI stocké:', req.query.redirect_uri);

    passport.authenticate('google', {
        scope: ['profile', 'email']
    })(req, res, next);
});

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

            // Vérifier si c'est une authentification extension via le paramètre state
            const state = req.query.state;
            console.log('🔍 Paramètre state reçu:', state);

            if (state === 'extension_auth') {
                // Redirection simple avec paramètres URL pour l'extension
                const userEncoded = encodeURIComponent(JSON.stringify({
                    id: req.user.id,
                    email: req.user.email,
                    name: req.user.name,
                    plan: req.user.plan,
                    postsThisMonth: req.user.postsThisMonth
                }));

                const successUrl = `https://perfect-insta-extension-production.up.railway.app/auth/success?success=true&token=${token}&user=${userEncoded}`;
                console.log('🔗 Redirection extension vers:', successUrl);

                res.redirect(successUrl);
                return;
            }

            // Récupérer le redirect_uri depuis la session
            const redirectUri = req.session.redirect_uri;

            if (redirectUri && redirectUri.includes('chromiumapp.org')) {
                // Redirection chrome.identity avec token et user dans le hash
                const userEncoded = encodeURIComponent(JSON.stringify({
                    id: req.user.id,
                    email: req.user.email,
                    name: req.user.name,
                    plan: req.user.plan,
                    postsThisMonth: req.user.postsThisMonth
                }));

                const finalRedirectUrl = `${redirectUri}#token=${token}&user=${userEncoded}`;
                console.log('🔗 Redirection chrome.identity vers:', finalRedirectUrl);

                res.redirect(finalRedirectUrl);
                return;
            }

            // Fallback: Page avec transfert automatique vers l'extension (ancien système)
            res.send(`
                <html>
                <head>
                    <title>Perfect Insta Post - Login Success</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            text-align: center;
                            padding: 50px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            margin: 0;
                            min-height: 100vh;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                        }
                        .container {
                            background: rgba(255,255,255,0.1);
                            padding: 40px;
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                            max-width: 500px;
                            margin: 0 auto;
                        }
                        .status {
                            margin: 20px 0;
                            padding: 15px;
                            border-radius: 10px;
                            background: rgba(255,255,255,0.1);
                        }
                        .success { background: rgba(76, 175, 80, 0.3); }
                        .processing { background: rgba(255, 193, 7, 0.3); }
                        .spinner {
                            border: 3px solid rgba(255,255,255,0.3);
                            border-radius: 50%;
                            border-top: 3px solid white;
                            width: 30px;
                            height: 30px;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 15px auto;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        .token-area {
                            background: rgba(0,0,0,0.1);
                            padding: 15px;
                            border-radius: 10px;
                            margin: 20px 0;
                            word-break: break-all;
                            font-size: 12px;
                            opacity: 0.7;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🎉 Connexion réussie !</h1>
                        <p><strong>Utilisateur :</strong> ${req.user.email}</p>
                        <p><strong>Plan :</strong> ${req.user.plan.toUpperCase()}</p>
                        <p><strong>Posts ce mois :</strong> ${req.user.postsThisMonth}/${req.user.plan === 'free' ? 5 : 50}</p>

                        <div id="status" class="status processing">
                            <div class="spinner"></div>
                            <p>🔄 Transfert vers l'extension en cours...</p>
                        </div>

                        <div class="token-area">
                            <strong>JWT Token :</strong><br>
                            ${token}
                        </div>

                        <p><small>Cette page se fermera automatiquement dans quelques secondes</small></p>
                    </div>

                    <script>
                        const token = "${token}";
                        const user = {
                            id: "${req.user.id}",
                            email: "${req.user.email}",
                            name: "${req.user.name || ''}",
                            plan: "${req.user.plan}",
                            postsThisMonth: ${req.user.postsThisMonth}
                        };

                        // Fonction pour notifier l'extension
                        function notifyExtension() {
                            // Méthode 1: PostMessage vers toutes les fenêtres ouvertes
                            if (window.opener) {
                                window.opener.postMessage({
                                    type: 'PERFECT_INSTA_AUTH_SUCCESS',
                                    token: token,
                                    user: user
                                }, '*');
                            }

                            // Méthode 2: localStorage pour communication cross-tab
                            localStorage.setItem('perfect_insta_auth_token', token);
                            localStorage.setItem('perfect_insta_auth_user', JSON.stringify(user));

                            // Trigger storage event
                            localStorage.setItem('perfect_insta_auth_event', Date.now().toString());

                            // Méthode 3: Essayer de communiquer directement avec l'extension
                            if (typeof chrome !== 'undefined' && chrome.runtime) {
                                try {
                                    chrome.runtime.sendMessage('${process.env.EXTENSION_ID || 'unknown'}', {
                                        type: 'AUTH_SUCCESS',
                                        token: token,
                                        user: user
                                    });
                                } catch (e) {
                                    console.log('Direct extension communication failed:', e);
                                }
                            }

                            // Mise à jour du statut
                            document.getElementById('status').innerHTML = \`
                                <div style="background: rgba(76, 175, 80, 0.3); padding: 15px; border-radius: 10px;">
                                    ✅ Authentification transférée avec succès !<br>
                                    <small>Vous pouvez fermer cette page et retourner à l'extension</small>
                                </div>
                            \`;

                            // Auto-fermeture après 3 secondes
                            setTimeout(() => {
                                window.close();
                            }, 3000);
                        }

                        // Exécuter le transfert
                        setTimeout(notifyExtension, 1000);
                    </script>
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

// Page de succès pour l'extension (nouvelle approche)
app.get('/auth/success', (req, res) => {
    const { success, token, user, error } = req.query;

    if (error) {
        res.send(`
            <html>
            <head>
                <title>Perfect Insta Post - Erreur</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f44336; color: white; }
                    .container { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>❌ Erreur d'authentification</h2>
                    <p>${decodeURIComponent(error)}</p>
                    <p><small>Vous pouvez fermer cette page et réessayer.</small></p>
                </div>
                <script>setTimeout(() => window.close(), 5000);</script>
            </body>
            </html>
        `);
        return;
    }

    if (success && token && user) {
        res.send(`
            <html>
            <head>
                <title>Perfect Insta Post - Connexion réussie</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #4CAF50; color: white; }
                    .container { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; }
                    .success { background: rgba(76, 175, 80, 0.3); padding: 15px; border-radius: 8px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>✅ Connexion réussie !</h2>
                    <div class="success">
                        <p>Authentification transférée vers l'extension.</p>
                        <p><small>Cette page va se fermer automatiquement.</small></p>
                    </div>
                </div>
                <script>
                    const urlParams = new URLSearchParams(window.location.search);
                    const token = urlParams.get('token');
                    const user = urlParams.get('user');

                    console.log('Token reçu:', token);
                    console.log('User reçu:', user);

                    // Attendre plus longtemps pour que l'extension puisse traiter
                    setTimeout(() => {
                        console.log('Fermeture de la page...');
                        window.close();
                    }, 5000); // 5 secondes au lieu de 2
                </script>
            </body>
            </html>
        `);
    } else {
        res.redirect('/auth/extension');
    }
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

        // Générer le contenu avec OpenAI GPT-4 Vision
        const content = await generateInstagramPost(imageData, config);

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

// =============================================================================
// GÉNÉRATION DE CONTENU INSTAGRAM AVEC OPENAI GPT-4 VISION
// =============================================================================

async function generateInstagramPost(imageData, config) {
    try {
        console.log('🤖 Génération du contenu avec OpenAI GPT-4 Vision...');

        const prompt = `Analyse cette image et génère un post Instagram ${config.postType || 'lifestyle'} avec un ton ${config.tone || 'positif'}.

Instructions spécifiques:
- Longueur de la légende: ${config.captionLength || 'moyenne'}
- Style de légende: ${config.captionStyle || 'naturel'}
- Lieu/contexte: ${config.location || 'non spécifié'}
- Contexte supplémentaire: ${config.context || 'aucun'}

Retourne un JSON avec cette structure exacte:
{
  "caption": "Légende Instagram engageante et authentique",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "suggestions": ["Suggestion d'amélioration 1", "Suggestion d'amélioration 2", "Suggestion d'amélioration 3"]
}

Assure-toi que:
- La légende est naturelle et engageante
- Les hashtags sont pertinents et populaires
- Les suggestions sont utiles pour améliorer l'engagement`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${imageData}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.8
        });

        const content = response.choices[0].message.content;
        console.log('🎯 Réponse OpenAI reçue:', content);

        // Parser la réponse JSON
        let parsedContent;
        try {
            // Nettoyer la réponse si elle contient du markdown
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            parsedContent = JSON.parse(cleanContent);
        } catch (parseError) {
            console.warn('⚠️ Erreur parsing JSON, utilisation du fallback:', parseError);
            // Fallback si le parsing échoue
            parsedContent = {
                caption: "Contenu généré par IA - analyse de votre belle image ! ✨",
                hashtags: [config.postType || "lifestyle", config.tone || "inspiration", "ai", "beautiful", "moment"],
                suggestions: [
                    "Ajoutez plus de contexte dans la description",
                    "Interagissez avec votre audience en posant une question",
                    "Utilisez des emojis pour rendre le post plus engageant"
                ]
            };
        }

        // Validation et nettoyage des données
        if (!parsedContent.caption) {
            parsedContent.caption = "Belle image partagée ! ✨";
        }

        if (!Array.isArray(parsedContent.hashtags) || parsedContent.hashtags.length === 0) {
            parsedContent.hashtags = [config.postType || "lifestyle", "inspiration", "beautiful"];
        }

        if (!Array.isArray(parsedContent.suggestions) || parsedContent.suggestions.length === 0) {
            parsedContent.suggestions = [
                "Ajoutez votre ressenti personnel",
                "Mentionnez le lieu ou le moment",
                "Posez une question à votre audience"
            ];
        }

        // Nettoyer les hashtags (enlever # s'il y en a)
        parsedContent.hashtags = parsedContent.hashtags.map(tag =>
            typeof tag === 'string' ? tag.replace('#', '') : String(tag)
        );

        console.log('✅ Contenu généré avec succès');
        return parsedContent;

    } catch (error) {
        console.error('❌ Erreur génération OpenAI:', error);

        // Fallback en cas d'erreur
        return {
            caption: `Analyse de votre ${config.postType || 'image'} avec un style ${config.tone || 'inspirant'} ! ✨`,
            hashtags: [
                config.postType || "lifestyle",
                config.tone || "inspiration",
                "beautiful",
                "moment",
                "share"
            ],
            suggestions: [
                "Ajoutez une description personnelle de ce moment",
                "Mentionnez les personnes ou lieux importants",
                "Utilisez des emojis pour plus d'engagement"
            ]
        };
    }
}

// =============================================================================
// DÉMARRAGE SERVEUR
// =============================================================================

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