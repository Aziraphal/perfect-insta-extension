// =============================================================================
// PERFECT INSTA POST - HISTORY SERVICE (IndexedDB)
// Sauvegarde locale des analyses et posts générés
// =============================================================================

const HistoryDB = {
    dbName: 'PerfectInstaHistory',
    dbVersion: 1,
    storeName: 'analyses',
    db: null,

    // Initialiser la base de données
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ HistoryDB initialisé');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Créer le store pour les analyses
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });

                    // Index pour recherche par date
                    store.createIndex('date', 'date', { unique: false });
                    // Index pour recherche par type
                    store.createIndex('type', 'type', { unique: false });

                    console.log('📦 Store "analyses" créé');
                }
            };
        });
    },

    // Sauvegarder une analyse
    async save(data) {
        if (!this.db) await this.init();

        const entry = {
            date: new Date().toISOString(),
            timestamp: Date.now(),
            type: data.type || 'post',
            image: data.image, // Base64 thumbnail
            caption: data.caption,
            hashtags: data.hashtags || [],
            suggestions: data.suggestions || [],
            analysis: data.analysis || null,
            settings: {
                postType: data.postType,
                tone: data.tone,
                location: data.location,
                context: data.context
            }
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(entry);

            request.onsuccess = () => {
                console.log('💾 Analyse sauvegardée:', request.result);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Récupérer toutes les analyses (les plus récentes en premier)
    async getAll(limit = 50) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                let results = request.result || [];
                // Trier par date décroissante
                results.sort((a, b) => b.timestamp - a.timestamp);
                // Limiter le nombre de résultats
                results = results.slice(0, limit);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Récupérer une analyse par ID
    async getById(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Supprimer une analyse
    async delete(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log('🗑️ Analyse supprimée:', id);
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Vider tout l'historique
    async clearAll() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('🧹 Historique vidé');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    },

    // Compter le nombre d'entrées
    async count() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Créer une miniature de l'image (pour économiser l'espace)
    createThumbnail(base64Image, maxWidth = 200) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ratio = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * ratio;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = base64Image;
        });
    }
};

// =============================================================================
// HISTORY UI CONTROLLER
// =============================================================================

const HistoryUI = {
    container: null,
    isOpen: false,

    // Initialiser l'UI
    init() {
        this.container = document.getElementById('historySection');
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Bouton pour ouvrir/fermer l'historique
        const historyBtn = document.getElementById('historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => this.toggle());
        }

        // Bouton pour vider l'historique
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearAll());
        }
    },

    // Afficher/masquer l'historique
    async toggle() {
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            await this.render();
            this.container?.classList.remove('hidden');
        } else {
            this.container?.classList.add('hidden');
        }
    },

    // Rendre la liste d'historique
    async render() {
        if (!this.container) return;

        const entries = await HistoryDB.getAll(20);
        const listContainer = document.getElementById('historyList');

        if (!listContainer) return;

        if (entries.length === 0) {
            listContainer.innerHTML = `
                <div class="history-empty">
                    <span class="history-empty-icon">📭</span>
                    <p>Aucun historique</p>
                    <small>Vos analyses apparaîtront ici</small>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = entries.map(entry => `
            <div class="history-item" data-id="${entry.id}">
                <div class="history-item-image">
                    <img src="${entry.image}" alt="Preview">
                </div>
                <div class="history-item-content">
                    <div class="history-item-date">${this.formatDate(entry.date)}</div>
                    <div class="history-item-caption">${this.truncate(entry.caption, 60)}</div>
                    <div class="history-item-tags">
                        ${entry.hashtags.slice(0, 3).map(h => `<span class="mini-tag">${h}</span>`).join('')}
                        ${entry.hashtags.length > 3 ? `<span class="mini-tag more">+${entry.hashtags.length - 3}</span>` : ''}
                    </div>
                </div>
                <div class="history-item-actions">
                    <button class="history-action-btn" onclick="HistoryUI.load(${entry.id})" title="Charger">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                        </svg>
                    </button>
                    <button class="history-action-btn delete" onclick="HistoryUI.deleteEntry(${entry.id})" title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Charger une entrée de l'historique
    async load(id) {
        const entry = await HistoryDB.getById(id);
        if (!entry) return;

        // Remplir les champs avec les données sauvegardées
        if (entry.image) {
            const previewImage = document.getElementById('previewImage');
            const uploadArea = document.getElementById('uploadArea');
            if (previewImage && uploadArea) {
                previewImage.src = entry.image;
                previewImage.hidden = false;
                uploadArea.classList.add('has-image');
                document.querySelector('.upload-placeholder')?.classList.add('hidden');
            }
        }

        if (entry.caption) {
            const captionEl = document.getElementById('generatedCaption');
            if (captionEl) captionEl.value = entry.caption;
        }

        if (entry.hashtags) {
            const hashtagsContainer = document.getElementById('hashtagsContainer');
            if (hashtagsContainer) {
                hashtagsContainer.innerHTML = entry.hashtags
                    .map(h => `<span class="hashtag">${h}</span>`)
                    .join('');
            }
        }

        // Afficher la section résultats
        document.getElementById('configSection')?.classList.remove('hidden');
        document.getElementById('resultsSection')?.classList.remove('hidden');

        // Fermer l'historique
        this.toggle();

        showNotification('Analyse chargée depuis l\'historique', 'success');
    },

    // Supprimer une entrée
    async deleteEntry(id) {
        if (confirm('Supprimer cette entrée de l\'historique ?')) {
            await HistoryDB.delete(id);
            await this.render();
            showNotification('Entrée supprimée', 'success');
        }
    },

    // Vider tout l'historique
    async clearAll() {
        if (confirm('Vider tout l\'historique ? Cette action est irréversible.')) {
            await HistoryDB.clearAll();
            await this.render();
            showNotification('Historique vidé', 'success');
        }
    },

    // Formater la date
    formatDate(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;

        // Moins d'une heure
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `Il y a ${mins} min`;
        }

        // Moins d'un jour
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `Il y a ${hours}h`;
        }

        // Moins d'une semaine
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `Il y a ${days}j`;
        }

        // Plus ancien
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short'
        });
    },

    // Tronquer le texte
    truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};

// Initialiser au chargement
document.addEventListener('DOMContentLoaded', () => {
    HistoryDB.init().then(() => {
        HistoryUI.init();
        console.log('✅ History module initialisé');
    });
});
