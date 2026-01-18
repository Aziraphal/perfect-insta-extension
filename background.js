// =============================================================================
// PERFECT INSTA POST - SERVICE WORKER (BACKGROUND.JS)
// Gestion de l'authentification Google OAuth avec chrome.identity
// Utilise APP_CONFIG depuis config.js
// =============================================================================

// Importer la configuration centralisée
importScripts('config.js');

// Alias pour compatibilité avec l'ancien code
const CONFIG = {
    backend: APP_CONFIG.backend
};

// État global du service worker
let authState = {
    isAuthenticated: false,
    jwtToken: null,
    user: null
};

// =============================================================================
// INITIALISATION DU SERVICE WORKER
// =============================================================================

// Charger l'état d'authentification au démarrage du service worker
chrome.runtime.onStartup.addListener(async () => {
    console.log('🚀 Perfect Insta Service Worker - Startup');
    await loadAuthState();
});

chrome.runtime.onInstalled.addListener(async () => {
    console.log('🚀 Perfect Insta Service Worker - Installed');
    await loadAuthState();
});

// Charger l'état d'authentification depuis chrome.storage
async function loadAuthState() {
    try {
        const stored = await chrome.storage.local.get(['jwtToken', 'user']);
        if (stored.jwtToken && stored.user) {
            authState.jwtToken = stored.jwtToken;
            authState.user = stored.user;
            authState.isAuthenticated = true;
            console.log('✅ Auth state chargé:', stored.user.email);

            // Valider le token avec le backend
            await validateToken();
        } else {
            console.log('🔍 Aucun état d\'auth trouvé');
            authState.isAuthenticated = false;
        }
    } catch (error) {
        console.error('❌ Erreur chargement auth state:', error);
        authState.isAuthenticated = false;
    }
}

// =============================================================================
// GESTION DES MESSAGES DEPUIS LE POPUP
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Message reçu:', message.type);

    switch (message.type) {
        case 'LOGIN':
            handleLogin(sendResponse);
            return true; // Réponse asynchrone

        case 'GET_AUTH':
            sendResponse({
                isAuthenticated: authState.isAuthenticated,
                token: authState.jwtToken,
                user: authState.user
            });
            return false;

        case 'LOGOUT':
            handleLogout(sendResponse);
            return true; // Réponse asynchrone

        case 'VALIDATE_TOKEN':
            validateToken().then(() => {
                sendResponse({
                    isAuthenticated: authState.isAuthenticated,
                    user: authState.user
                });
            });
            return true; // Réponse asynchrone

        default:
            console.warn('⚠️ Type de message non reconnu:', message.type);
            sendResponse({ success: false, error: 'Type de message non reconnu' });
            return false;
    }
});

// =============================================================================
// AUTHENTIFICATION GOOGLE OAUTH
// =============================================================================

async function handleLogin(sendResponse) {
    try {
        console.log('🔐 Démarrage du flow OAuth...');

        // Obtenir l'URL de redirection Chrome
        const redirectUri = chrome.identity.getRedirectURL('oauth2');
        console.log('📍 Redirect URI:', redirectUri);

        // Construire l'URL d'auth vers notre backend
        const authUrl = `${CONFIG.backend.baseUrl}${CONFIG.backend.endpoints.auth}?redirect_uri=${encodeURIComponent(redirectUri)}`;
        console.log('🌐 Auth URL:', authUrl);

        // Lancer le flow OAuth avec chrome.identity
        chrome.identity.launchWebAuthFlow(
            {
                url: authUrl,
                interactive: true
            },
            async (redirectedTo) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Erreur OAuth:', chrome.runtime.lastError);
                    sendResponse({
                        success: false,
                        error: chrome.runtime.lastError.message
                    });
                    return;
                }

                if (!redirectedTo) {
                    console.error('❌ Aucune URL de redirection reçue');
                    sendResponse({
                        success: false,
                        error: 'Aucune URL de redirection reçue'
                    });
                    return;
                }

                console.log('🔗 Redirection reçue:', redirectedTo);

                // Extraire le token depuis l'URL de redirection
                // Format attendu: https://extensionid.chromiumapp.org/oauth2#token=JWT_TOKEN&user=USER_DATA
                try {
                    const url = new URL(redirectedTo);
                    const hash = url.hash.substring(1); // Enlever le #
                    const params = new URLSearchParams(hash);

                    const token = params.get('token');
                    const userStr = params.get('user');

                    if (!token || !userStr) {
                        throw new Error('Token ou données utilisateur manquants dans la réponse');
                    }

                    const user = JSON.parse(decodeURIComponent(userStr));

                    // Sauvegarder l'état d'auth
                    await saveAuthState(token, user);

                    console.log('✅ Connexion réussie:', user.email);
                    sendResponse({
                        success: true,
                        token: token,
                        user: user
                    });

                } catch (parseError) {
                    console.error('❌ Erreur parsing réponse OAuth:', parseError);
                    sendResponse({
                        success: false,
                        error: 'Erreur lors du traitement de la réponse OAuth: ' + parseError.message
                    });
                }
            }
        );

    } catch (error) {
        console.error('❌ Erreur générale lors du login:', error);
        sendResponse({
            success: false,
            error: 'Erreur générale: ' + error.message
        });
    }
}

// Sauvegarder l'état d'authentification
async function saveAuthState(token, user) {
    try {
        // Sauvegarder en local
        await chrome.storage.local.set({
            jwtToken: token,
            user: user
        });

        // Mettre à jour l'état du service worker
        authState.jwtToken = token;
        authState.user = user;
        authState.isAuthenticated = true;

        console.log('💾 État d\'auth sauvegardé pour:', user.email);
    } catch (error) {
        console.error('❌ Erreur sauvegarde auth state:', error);
        throw error;
    }
}

// =============================================================================
// DÉCONNEXION
// =============================================================================

async function handleLogout(sendResponse) {
    try {
        console.log('🚪 Déconnexion en cours...');

        // Supprimer de chrome.storage
        await chrome.storage.local.remove(['jwtToken', 'user']);

        // Reset de l'état du service worker
        authState.jwtToken = null;
        authState.user = null;
        authState.isAuthenticated = false;

        console.log('✅ Déconnexion réussie');
        sendResponse({ success: true });

    } catch (error) {
        console.error('❌ Erreur lors de la déconnexion:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// =============================================================================
// VALIDATION TOKEN
// =============================================================================

async function validateToken() {
    if (!authState.jwtToken) {
        authState.isAuthenticated = false;
        return;
    }

    try {
        console.log('🔍 Validation du token...');

        const response = await fetch(`${CONFIG.backend.baseUrl}${CONFIG.backend.endpoints.userMe}`, {
            headers: {
                'Authorization': `Bearer ${authState.jwtToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            authState.user = data.user;
            authState.isAuthenticated = true;
            console.log('✅ Token valide, utilisateur:', data.user.email);

            // Mettre à jour le storage avec les nouvelles données
            await chrome.storage.local.set({ user: data.user });
        } else {
            console.warn('⚠️ Token invalide, déconnexion...');
            await handleLogout(() => {});
        }
    } catch (error) {
        console.error('❌ Erreur validation token:', error);
        // Ne pas déconnecter automatiquement en cas d'erreur réseau
    }
}

// =============================================================================
// VALIDATION PÉRIODIQUE DU TOKEN
// =============================================================================

// Valider le token toutes les 30 minutes
setInterval(async () => {
    if (authState.isAuthenticated) {
        console.log('🔄 Validation périodique du token...');
        await validateToken();
    }
}, 30 * 60 * 1000); // 30 minutes

console.log('🎯 Perfect Insta Service Worker initialisé');