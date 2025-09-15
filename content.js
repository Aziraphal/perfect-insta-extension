// Content Script pour Perfect Insta Post
// S'exécute dans le contexte des pages web visitées

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        imageSelectors: [
            'img',
            '[style*="background-image"]',
            'picture img',
            'figure img'
        ],
        minImageSize: 200, // Taille minimale en pixels
        supportedHosts: [
            'instagram.com',
            'facebook.com',
            'twitter.com',
            'pinterest.com',
            'unsplash.com',
            'pexels.com'
        ]
    };

    // État du content script
    let isActive = false;
    let selectedImages = [];
    let overlayElement = null;

    // Initialisation
    function init() {
        // Écouter les messages du popup
        chrome.runtime.onMessage.addListener(handleMessage);

        // Détecter si on est sur une page supportée
        if (isSupportedPage()) {
            console.log('Perfect Insta Post: Page supportée détectée');
        }
    }

    // Gestion des messages
    function handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'detectImages':
                const images = detectImages();
                sendResponse({ success: true, images: images });
                break;

            case 'startImageSelection':
                startImageSelection();
                sendResponse({ success: true });
                break;

            case 'stopImageSelection':
                stopImageSelection();
                sendResponse({ success: true });
                break;

            case 'getSelectedImage':
                if (selectedImages.length > 0) {
                    sendResponse({ success: true, image: selectedImages[0] });
                } else {
                    sendResponse({ success: false, error: 'Aucune image sélectionnée' });
                }
                break;

            default:
                sendResponse({ success: false, error: 'Action inconnue' });
        }
    }

    // Détection des images sur la page
    function detectImages() {
        const images = [];

        CONFIG.imageSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);

            elements.forEach(element => {
                const imageData = extractImageData(element);
                if (imageData && isValidImage(imageData)) {
                    images.push(imageData);
                }
            });
        });

        return images.slice(0, 20); // Limiter à 20 images max
    }

    // Extraction des données d'image
    function extractImageData(element) {
        let src = '';
        let alt = '';
        let width = 0;
        let height = 0;

        if (element.tagName === 'IMG') {
            src = element.src || element.dataset.src || element.dataset.lazySrc;
            alt = element.alt || '';
            width = element.naturalWidth || element.width;
            height = element.naturalHeight || element.height;
        } else {
            // Pour les éléments avec background-image
            const style = window.getComputedStyle(element);
            const backgroundImage = style.backgroundImage;

            if (backgroundImage && backgroundImage !== 'none') {
                const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (urlMatch) {
                    src = urlMatch[1];
                    width = element.offsetWidth;
                    height = element.offsetHeight;
                }
            }
        }

        if (!src) return null;

        return {
            src: src,
            alt: alt,
            width: width,
            height: height,
            element: element,
            position: getElementPosition(element)
        };
    }

    // Validation de l'image
    function isValidImage(imageData) {
        // Vérifier la taille minimale
        if (imageData.width < CONFIG.minImageSize || imageData.height < CONFIG.minImageSize) {
            return false;
        }

        // Vérifier les formats supportés
        const url = new URL(imageData.src, window.location.origin);
        const extension = url.pathname.split('.').pop().toLowerCase();

        if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
            return false;
        }

        // Exclure les images système/UI
        if (imageData.alt && imageData.alt.toLowerCase().includes('logo')) {
            return false;
        }

        return true;
    }

    // Mode sélection d'images
    function startImageSelection() {
        if (isActive) return;

        isActive = true;
        selectedImages = [];

        // Créer l'overlay
        createOverlay();

        // Ajouter les écouteurs d'événements
        document.addEventListener('click', handleImageClick, true);
        document.addEventListener('mouseover', handleImageHover, true);
        document.addEventListener('mouseout', handleImageOut, true);

        // Mettre en surbrillance les images détectées
        highlightImages();

        showNotification('Cliquez sur une image pour la sélectionner', 'info');
    }

    function stopImageSelection() {
        if (!isActive) return;

        isActive = false;

        // Supprimer les écouteurs
        document.removeEventListener('click', handleImageClick, true);
        document.removeEventListener('mouseover', handleImageHover, true);
        document.removeEventListener('mouseout', handleImageOut, true);

        // Nettoyer l'interface
        removeHighlights();
        removeOverlay();
    }

    // Gestion des événements de sélection
    function handleImageClick(event) {
        const element = event.target;
        const imageData = extractImageData(element);

        if (imageData && isValidImage(imageData)) {
            event.preventDefault();
            event.stopPropagation();

            selectedImages = [imageData];
            element.classList.add('perfect-insta-selected');

            showNotification('Image sélectionnée! Ouvrez l\'extension pour continuer.', 'success');

            // Notifier le popup
            chrome.runtime.sendMessage({
                action: 'imageSelected',
                image: imageData
            });

            setTimeout(() => stopImageSelection(), 1000);
        }
    }

    function handleImageHover(event) {
        const element = event.target;
        if (element.tagName === 'IMG' || hasBackgroundImage(element)) {
            element.classList.add('perfect-insta-hover');
        }
    }

    function handleImageOut(event) {
        const element = event.target;
        element.classList.remove('perfect-insta-hover');
    }

    // Interface utilisateur
    function createOverlay() {
        overlayElement = document.createElement('div');
        overlayElement.id = 'perfect-insta-overlay';
        overlayElement.innerHTML = `
            <div class="perfect-insta-toolbar">
                <span>Perfect Insta Post - Sélectionnez une image</span>
                <button id="perfect-insta-cancel">❌ Annuler</button>
            </div>
        `;

        // Styles CSS
        const styles = `
            #perfect-insta-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 999999;
                pointer-events: none;
            }
            .perfect-insta-toolbar {
                background: linear-gradient(45deg, #e4405f, #833ab4);
                color: white;
                padding: 10px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                pointer-events: auto;
            }
            #perfect-insta-cancel {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
            }
            #perfect-insta-cancel:hover {
                background: rgba(255,255,255,0.3);
            }
            .perfect-insta-highlight {
                outline: 3px solid #e4405f !important;
                outline-offset: 2px !important;
                cursor: pointer !important;
            }
            .perfect-insta-hover {
                outline: 3px solid #f77737 !important;
                outline-offset: 2px !important;
            }
            .perfect-insta-selected {
                outline: 3px solid #27ae60 !important;
                outline-offset: 2px !important;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);

        document.body.appendChild(overlayElement);

        // Écouteur pour le bouton annuler
        document.getElementById('perfect-insta-cancel').addEventListener('click', stopImageSelection);
    }

    function removeOverlay() {
        if (overlayElement) {
            overlayElement.remove();
            overlayElement = null;
        }
    }

    function highlightImages() {
        const images = detectImages();
        images.forEach(imageData => {
            imageData.element.classList.add('perfect-insta-highlight');
        });
    }

    function removeHighlights() {
        const highlightedElements = document.querySelectorAll('.perfect-insta-highlight, .perfect-insta-hover, .perfect-insta-selected');
        highlightedElements.forEach(element => {
            element.classList.remove('perfect-insta-highlight', 'perfect-insta-hover', 'perfect-insta-selected');
        });
    }

    // Utilitaires
    function isSupportedPage() {
        const hostname = window.location.hostname;
        return CONFIG.supportedHosts.some(host => hostname.includes(host));
    }

    function hasBackgroundImage(element) {
        const style = window.getComputedStyle(element);
        return style.backgroundImage && style.backgroundImage !== 'none';
    }

    function getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `perfect-insta-notification ${type}`;
        notification.textContent = message;

        const styles = `
            .perfect-insta-notification {
                position: fixed;
                top: 60px;
                right: 20px;
                background: #333;
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 13px;
                z-index: 1000000;
                animation: slideIn 0.3s ease;
            }
            .perfect-insta-notification.success {
                background: #27ae60;
            }
            .perfect-insta-notification.error {
                background: #e74c3c;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;

        if (!document.getElementById('perfect-insta-notification-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'perfect-insta-notification-styles';
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Démarrage
    init();
})();