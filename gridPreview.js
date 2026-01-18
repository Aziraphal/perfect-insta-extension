// =============================================================================
// PERFECT INSTA POST - GRID PREVIEW
// Prévisualisation de l'image dans un feed Instagram simulé
// =============================================================================

const GridPreview = {
    modal: null,
    isOpen: false,

    // Ouvrir le preview
    open(newImage) {
        this.createModal(newImage);
        this.modal.classList.add('show');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
    },

    // Fermer le preview
    close() {
        if (this.modal) {
            this.modal.classList.remove('show');
            setTimeout(() => {
                this.modal?.remove();
                this.modal = null;
            }, 300);
        }
        this.isOpen = false;
        document.body.style.overflow = '';
    },

    // Créer le modal
    createModal(newImage) {
        // Supprimer l'ancien modal s'il existe
        this.modal?.remove();

        const modal = document.createElement('div');
        modal.className = 'grid-preview-modal';
        modal.innerHTML = `
            <div class="grid-preview-overlay" onclick="GridPreview.close()"></div>
            <div class="grid-preview-container">
                <div class="grid-preview-header">
                    <h3>📱 Aperçu du Feed</h3>
                    <button class="grid-preview-close" onclick="GridPreview.close()">✕</button>
                </div>
                <div class="grid-preview-phone">
                    <div class="phone-notch"></div>
                    <div class="phone-header">
                        <span class="phone-username">@votre_compte</span>
                        <span class="phone-posts">127 posts</span>
                    </div>
                    <div class="grid-preview-grid" id="gridPreviewGrid">
                        ${this.generateGridHTML(newImage)}
                    </div>
                </div>
                <div class="grid-preview-actions">
                    <button class="grid-action-btn" onclick="GridPreview.shufflePosition()">
                        🔀 Changer position
                    </button>
                    <button class="grid-action-btn primary" onclick="GridPreview.close()">
                        ✓ C'est parfait
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.modal = modal;

        // Animation d'entrée
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    },

    // Générer le HTML de la grille
    generateGridHTML(newImage) {
        const placeholderImages = this.getPlaceholderImages();
        let grid = '';

        // La nouvelle image est en position 0 (première)
        for (let i = 0; i < 9; i++) {
            if (i === 0) {
                grid += `
                    <div class="grid-item new-image">
                        <img src="${newImage}" alt="Nouvelle photo">
                        <div class="new-badge">NEW</div>
                    </div>
                `;
            } else {
                grid += `
                    <div class="grid-item placeholder">
                        <div class="placeholder-bg" style="background: ${placeholderImages[i - 1]}"></div>
                    </div>
                `;
            }
        }

        return grid;
    },

    // Générer des images placeholder (gradients)
    getPlaceholderImages() {
        const gradients = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
            'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'
        ];
        return gradients;
    },

    // Changer la position de l'image dans la grille
    shufflePosition() {
        const grid = document.getElementById('gridPreviewGrid');
        if (!grid) return;

        const items = Array.from(grid.children);
        const newImageItem = items.find(item => item.classList.contains('new-image'));

        if (!newImageItem) return;

        // Retirer l'élément
        newImageItem.remove();

        // Nouvelle position aléatoire (0-8)
        const newPosition = Math.floor(Math.random() * 9);

        // Réinsérer à la nouvelle position
        if (newPosition >= items.length - 1) {
            grid.appendChild(newImageItem);
        } else {
            grid.insertBefore(newImageItem, grid.children[newPosition]);
        }

        // Animation
        newImageItem.classList.add('shuffle-animation');
        setTimeout(() => {
            newImageItem.classList.remove('shuffle-animation');
        }, 500);
    }
};

// =============================================================================
// CSS pour le Grid Preview (ajouté dynamiquement)
// =============================================================================

const gridPreviewStyles = `
.grid-preview-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
}

.grid-preview-modal.show {
    opacity: 1;
    visibility: visible;
}

.grid-preview-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
}

.grid-preview-container {
    position: relative;
    z-index: 1;
    background: #1E1E1E;
    border-radius: 20px;
    padding: 20px;
    max-width: 360px;
    width: 90%;
    transform: scale(0.9) translateY(20px);
    transition: transform 0.3s ease;
}

.grid-preview-modal.show .grid-preview-container {
    transform: scale(1) translateY(0);
}

.grid-preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.grid-preview-header h3 {
    color: #FAFAFA;
    font-size: 16px;
    margin: 0;
}

.grid-preview-close {
    background: #363636;
    border: none;
    color: #A8A8A8;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.grid-preview-close:hover {
    background: #404040;
    color: #FAFAFA;
}

.grid-preview-phone {
    background: #000;
    border-radius: 24px;
    padding: 8px;
    position: relative;
}

.phone-notch {
    width: 80px;
    height: 20px;
    background: #000;
    border-radius: 0 0 12px 12px;
    margin: 0 auto 8px;
    position: relative;
}

.phone-notch::before {
    content: '';
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: #1a1a1a;
    border-radius: 2px;
}

.phone-header {
    text-align: center;
    padding: 8px 0 12px;
    border-bottom: 1px solid #262626;
    margin-bottom: 2px;
}

.phone-username {
    display: block;
    color: #FAFAFA;
    font-weight: 600;
    font-size: 14px;
}

.phone-posts {
    color: #A8A8A8;
    font-size: 11px;
}

.grid-preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    background: #000;
}

.grid-item {
    aspect-ratio: 1;
    position: relative;
    overflow: hidden;
}

.grid-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.grid-item.new-image {
    box-shadow: 0 0 0 2px #E1306C;
}

.new-badge {
    position: absolute;
    top: 4px;
    left: 4px;
    background: linear-gradient(135deg, #E1306C, #833AB4);
    color: white;
    font-size: 8px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
}

.placeholder-bg {
    width: 100%;
    height: 100%;
    opacity: 0.6;
}

.grid-preview-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
}

.grid-action-btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #363636;
    color: #FAFAFA;
}

.grid-action-btn:hover {
    background: #404040;
}

.grid-action-btn.primary {
    background: linear-gradient(135deg, #E1306C, #833AB4);
    color: white;
}

.grid-action-btn.primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(225, 48, 108, 0.3);
}

.shuffle-animation {
    animation: shufflePop 0.5s ease;
}

@keyframes shufflePop {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
}
`;

// Injecter les styles
const styleSheet = document.createElement('style');
styleSheet.textContent = gridPreviewStyles;
document.head.appendChild(styleSheet);
