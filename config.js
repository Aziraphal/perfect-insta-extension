// =============================================================================
// PERFECT INSTA POST - CONFIGURATION CENTRALISÉE
// Toutes les constantes et configurations partagées
// =============================================================================

const APP_CONFIG = {
    // Informations de l'application
    app: {
        name: 'Perfect Insta Post',
        version: '1.1.0',
        description: 'Generate perfect Instagram posts with AI'
    },

    // Configuration du backend
    backend: {
        baseUrl: 'https://perfect-insta-extension-production.up.railway.app',
        endpoints: {
            // Auth (OAuth flow)
            auth: '/auth/google',

            // Auth (API)
            login: '/api/auth/google',
            logout: '/api/auth/logout',
            verify: '/api/auth/verify',
            userMe: '/api/user/me',

            // Core
            generatePost: '/api/generate-post',

            // Advanced analysis
            analyze: '/api/analyze',
            ideas: '/api/ideas',
            predict: '/api/predict',
            hooks: '/api/hooks',
            ctas: '/api/ctas',
            captions: '/api/captions',

            // Payments
            createCheckout: '/api/create-checkout-session',
            cancelSubscription: '/api/cancel-subscription',

            // Usage
            usage: '/api/usage'
        }
    },

    // Limites et contraintes
    limits: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
        maxImageDimension: 4096,
        thumbnailSize: 200
    },

    // Plans et quotas
    plans: {
        free: {
            name: 'Free',
            postsPerMonth: 5,
            features: ['basic_generation', 'basic_hashtags']
        },
        pro: {
            name: 'Pro',
            postsPerMonth: 50,
            price: 19,
            features: [
                'basic_generation',
                'basic_hashtags',
                'location',
                'context',
                'caption_length',
                'caption_style',
                'advanced_analysis',
                'export_png',
                'history'
            ]
        }
    },

    // Types de posts
    postTypes: [
        { value: 'lifestyle', label: 'Lifestyle' },
        { value: 'food', label: 'Nourriture' },
        { value: 'travel', label: 'Voyage' },
        { value: 'fashion', label: 'Mode' },
        { value: 'business', label: 'Business' },
        { value: 'nature', label: 'Nature' },
        { value: 'art', label: 'Art' },
        { value: 'auto', label: 'Auto-détection' }
    ],

    // Tons disponibles
    tones: [
        { value: 'casual', label: 'Décontracté' },
        { value: 'professional', label: 'Professionnel' },
        { value: 'funny', label: 'Humoristique' },
        { value: 'inspirational', label: 'Inspirant' },
        { value: 'educational', label: 'Éducatif' }
    ],

    // Longueurs de légende
    captionLengths: [
        { value: 'short', label: 'Courte (50-80 mots)' },
        { value: 'medium', label: 'Moyenne (100-150 mots)' },
        { value: 'long', label: 'Longue (150-250 mots)' }
    ],

    // Styles de légende
    captionStyles: [
        { value: 'engaging', label: 'Engageant (questions)' },
        { value: 'storytelling', label: 'Storytelling (histoire)' },
        { value: 'informative', label: 'Informatif (facts)' },
        { value: 'motivational', label: 'Motivant (citation)' },
        { value: 'personal', label: 'Personnel (ressenti)' }
    ],

    // Sites supportés pour la sélection d'images
    supportedSites: [
        'instagram.com',
        'facebook.com',
        'twitter.com',
        'pinterest.com',
        'unsplash.com',
        'pexels.com'
    ],

    // Configuration UI
    ui: {
        toastDuration: 3000,
        animationDuration: 300,
        debounceDelay: 300
    },

    // Storage keys
    storage: {
        authToken: 'pip_auth_token',
        user: 'pip_user',
        settings: 'pip_settings',
        history: 'pip_history'
    }
};

// Helper pour construire les URLs d'API
APP_CONFIG.getApiUrl = function(endpoint) {
    const path = this.backend.endpoints[endpoint];
    if (!path) {
        console.warn(`Unknown endpoint: ${endpoint}`);
        return null;
    }
    return `${this.backend.baseUrl}${path}`;
};

// Helper pour vérifier si un format est supporté
APP_CONFIG.isFormatSupported = function(mimeType) {
    return this.limits.supportedFormats.includes(mimeType);
};

// Helper pour vérifier la taille du fichier
APP_CONFIG.isFileSizeValid = function(size) {
    return size <= this.limits.maxFileSize;
};

// Exporter pour utilisation dans d'autres scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APP_CONFIG;
}
