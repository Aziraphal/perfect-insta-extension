// Système freemium pour Perfect Insta Post
// Gère les quotas, limitations et conversions

class FreemiumManager {
    constructor() {
        this.LIMITS = {
            free: {
                postsPerMonth: 5,
                advancedFeatures: false,
                watermark: true
            },
            pro: {
                postsPerMonth: 50,
                advancedFeatures: true,
                watermark: false
            }
        };

        this.init();
    }

    async init() {
        // Initialiser les données utilisateur
        await this.initUserData();

        // Mettre à jour l'interface
        this.updateUI();
    }

    async initUserData() {
        try {
            const data = await chrome.storage.local.get([
                'userPlan',
                'postsThisMonth',
                'monthlyResetDate',
                'totalPostsGenerated',
                'firstUseDate'
            ]);

            // Utilisateur par défaut = gratuit
            this.userPlan = data.userPlan || 'free';
            this.postsThisMonth = data.postsThisMonth || 0;
            this.totalPostsGenerated = data.totalPostsGenerated || 0;
            this.firstUseDate = data.firstUseDate || Date.now();

            // Reset mensuel
            const now = new Date();
            const resetDate = data.monthlyResetDate || this.getNextResetDate().getTime();

            if (now.getTime() > resetDate) {
                // Nouveau mois, reset compteur
                this.postsThisMonth = 0;
                await this.saveUserData();
            }

            this.monthlyResetDate = resetDate;

            console.log('📊 Freemium Data:', {
                plan: this.userPlan,
                postsThisMonth: this.postsThisMonth,
                totalPosts: this.totalPostsGenerated
            });

        } catch (error) {
            console.error('Erreur init freemium:', error);
            // Valeurs par défaut en cas d'erreur
            this.userPlan = 'free';
            this.postsThisMonth = 0;
            this.totalPostsGenerated = 0;
            this.firstUseDate = Date.now();
        }
    }

    getNextResetDate() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    async saveUserData() {
        try {
            await chrome.storage.local.set({
                userPlan: this.userPlan,
                postsThisMonth: this.postsThisMonth,
                monthlyResetDate: this.monthlyResetDate,
                totalPostsGenerated: this.totalPostsGenerated,
                firstUseDate: this.firstUseDate
            });
        } catch (error) {
            console.error('Erreur sauvegarde freemium:', error);
        }
    }

    // Vérifier si l'utilisateur peut générer un post
    canGeneratePost() {
        const limit = this.LIMITS[this.userPlan].postsPerMonth;
        return this.postsThisMonth < limit;
    }

    // Obtenir les infos d'usage
    getUsageInfo() {
        const limit = this.LIMITS[this.userPlan].postsPerMonth;
        const remaining = Math.max(0, limit - this.postsThisMonth);
        const resetDate = new Date(this.monthlyResetDate);

        return {
            plan: this.userPlan,
            isPro: this.userPlan === 'pro',
            postsUsed: this.postsThisMonth,
            postsLimit: limit,
            postsRemaining: remaining,
            canGenerate: this.canGeneratePost(),
            resetDate: resetDate.toLocaleDateString('fr-FR'),
            advancedFeatures: this.LIMITS[this.userPlan].advancedFeatures,
            needsWatermark: this.LIMITS[this.userPlan].watermark,
            totalPosts: this.totalPostsGenerated,
            daysSinceFirstUse: Math.floor((Date.now() - this.firstUseDate) / (1000 * 60 * 60 * 24))
        };
    }

    // Incrémenter l'usage après génération
    async incrementUsage() {
        if (this.canGeneratePost()) {
            this.postsThisMonth++;
            this.totalPostsGenerated++;
            await this.saveUserData();
            this.updateUI();
            return true;
        }
        return false;
    }

    // Mettre à jour l'interface utilisateur
    updateUI() {
        const usage = this.getUsageInfo();

        // Mettre à jour la barre utilisateur
        this.updateUserBar(usage);

        // Mettre à jour les limitations
        this.updateLimitations(usage);

        // Mettre à jour les call-to-action
        this.updateCallToActions(usage);
    }

    updateUserBar(usage) {
        const userBar = document.getElementById('userBar');
        const userEmail = document.getElementById('userEmail');
        const userPlan = document.getElementById('userPlan');
        const usageText = document.getElementById('usageText');
        const upgradeBtn = document.getElementById('upgradeBtn');

        if (userBar) {
            userBar.hidden = false;

            if (userEmail) userEmail.textContent = usage.isPro ? 'Utilisateur Pro' : 'Utilisateur Gratuit';
            if (userPlan) userPlan.textContent = usage.isPro ? 'PRO' : 'FREE';
            if (usageText) usageText.textContent = `${usage.postsUsed}/${usage.postsLimit} posts ce mois`;

            if (upgradeBtn) {
                upgradeBtn.hidden = usage.isPro;
                upgradeBtn.textContent = usage.postsRemaining <= 1 ? 'Upgrade Now!' : 'Upgrade Pro';
            }
        }
    }

    updateLimitations(usage) {
        const advancedSection = document.getElementById('advancedSection');
        const proOverlay = document.getElementById('proOverlay');
        const proOnlyBadge = document.getElementById('proOnlyBadge');

        if (!usage.advancedFeatures) {
            // Bloquer les fonctionnalités avancées
            if (advancedSection) {
                advancedSection.classList.add('locked');
            }

            if (proOverlay) {
                proOverlay.hidden = false;
            }

            if (proOnlyBadge) {
                proOnlyBadge.hidden = false;
            }

            // Désactiver les champs
            const inputs = document.querySelectorAll('#location, #context, #captionLength, #captionStyle');
            inputs.forEach(input => {
                input.disabled = true;
                input.style.opacity = '0.5';
                input.style.cursor = 'not-allowed';
            });
        }
    }

    updateCallToActions(usage) {
        // Messages d'encouragement selon l'usage
        if (usage.postsRemaining <= 1 && !usage.isPro) {
            this.showUrgentUpgrade(usage);
        } else if (usage.postsUsed >= 2 && !usage.isPro) {
            this.showSoftUpgrade(usage);
        }
    }

    showUrgentUpgrade(usage) {
        // Track urgent upgrade trigger
        if (typeof analyticsManager !== 'undefined') {
            analyticsManager.trackUpgradeFlow('urgent_prompt_shown', 'pro', 'limit_reached');
        }

        // Notification urgente
        setTimeout(() => {
            if (confirm(`⚠️ Plus que ${usage.postsRemaining} post(s) gratuit(s) ce mois !\n\nPassez à Pro pour débloquer 50 posts/mois + fonctions avancées ?\n\n→ 19€/mois seulement`)) {
                if (typeof analyticsManager !== 'undefined') {
                    analyticsManager.trackUpgradeFlow('urgent_prompt_accepted', 'pro', 'limit_reached');
                }
                this.showUpgradeModal();
            } else {
                if (typeof analyticsManager !== 'undefined') {
                    analyticsManager.trackUpgradeFlow('urgent_prompt_declined', 'pro', 'limit_reached');
                }
            }
        }, 2000);
    }

    showSoftUpgrade(usage) {
        // Encouragement subtil
        console.log('💡 Suggestion upgrade subtile');
    }

    showUpgradeModal() {
        // Utiliser le système de paiement si disponible
        if (typeof paymentManager !== 'undefined') {
            this.showAdvancedUpgradeModal();
        } else {
            // Fallback
            alert(`🚀 Upgrade vers Pro bientôt disponible !\n\n✨ 50 posts par mois\n📍 Localisation + contexte\n🎨 Styles avancés\n💧 Pas de watermark\n\nPour seulement 19€/mois`);
        }
    }

    showAdvancedUpgradeModal() {
        // Créer modal d'upgrade avancée
        const modal = this.createUpgradeModal();
        document.body.appendChild(modal);
    }

    createUpgradeModal() {
        const usage = this.getUsageInfo();
        const modal = document.createElement('div');
        modal.className = 'upgrade-modal';
        modal.innerHTML = `
            <div class="modal-backdrop" id="modalBackdrop"></div>
            <div class="modal-content">
                <button class="modal-close" id="modalClose">×</button>

                <div class="upgrade-header">
                    <h2>🚀 Passez à Perfect Insta Pro</h2>
                    <p class="upgrade-subtitle">Créez des posts parfaits sans limites</p>
                </div>

                <div class="current-usage">
                    <div class="usage-bar">
                        <div class="usage-fill" style="width: ${(usage.postsUsed / usage.postsLimit) * 100}%"></div>
                    </div>
                    <p>Vous avez utilisé <strong>${usage.postsUsed}/${usage.postsLimit}</strong> posts ce mois</p>
                </div>

                <div class="upgrade-benefits">
                    <div class="benefit-item">
                        <span class="benefit-icon">📊</span>
                        <div>
                            <h4>50 posts par mois</h4>
                            <p>10x plus de génération pour booster votre contenu</p>
                        </div>
                    </div>

                    <div class="benefit-item">
                        <span class="benefit-icon">🎯</span>
                        <div>
                            <h4>Fonctionnalités avancées</h4>
                            <p>Localisation, contexte, contrôle de style</p>
                        </div>
                    </div>

                    <div class="benefit-item">
                        <span class="benefit-icon">✨</span>
                        <div>
                            <h4>Sans watermark</h4>
                            <p>Posts 100% professionnels</p>
                        </div>
                    </div>

                    <div class="benefit-item">
                        <span class="benefit-icon">⚡</span>
                        <div>
                            <h4>Support prioritaire</h4>
                            <p>Aide rapide et personnalisée</p>
                        </div>
                    </div>
                </div>

                <div class="pricing">
                    <div class="price-main">
                        <span class="currency">€</span>
                        <span class="amount">19</span>
                        <span class="period">/mois</span>
                    </div>
                    <p class="price-note">Annulable à tout moment • Premier mois à 9€</p>
                </div>

                <div class="modal-actions">
                    <button class="upgrade-btn-main" id="upgradeMainBtn">
                        🚀 Passer à Pro maintenant
                    </button>
                    <button class="maybe-later-btn" id="maybeLaterBtn">
                        Peut-être plus tard
                    </button>
                </div>
            </div>

            <style>
                .upgrade-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .modal-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(3px);
                }

                .modal-content {
                    background: white;
                    padding: 30px;
                    border-radius: 20px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    position: relative;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }

                .modal-close {
                    position: absolute;
                    top: 20px;
                    right: 25px;
                    background: none;
                    border: none;
                    font-size: 30px;
                    color: #999;
                    cursor: pointer;
                    padding: 0;
                }

                .upgrade-header {
                    text-align: center;
                    margin-bottom: 25px;
                }

                .upgrade-header h2 {
                    color: #333;
                    margin-bottom: 8px;
                    font-size: 26px;
                }

                .upgrade-subtitle {
                    color: #666;
                    font-size: 16px;
                }

                .current-usage {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 12px;
                    margin-bottom: 25px;
                    text-align: center;
                }

                .usage-bar {
                    width: 100%;
                    height: 8px;
                    background: #e9ecef;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 10px;
                }

                .usage-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #e4405f, #833ab4);
                    transition: width 0.3s ease;
                }

                .benefit-item {
                    display: flex;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 10px;
                    background: #f8f9fa;
                }

                .benefit-icon {
                    font-size: 24px;
                    margin-right: 15px;
                    margin-top: 2px;
                }

                .benefit-item h4 {
                    margin: 0 0 5px 0;
                    color: #333;
                    font-size: 16px;
                }

                .benefit-item p {
                    margin: 0;
                    color: #666;
                    font-size: 14px;
                }

                .pricing {
                    text-align: center;
                    margin: 30px 0;
                    padding: 25px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 15px;
                    color: white;
                }

                .price-main {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 10px;
                }

                .currency {
                    font-size: 24px;
                    margin-right: 5px;
                }

                .amount {
                    font-size: 48px;
                    font-weight: bold;
                }

                .period {
                    font-size: 18px;
                    margin-left: 5px;
                    opacity: 0.9;
                }

                .price-note {
                    margin: 0;
                    font-size: 14px;
                    opacity: 0.9;
                }

                .modal-actions {
                    text-align: center;
                }

                .upgrade-btn-main {
                    background: linear-gradient(45deg, #e4405f, #833ab4);
                    color: white;
                    border: none;
                    padding: 16px 30px;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-bottom: 15px;
                    width: 100%;
                    transition: transform 0.2s ease;
                }

                .upgrade-btn-main:hover {
                    transform: translateY(-2px);
                }

                .maybe-later-btn {
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 14px;
                    cursor: pointer;
                    text-decoration: underline;
                }
            </style>
        `;

        // Ajouter les event listeners après création
        setTimeout(() => {
            const upgradeBtn = modal.querySelector('#upgradeMainBtn');
            const laterBtn = modal.querySelector('#maybeLaterBtn');
            const closeBtn = modal.querySelector('#modalClose');
            const backdrop = modal.querySelector('#modalBackdrop');

            if (upgradeBtn) {
                upgradeBtn.addEventListener('click', () => paymentManager.upgradeToPro());
            }

            if (laterBtn) {
                laterBtn.addEventListener('click', () => modal.remove());
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.remove());
            }

            if (backdrop) {
                backdrop.addEventListener('click', () => modal.remove());
            }
        }, 0);

        return modal;
    }

    // Ajouter watermark aux posts gratuits
    addWatermarkToPost(caption) {
        if (this.LIMITS[this.userPlan].watermark) {
            return caption + '\n\n💧 Generated with Perfect Insta Post';
        }
        return caption;
    }

    // Passer en mode Pro (pour les tests)
    async upgradeToPro() {
        this.userPlan = 'pro';
        await this.saveUserData();
        this.updateUI();
        console.log('🎉 Upgraded to Pro!');
    }

    // Stats pour motivation
    getMotivationalStats() {
        const usage = this.getUsageInfo();
        const stats = [];

        if (usage.totalPosts > 0) {
            stats.push(`Vous avez généré ${usage.totalPosts} posts parfaits !`);
        }

        if (usage.daysSinceFirstUse > 7) {
            stats.push(`Utilisateur depuis ${usage.daysSinceFirstUse} jours`);
        }

        if (usage.totalPosts >= 10) {
            stats.push(`🔥 Power user ! ${usage.totalPosts} posts créés`);
        }

        return stats;
    }
}

// Instance globale
const freemiumManager = new FreemiumManager();