// Service Worker pour Perfect Insta Post
// Gère les événements en arrière-plan de l'extension

// Installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Perfect Insta Post installé avec succès!');

        // Ouvrir une page de bienvenue (optionnel)
        // chrome.tabs.create({
        //     url: 'welcome.html'
        // });
    } else if (details.reason === 'update') {
        console.log('Perfect Insta Post mis à jour vers la version', chrome.runtime.getManifest().version);
    }
});

// Gestion des messages depuis le popup ou content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'analyzeImage':
            handleImageAnalysis(request.data)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Indique que la réponse sera asynchrone

        case 'generateContent':
            handleContentGeneration(request.data)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'getStoredKeys':
            getStoredApiKeys()
                .then(keys => sendResponse({ success: true, data: keys }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        default:
            console.warn('Action inconnue:', request.action);
            sendResponse({ success: false, error: 'Action inconnue' });
    }
});

// Fonctions utilitaires
async function handleImageAnalysis(imageData) {
    try {
        // Cette fonction peut être utilisée pour traiter l'image côté background
        // si nécessaire (par exemple pour des traitements lourds)

        const result = await analyzeImageWithVision(imageData);
        return result;
    } catch (error) {
        console.error('Erreur analyse image:', error);
        throw error;
    }
}

async function handleContentGeneration(analysisData) {
    try {
        // Génération de contenu côté background si nécessaire
        const content = await generateWithOpenAI(analysisData);
        return content;
    } catch (error) {
        console.error('Erreur génération contenu:', error);
        throw error;
    }
}

async function getStoredApiKeys() {
    try {
        const result = await chrome.storage.local.get(['openaiKey', 'googleVisionKey']);
        return {
            openai: result.openaiKey || null,
            googleVision: result.googleVisionKey || null
        };
    } catch (error) {
        console.error('Erreur récupération clés:', error);
        throw error;
    }
}

async function analyzeImageWithVision(imageData) {
    // Implémentation de l'analyse d'image si déplacée côté background
    // Pour l'instant, cette logique reste dans popup.js
    return { placeholder: 'Analysis from background' };
}

async function generateWithOpenAI(analysisData) {
    // Implémentation de la génération OpenAI si déplacée côté background
    // Pour l'instant, cette logique reste dans popup.js
    return { placeholder: 'Content from background' };
}

// Gestion des erreurs globales
chrome.runtime.onSuspend.addListener(() => {
    console.log('Service Worker suspendu');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension démarrée');
});

// Nettoyage des données anciennes (optionnel)
// Peut être utilisé pour nettoyer les données stockées anciennes
chrome.runtime.onInstalled.addListener(() => {
    // Nettoyer les anciennes données si nécessaire
    cleanupOldData();
});

async function cleanupOldData() {
    try {
        // Exemple : supprimer les données de plus de 30 jours
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        const allData = await chrome.storage.local.get();
        const keysToRemove = [];

        for (const [key, value] of Object.entries(allData)) {
            if (key.startsWith('temp_') && value.timestamp < thirtyDaysAgo) {
                keysToRemove.push(key);
            }
        }

        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`Nettoyage: ${keysToRemove.length} éléments supprimés`);
        }
    } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
    }
}