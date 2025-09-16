// Système d'analytics et de rétention pour Perfect Insta Post
// Track user behavior, conversion funnel, and implement retention features

class AnalyticsManager {
    constructor() {
        this.userId = null;
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();

        // Configuration analytics
        this.config = {
            trackingEnabled: false, // Désactivé pendant le développement
            batchSize: 10, // Envoyer par lots de 10 événements
            flushInterval: 30000, // Envoyer toutes les 30s
            retryAttempts: 3
        };

        this.eventQueue = [];
        this.retentionFeatures = new RetentionManager();

        this.init();
    }

    async init() {
        await this.initUser();
        this.setupEventTracking();
        this.startPeriodicFlush();

        // Track session start
        this.track('session_started', {
            timestamp: this.startTime,
            user_agent: navigator.userAgent,
            extension_version: chrome.runtime.getManifest().version
        });

        console.log('📊 Analytics Manager initialized');
    }

    async initUser() {
        try {
            const userData = await chrome.storage.local.get(['userId', 'installDate', 'firstUseDate']);

            if (!userData.userId) {
                // Nouveau utilisateur
                this.userId = this.generateUserId();
                const now = Date.now();

                await chrome.storage.local.set({
                    userId: this.userId,
                    installDate: now,
                    firstUseDate: now
                });

                this.track('extension_installed', {
                    install_date: now
                });
            } else {
                this.userId = userData.userId;
            }

        } catch (error) {
            console.error('Erreur init user analytics:', error);
        }
    }

    // Tracking d'événements
    track(eventName, properties = {}) {
        if (!this.config.trackingEnabled) return;

        const event = {
            event: eventName,
            user_id: this.userId,
            session_id: this.sessionId,
            timestamp: Date.now(),
            properties: {
                ...properties,
                source: 'chrome_extension'
            }
        };

        this.eventQueue.push(event);
        console.log('📈 Event tracked:', eventName, properties);

        // Flush si la queue est pleine
        if (this.eventQueue.length >= this.config.batchSize) {
            this.flush();
        }
    }

    // Événements spécifiques
    trackPostGenerated(analysisData, postType, tone, hasAdvancedFeatures) {
        this.track('post_generated', {
            post_type: postType,
            tone: tone,
            has_advanced_features: hasAdvancedFeatures,
            labels_detected: analysisData.labels?.length || 0,
            objects_detected: analysisData.objects?.length || 0,
            faces_detected: analysisData.faces || 0,
            has_text: !!analysisData.text,
            has_location: !!analysisData.location,
            generation_time: Date.now()
        });
    }

    trackUpgradeFlow(step, plan, source) {
        this.track('upgrade_flow', {
            step: step, // 'initiated', 'modal_opened', 'checkout_started', 'completed', 'cancelled'
            plan: plan,
            source: source, // 'limit_reached', 'upgrade_button', 'pro_feature_blocked'
            timestamp: Date.now()
        });
    }

    trackUserRetention(action) {
        this.track('retention_event', {
            action: action, // 'returned', 'engaged', 'churned', 'reactivated'
            days_since_install: this.getDaysSinceInstall(),
            total_posts_generated: this.getTotalPostsGenerated()
        });
    }

    trackFeatureUsage(feature, value = null) {
        this.track('feature_usage', {
            feature: feature, // 'advanced_options', 'location', 'context', 'copy_post', etc.
            value: value,
            user_plan: this.getUserPlan()
        });
    }

    // Envoyer les événements au backend
    async flush() {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        try {
            // Dans un vrai déploiement, envoyer à votre service d'analytics
            // Exemple avec un backend personnalisé ou service tiers (Mixpanel, Amplitude, etc.)

            const response = await fetch('https://perfect-insta-extension-production.up.railway.app/api/analytics/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    events: events,
                    user_id: this.userId,
                    session_id: this.sessionId
                })
            });

            if (response.ok) {
                console.log(`📤 ${events.length} events sent to analytics`);
            } else {
                // Remettre les événements en queue en cas d'échec
                this.eventQueue.unshift(...events);
                console.error('Failed to send analytics events');
            }

        } catch (error) {
            console.error('Analytics flush error:', error);
            // Remettre les événements en queue
            this.eventQueue.unshift(...events);
        }
    }

    // Configuration du tracking automatique
    setupEventTracking() {
        // Track les clics sur les éléments importants
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Upload button
            if (target.closest('#uploadArea')) {
                this.track('upload_area_clicked');
            }

            // Generate button
            if (target.closest('#generateBtn')) {
                this.track('generate_button_clicked');
            }

            // Copy button
            if (target.closest('#copyBtn')) {
                this.track('copy_button_clicked');
            }

            // Upgrade buttons
            if (target.closest('.upgrade-btn') || target.closest('#upgradeBtn')) {
                this.track('upgrade_button_clicked', {
                    source: 'ui_button'
                });
            }

            // Advanced options
            if (target.closest('#advancedHeader')) {
                this.trackFeatureUsage('advanced_options_toggle');
            }
        });

        // Track les changements de sélection
        document.addEventListener('change', (e) => {
            const target = e.target;

            if (target.id === 'postType') {
                this.trackFeatureUsage('post_type_changed', target.value);
            }

            if (target.id === 'tone') {
                this.trackFeatureUsage('tone_changed', target.value);
            }

            if (target.id === 'captionLength') {
                this.trackFeatureUsage('caption_length_changed', target.value);
            }
        });
    }

    // Démarrer le flush périodique
    startPeriodicFlush() {
        setInterval(() => {
            this.flush();
        }, this.config.flushInterval);
    }

    // Utilitaires
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    async getDaysSinceInstall() {
        try {
            const data = await chrome.storage.local.get(['installDate']);
            if (data.installDate) {
                return Math.floor((Date.now() - data.installDate) / (1000 * 60 * 60 * 24));
            }
        } catch (error) {
            console.error('Error getting days since install:', error);
        }
        return 0;
    }

    async getTotalPostsGenerated() {
        try {
            const data = await chrome.storage.local.get(['totalPostsGenerated']);
            return data.totalPostsGenerated || 0;
        } catch (error) {
            return 0;
        }
    }

    async getUserPlan() {
        try {
            const data = await chrome.storage.local.get(['userPlan']);
            return data.userPlan || 'free';
        } catch (error) {
            return 'free';
        }
    }
}

// Gestionnaire de rétention utilisateur
class RetentionManager {
    constructor() {
        this.retentionStrategies = {
            welcome: new WelcomeStrategy(),
            engagement: new EngagementStrategy(),
            winback: new WinbackStrategy(),
            upgrade: new UpgradeStrategy()
        };

        this.init();
    }

    async init() {
        // Vérifier les conditions de rétention
        await this.checkRetentionTriggers();
    }

    async checkRetentionTriggers() {
        const userData = await chrome.storage.local.get([
            'installDate',
            'lastActiveDate',
            'totalPostsGenerated',
            'daysSinceLastUse',
            'userPlan'
        ]);

        const now = Date.now();
        const installDate = userData.installDate || now;
        const lastActiveDate = userData.lastActiveDate || now;
        const daysSinceInstall = Math.floor((now - installDate) / (1000 * 60 * 60 * 24));
        const daysSinceLastUse = Math.floor((now - lastActiveDate) / (1000 * 60 * 60 * 24));

        // Stratégie Welcome (nouveaux utilisateurs)
        if (daysSinceInstall <= 3 && userData.totalPostsGenerated < 2) {
            this.retentionStrategies.welcome.execute(userData);
        }

        // Stratégie Engagement (utilisateurs actifs)
        if (userData.totalPostsGenerated >= 3 && userData.userPlan === 'free') {
            this.retentionStrategies.upgrade.execute(userData);
        }

        // Stratégie Winback (utilisateurs inactifs)
        if (daysSinceLastUse >= 7) {
            this.retentionStrategies.winback.execute(userData);
        }

        // Mettre à jour la date de dernière activité
        await chrome.storage.local.set({
            lastActiveDate: now
        });
    }
}

// Stratégies de rétention

class WelcomeStrategy {
    execute(userData) {
        // Onboarding pour nouveaux utilisateurs
        this.showWelcomeTooltip();
        analyticsManager.track('retention_welcome_triggered', {
            days_since_install: Math.floor((Date.now() - userData.installDate) / (1000 * 60 * 60 * 24))
        });
    }

    showWelcomeTooltip() {
        // Afficher des tips d'utilisation
        setTimeout(() => {
            if (document.getElementById('uploadArea') && !document.querySelector('.welcome-tooltip')) {
                this.createWelcomeTooltip();
            }
        }, 2000);
    }

    createWelcomeTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'welcome-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-content">
                <h3>🎉 Bienvenue dans Perfect Insta Post !</h3>
                <p>Uploadez une photo pour commencer à créer des posts parfaits</p>
                <button id="welcomeOkBtn">Compris !</button>
            </div>
            <style>
                .welcome-tooltip {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10000;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 20px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    text-align: center;
                    max-width: 300px;
                }
                .welcome-tooltip button {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 15px;
                    font-weight: 600;
                }
            </style>
        `;

        document.body.appendChild(tooltip);

        // Ajouter event listener
        setTimeout(() => {
            const okBtn = tooltip.querySelector('#welcomeOkBtn');
            if (okBtn) {
                okBtn.addEventListener('click', () => tooltip.remove());
            }
        }, 0);

        // Auto-remove après 10 secondes
        setTimeout(() => {
            if (tooltip.parentElement) {
                tooltip.remove();
            }
        }, 10000);
    }
}

class EngagementStrategy {
    execute(userData) {
        // Encourager l'utilisation continue
        analyticsManager.track('retention_engagement_triggered', {
            total_posts: userData.totalPostsGenerated
        });
    }
}

class UpgradeStrategy {
    execute(userData) {
        // Encourager l'upgrade après plusieurs utilisations
        if (userData.totalPostsGenerated >= 3 && userData.userPlan === 'free') {
            setTimeout(() => {
                this.showUpgradeHint();
            }, 5000);
        }
    }

    showUpgradeHint() {
        const hint = document.createElement('div');
        hint.className = 'upgrade-hint';
        hint.innerHTML = `
            <div class="hint-content">
                💡 <strong>Astuce Pro</strong> : Débloquez la localisation et le contexte pour des posts encore plus engageants !
                <button id="seeProBtn">
                    Voir Pro
                </button>
                <button id="closeHintBtn">×</button>
            </div>
            <style>
                .upgrade-hint {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 1000;
                    background: #f8f9fa;
                    border: 1px solid #e4405f;
                    border-radius: 10px;
                    padding: 15px;
                    max-width: 280px;
                    box-shadow: 0 5px 20px rgba(0,0,0,0.15);
                    animation: slideInUp 0.3s ease;
                }
                .hint-content {
                    font-size: 13px;
                    color: #333;
                }
                .hint-content button:first-of-type {
                    background: #e4405f;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    margin: 8px 8px 0 0;
                    cursor: pointer;
                }
                .hint-content button:last-of-type {
                    background: none;
                    border: none;
                    color: #999;
                    cursor: pointer;
                    padding: 6px;
                    float: right;
                    margin-top: -5px;
                }
                @keyframes slideInUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            </style>
        `;

        document.body.appendChild(hint);

        // Ajouter event listeners
        setTimeout(() => {
            const seeProBtn = hint.querySelector('#seeProBtn');
            const closeBtn = hint.querySelector('#closeHintBtn');

            if (seeProBtn) {
                seeProBtn.addEventListener('click', () => {
                    freemiumManager.showUpgradeModal();
                    hint.remove();
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', () => hint.remove());
            }
        }, 0);

        // Auto-remove après 15 secondes
        setTimeout(() => {
            if (hint.parentElement) {
                hint.remove();
            }
        }, 15000);
    }
}

class WinbackStrategy {
    execute(userData) {
        // Utilisateurs inactifs - les faire revenir
        analyticsManager.track('retention_winback_triggered', {
            days_inactive: Math.floor((Date.now() - userData.lastActiveDate) / (1000 * 60 * 60 * 24))
        });

        // Dans une vraie app, envoyer un email de winback
        // Pour l'extension, on peut afficher un message au retour
        this.showWinbackMessage();
    }

    showWinbackMessage() {
        setTimeout(() => {
            const message = document.createElement('div');
            message.className = 'winback-message';
            message.innerHTML = `
                <div class="message-content">
                    <h3>👋 Content de vous revoir !</h3>
                    <p>Créez un nouveau post parfait dès maintenant</p>
                    <button id="letsGoBtn">Let's go !</button>
                </div>
                <style>
                    .winback-message {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 1000;
                        background: linear-gradient(135deg, #27ae60, #2ecc71);
                        color: white;
                        padding: 20px;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                        animation: bounceIn 0.6s ease;
                    }
                    .message-content {
                        text-align: center;
                    }
                    .message-content h3 {
                        margin: 0 0 8px 0;
                        font-size: 16px;
                    }
                    .message-content p {
                        margin: 0 0 15px 0;
                        font-size: 13px;
                        opacity: 0.9;
                    }
                    .message-content button {
                        background: white;
                        color: #27ae60;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    @keyframes bounceIn {
                        0% { transform: scale(0.3); opacity: 0; }
                        50% { transform: scale(1.05); }
                        70% { transform: scale(0.9); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                </style>
            `;

            document.body.appendChild(message);

            // Ajouter event listener
            setTimeout(() => {
                const letsGoBtn = message.querySelector('#letsGoBtn');
                if (letsGoBtn) {
                    letsGoBtn.addEventListener('click', () => message.remove());
                }
            }, 0);

            setTimeout(() => {
                if (message.parentElement) {
                    message.remove();
                }
            }, 8000);
        }, 1000);
    }
}

// Instance globale
const analyticsManager = new AnalyticsManager();

// Event listeners pour les analytics
document.addEventListener('DOMContentLoaded', () => {
    // Track les événements de l'interface
    analyticsManager.track('popup_opened');
});

// Cleanup avant fermeture
window.addEventListener('beforeunload', () => {
    analyticsManager.flush();
    analyticsManager.track('session_ended', {
        session_duration: Date.now() - analyticsManager.startTime
    });
});

// Export pour utilisation dans d'autres fichiers
window.analyticsManager = analyticsManager;