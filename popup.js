// Configuration et constantes
const CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    apiEndpoints: {
        openai: 'https://api.openai.com/v1/chat/completions',
        googleVision: 'https://vision.googleapis.com/v1/images:annotate'
    }
};

// État global de l'application
const AppState = {
    currentImage: null,
    apiKeys: {
        openai: null,
        googleVision: null
    },
    analysisResults: null
};

// Éléments DOM
const elements = {
    uploadArea: document.getElementById('uploadArea'),
    imageInput: document.getElementById('imageInput'),
    previewImage: document.getElementById('previewImage'),
    configSection: document.getElementById('configSection'),
    resultsSection: document.getElementById('resultsSection'),
    apiKeysSection: document.getElementById('apiKeysSection'),
    postType: document.getElementById('postType'),
    tone: document.getElementById('tone'),
    location: document.getElementById('location'),
    context: document.getElementById('context'),
    captionLength: document.getElementById('captionLength'),
    captionStyle: document.getElementById('captionStyle'),
    generateBtn: document.getElementById('generateBtn'),
    generatedCaption: document.getElementById('generatedCaption'),
    hashtagsContainer: document.getElementById('hashtagsContainer'),
    suggestionsList: document.getElementById('suggestionsList'),
    copyBtn: document.getElementById('copyBtn'),
    newPostBtn: document.getElementById('newPostBtn'),
    openaiKey: document.getElementById('openaiKey'),
    googleVisionKey: document.getElementById('googleVisionKey'),
    saveApiKeys: document.getElementById('saveApiKeys')
};

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', async () => {
    await loadApiKeys();
    setupEventListeners();
    checkFirstTimeUser();

    // Attendre que freemiumManager soit initialisé (défini dans freemium.js)
    if (typeof freemiumManager !== 'undefined') {
        console.log('✅ FreemiumManager initialisé');
    }

    // Reset de l'UI pour éviter les états incohérents
    setTimeout(() => {
        resetUI();
    }, 100);
});

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Upload d'image
    elements.uploadArea.addEventListener('click', () => elements.imageInput.click());
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('drop', handleDrop);
    elements.imageInput.addEventListener('change', handleFileSelect);

    // Génération
    elements.generateBtn.addEventListener('click', generatePost);

    // Actions
    elements.copyBtn.addEventListener('click', copyToClipboard);
    elements.newPostBtn.addEventListener('click', resetApp);
    elements.saveApiKeys.addEventListener('click', saveApiKeys);

    // Collapsible sections
    const advancedHeader = document.getElementById('advancedHeader');
    if (advancedHeader) {
        advancedHeader.addEventListener('click', toggleAdvancedSection);
    }

    // Freemium upgrade buttons
    const upgradeBtn = document.getElementById('upgradeBtn');
    const upgradeFromOverlay = document.getElementById('upgradeFromOverlay');

    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', () => freemiumManager.showUpgradeModal());
    }
    if (upgradeFromOverlay) {
        upgradeFromOverlay.addEventListener('click', () => freemiumManager.showUpgradeModal());
    }
}

// Toggle section avancée
function toggleAdvancedSection() {
    const content = document.getElementById('advancedContent');
    const icon = document.querySelector('.collapse-icon');

    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        icon.classList.remove('collapsed');
        icon.textContent = '▼';
    } else {
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
        icon.textContent = '▶';
    }
}

// Gestion des clés API
async function loadApiKeys() {
    try {
        const result = await chrome.storage.local.get(['openaiKey', 'googleVisionKey']);
        AppState.apiKeys.openai = result.openaiKey;
        AppState.apiKeys.googleVision = result.googleVisionKey;
    } catch (error) {
        console.error('Erreur lors du chargement des clés API:', error);
    }
}

function checkFirstTimeUser() {
    if (!AppState.apiKeys.openai || !AppState.apiKeys.googleVision) {
        showSection('apiKeysSection');
    }
}

async function saveApiKeys() {
    const openaiKey = elements.openaiKey.value.trim();
    const googleVisionKey = elements.googleVisionKey.value.trim();

    if (!openaiKey || !googleVisionKey) {
        showNotification('Veuillez saisir les deux clés API', 'error');
        return;
    }

    try {
        await chrome.storage.local.set({
            openaiKey: openaiKey,
            googleVisionKey: googleVisionKey
        });

        AppState.apiKeys.openai = openaiKey;
        AppState.apiKeys.googleVision = googleVisionKey;

        showNotification('Clés API sauvegardées avec succès!', 'success');
        hideSection('apiKeysSection');

    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        showNotification('Erreur lors de la sauvegarde', 'error');
    }
}

// Gestion des fichiers
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
}

function processFile(file) {
    // Validation du fichier
    if (!CONFIG.supportedFormats.includes(file.type)) {
        showNotification('Format non supporté. Utilisez JPG, PNG ou WebP.', 'error');
        return;
    }

    if (file.size > CONFIG.maxFileSize) {
        showNotification('Fichier trop volumineux. Maximum 10MB.', 'error');
        return;
    }

    // Lecture du fichier
    const reader = new FileReader();
    reader.onload = (e) => {
        AppState.currentImage = e.target.result;
        elements.previewImage.src = AppState.currentImage;
        elements.previewImage.hidden = false;
        elements.uploadArea.querySelector('.upload-placeholder').style.display = 'none';

        // Ajouter classe pour style compact
        elements.uploadArea.classList.add('has-image');
        elements.uploadArea.classList.remove('isolated');

        // Agrandir le popup
        document.body.classList.add('expanded');

        showSection('configSection');
        hideSection('resultsSection');
    };
    reader.readAsDataURL(file);
}

// Génération du post
async function generatePost() {
    console.log('🚀 Génération déclenchée explicitement');

    if (!AppState.currentImage) {
        showNotification('Veuillez d\'abord sélectionner une image', 'error');
        return;
    }

    // Vérification freemium
    if (!freemiumManager.canGeneratePost()) {
        const usage = freemiumManager.getUsageInfo();
        showNotification(`Limite atteinte ! Vous avez utilisé vos ${usage.postsLimit} posts gratuits ce mois.\n\nPassez à Pro pour débloquer 50 posts/mois !`, 'error');
        setTimeout(() => {
            freemiumManager.showUpgradeModal();
        }, 1000);
        return;
    }

    if (!AppState.apiKeys.openai || !AppState.apiKeys.googleVision) {
        showNotification('Clés API manquantes', 'error');
        checkFirstTimeUser();
        return;
    }

    // Protection contre les déclenchements multiples
    if (elements.generateBtn.disabled) {
        console.log('⚠️ Génération déjà en cours, arrêt');
        return;
    }

    setLoading(true);

    try {
        // 1. Analyser l'image avec Google Vision
        const imageAnalysis = await analyzeImage();
        AppState.analysisResults = imageAnalysis;

        // 2. Générer le contenu avec OpenAI
        const content = await generateContent(imageAnalysis);

        // 3. Afficher les résultats avec watermark freemium
        displayResults(content);
        showSection('resultsSection');

        // 4. Incrémenter l'usage freemium
        await freemiumManager.incrementUsage();

        // 5. Track analytics
        if (typeof analyticsManager !== 'undefined') {
            analyticsManager.trackPostGenerated(
                imageAnalysis,
                elements.postType.value,
                elements.tone.value,
                elements.location.value || elements.context.value
            );
        }

    } catch (error) {
        console.error('Erreur lors de la génération:', error);
        showNotification('Erreur lors de la génération: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Analyse d'image avec Google Vision API
async function analyzeImage() {
    const base64Image = AppState.currentImage.split(',')[1];

    const requestBody = {
        requests: [{
            image: {
                content: base64Image
            },
            features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 5 },
                { type: 'FACE_DETECTION', maxResults: 5 },
                { type: 'LANDMARK_DETECTION', maxResults: 5 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                { type: 'IMAGE_PROPERTIES', maxResults: 1 }
            ]
        }]
    };

    try {
        const response = await fetch(`${CONFIG.apiEndpoints.googleVision}?key=${AppState.apiKeys.googleVision}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google Vision API Error:', response.status, errorText);
            throw new Error(`Google Vision API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.responses && data.responses[0] && data.responses[0].error) {
            throw new Error(`Google Vision API Error: ${data.responses[0].error.message}`);
        }

        return parseVisionResults(data.responses[0]);
    } catch (error) {
        console.error('Erreur détaillée Vision API:', error);
        // Fallback : analyse basique sans Vision API
        return createFallbackAnalysis();
    }
}

// Analyse de fallback si Google Vision échoue
function createFallbackAnalysis() {
    console.log('Utilisation de l\'analyse de fallback');
    return {
        labels: [
            { description: 'Image', score: 0.9 },
            { description: 'Photo', score: 0.8 },
            { description: 'Content', score: 0.7 }
        ],
        objects: ['Object'],
        faces: 0,
        text: '',
        landmarks: [],
        colors: [
            { red: 128, green: 128, blue: 128 }
        ]
    };
}

// Parsing des résultats de Vision API
function parseVisionResults(visionResponse) {
    const analysis = {
        labels: [],
        objects: [],
        faces: visionResponse.faceAnnotations?.length || 0,
        text: '',
        landmarks: [],
        colors: []
    };

    // Labels
    if (visionResponse.labelAnnotations) {
        analysis.labels = visionResponse.labelAnnotations.map(label => ({
            description: label.description,
            score: label.score
        }));
    }

    // Objets
    if (visionResponse.localizedObjectAnnotations) {
        analysis.objects = visionResponse.localizedObjectAnnotations.map(obj => obj.name);
    }

    // Texte
    if (visionResponse.textAnnotations && visionResponse.textAnnotations.length > 0) {
        analysis.text = visionResponse.textAnnotations[0].description;
    }

    // Landmarks
    if (visionResponse.landmarkAnnotations) {
        analysis.landmarks = visionResponse.landmarkAnnotations.map(landmark => landmark.description);
    }

    // Couleurs dominantes
    if (visionResponse.imagePropertiesAnnotation?.dominantColors?.colors) {
        analysis.colors = visionResponse.imagePropertiesAnnotation.dominantColors.colors
            .slice(0, 3)
            .map(colorInfo => colorInfo.color);
    }

    return analysis;
}

// Génération de contenu avec OpenAI
async function generateContent(analysis) {
    const postType = elements.postType.value;
    const tone = elements.tone.value;
    const location = elements.location.value.trim();
    const context = elements.context.value.trim();
    const captionLength = elements.captionLength.value;
    const captionStyle = elements.captionStyle.value;

    // Construction du prompt avancé
    let contextualInfo = '';
    if (location) {
        contextualInfo += `\n- Lieu/Localisation: ${location}`;
    }
    if (context) {
        contextualInfo += `\n- Contexte/Situation: ${context}`;
    }

    // Instructions de longueur
    const lengthInstructions = {
        'short': '50-80 mots, concis et impactant',
        'medium': '100-150 mots, équilibré',
        'long': '150-250 mots, détaillé et narratif'
    };

    // Instructions de style
    const styleInstructions = {
        'engaging': 'Pose des questions engageantes, interpelle directement l\'audience',
        'storytelling': 'Raconte une histoire, crée une narration captivante',
        'informative': 'Partage des informations utiles, des faits intéressants',
        'motivational': 'Inspire et motive, utilise des citations ou affirmations positives',
        'personal': 'Exprime des sentiments personnels, partage une expérience intime'
    };

    const systemPrompt = `Tu es un expert en marketing Instagram. Tu dois générer un post Instagram parfait basé sur l'analyse d'image fournie.

Analyse de l'image:
- Labels détectés: ${analysis.labels.map(l => l.description).join(', ')}
- Objets: ${analysis.objects.join(', ')}
- Texte dans l'image: ${analysis.text}
- Nombre de visages: ${analysis.faces}
- Landmarks: ${analysis.landmarks.join(', ')}

Paramètres demandés:
- Type de post: ${postType}
- Ton: ${tone}
- Longueur: ${lengthInstructions[captionLength]}
- Style: ${styleInstructions[captionStyle]}${contextualInfo}

Génère une réponse JSON avec cette structure exacte:
{
  "caption": "Légende engageante de 100-200 mots avec emojis appropriés",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6", "hashtag7", "hashtag8", "hashtag9", "hashtag10"],
  "suggestions": ["Suggestion 1 pour améliorer l'engagement", "Suggestion 2", "Suggestion 3"]
}

Important:
- Utilise des hashtags populaires mais pas trop génériques
- Inclus des hashtags de niche pertinents${location ? `\n- Ajoute des hashtags géolocalisés pour: ${location}` : ''}
- La légende doit être authentique et engageante
- Adapte le style au ton demandé et au contexte fourni
- Inclus des call-to-action subtiles
- Respecte strictement la longueur et le style demandés`;

    try {
        const response = await fetch(CONFIG.apiEndpoints.openai, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AppState.apiKeys.openai}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'Génère le post Instagram parfait pour cette image.' }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API Error:', response.status, errorText);
            throw new Error(`OpenAI API Error: ${response.status} - Vérifiez votre clé API et votre crédit`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`OpenAI Error: ${data.error.message}`);
        }

        const content = data.choices[0].message.content;
        console.log('Réponse OpenAI:', content);

        try {
            return JSON.parse(content);
        } catch (parseError) {
            console.error('Erreur parsing JSON:', parseError);
            // Fallback si le JSON est malformé
            return createFallbackContent(content);
        }
    } catch (error) {
        console.error('Erreur OpenAI complète:', error);
        throw error;
    }
}

// Contenu de fallback si OpenAI retourne du JSON invalide
function createFallbackContent(rawContent) {
    return {
        caption: rawContent || "Voici une belle image qui mérite d'être partagée ! ✨ #inspiration #lifestyle",
        hashtags: ["lifestyle", "inspiration", "photography", "beautiful", "mood", "vibes", "content", "share", "love", "amazing"],
        suggestions: [
            "Ajoutez une story pour plus d'engagement",
            "Postez aux heures de forte affluence",
            "Engagez avec votre communauté en commentaires"
        ]
    };
}

// Affichage des résultats
function displayResults(content) {
    // Appliquer watermark freemium si nécessaire
    const finalCaption = freemiumManager.addWatermarkToPost(content.caption);

    // Légende
    elements.generatedCaption.value = finalCaption;

    // Hashtags
    elements.hashtagsContainer.innerHTML = '';
    content.hashtags.forEach(hashtag => {
        const hashtagElement = document.createElement('span');
        hashtagElement.className = 'hashtag';
        hashtagElement.textContent = `#${hashtag}`;
        elements.hashtagsContainer.appendChild(hashtagElement);
    });

    // Suggestions
    elements.suggestionsList.innerHTML = '';
    content.suggestions.forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        elements.suggestionsList.appendChild(li);
    });
}

// Actions utilisateur
async function copyToClipboard() {
    const caption = elements.generatedCaption.value;
    const hashtags = Array.from(elements.hashtagsContainer.children)
        .map(span => span.textContent)
        .join(' ');

    const fullText = `${caption}\n\n${hashtags}`;

    try {
        await navigator.clipboard.writeText(fullText);
        elements.copyBtn.textContent = '✅ Copié!';
        elements.copyBtn.classList.add('success');

        // Track copy event
        if (typeof analyticsManager !== 'undefined') {
            analyticsManager.trackFeatureUsage('copy_post', {
                caption_length: caption.length,
                hashtag_count: elements.hashtagsContainer.children.length
            });
        }

        setTimeout(() => {
            elements.copyBtn.textContent = '📋 Copier tout';
            elements.copyBtn.classList.remove('success');
        }, 2000);
    } catch (error) {
        showNotification('Erreur lors de la copie', 'error');
    }
}

function resetApp() {
    AppState.currentImage = null;
    AppState.analysisResults = null;

    elements.imageInput.value = '';
    elements.previewImage.hidden = true;
    elements.previewImage.src = '';
    elements.uploadArea.querySelector('.upload-placeholder').style.display = 'block';

    // Retirer la classe compact et ajouter isolated
    elements.uploadArea.classList.remove('has-image');
    elements.uploadArea.classList.add('isolated');

    // Réduire le popup
    document.body.classList.remove('expanded');

    hideSection('configSection');
    hideSection('resultsSection');
}

// Utilitaires UI
function showSection(sectionId) {
    elements[sectionId].hidden = false;
}

function hideSection(sectionId) {
    elements[sectionId].hidden = true;
}

function setLoading(loading) {
    elements.generateBtn.disabled = loading;
    const btnText = elements.generateBtn.querySelector('.btn-text');
    const loader = elements.generateBtn.querySelector('.loader');

    if (loading) {
        btnText.textContent = '⏳ Génération en cours...';
        if (loader) loader.hidden = false;
    } else {
        btnText.textContent = '✨ Générer le post';
        if (loader) loader.hidden = true;
    }
}

// Fonction pour s'assurer que l'état initial est correct
function resetUI() {
    console.log('🔄 Reset UI état initial');

    // S'assurer que le bouton n'est pas en loading
    elements.generateBtn.disabled = false;

    const btnText = elements.generateBtn.querySelector('.btn-text');
    const loader = elements.generateBtn.querySelector('.loader');

    if (btnText) btnText.textContent = '✨ Générer le post';
    if (loader) loader.hidden = true;

    // Initialiser l'upload area comme isolée
    elements.uploadArea.classList.add('isolated');
}

function showNotification(message, type = 'info') {
    // Implémentation simple avec alert pour l'instant
    // À améliorer avec une notification toast personnalisée
    alert(message);
}