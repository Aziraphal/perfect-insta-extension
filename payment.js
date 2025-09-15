// Système de paiement Stripe pour Perfect Insta Post
// Gère les upgrades vers Pro et la gestion des abonnements

class PaymentManager {
    constructor() {
        this.STRIPE_PUBLIC_KEY = 'pk_live_51RmKrBFRRcxMaxXVE3oGKHhRq5Zkkrr4RCNu0Fpc4rgRRqdRYwVKIqXZX8N0KnDoslD88U4EEt8DrDgyR69om0Jm003ZWnqwl2'; // Remplace par ta vraie clé publique
        this.BACKEND_URL = 'https://perfect-insta-extension-production.up.railway.app/api';
        this.stripe = null;

        this.PRICES = {
            pro_monthly: 'price_1S7ZcNFRRcxMaxXVBcamteAe', // Price ID Live Perfect Insta Pro
        };

        this.init();
    }

    async init() {
        // Pour les Chrome Extensions, on utilise l'API direct sans Stripe.js
        console.log('✅ Payment Manager initialisé');
    }

    // Créer une session de checkout Stripe
    async createCheckoutSession(priceId) {
        try {
            // Obtenir l'utilisateur actuel
            const userData = await chrome.storage.local.get(['user', 'authToken']);

            const response = await fetch(`${this.BACKEND_URL}/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userData.authToken || 'anonymous'}`
                },
                body: JSON.stringify({
                    priceId: priceId,
                    userEmail: userData.user?.email || 'anonymous@example.com',
                    source: 'chrome_extension'
                })
            });

            const session = await response.json();

            if (!response.ok) {
                throw new Error(session.error || 'Erreur lors de la création de la session');
            }

            return session;
        } catch (error) {
            console.error('Erreur création session checkout:', error);
            throw error;
        }
    }

    // Rediriger vers Stripe Checkout
    async redirectToCheckout(priceId) {
        try {
            // Créer la session de checkout
            const session = await this.createCheckoutSession(priceId);

            if (session.success && session.url) {
                // Ouvrir Stripe Checkout dans un nouvel onglet
                chrome.tabs.create({ url: session.url });
            } else {
                throw new Error('Impossible de créer la session de paiement');
            }

        } catch (error) {
            console.error('Erreur redirection checkout:', error);
            this.showPaymentError(error.message);
        }
    }

    // Upgrade vers Pro
    async upgradeToPro() {
        try {
            // Analytics event
            this.trackEvent('upgrade_initiated', {
                plan: 'pro',
                source: 'upgrade_button'
            });

            await this.redirectToCheckout(this.PRICES.pro_monthly);

        } catch (error) {
            console.error('Erreur upgrade Pro:', error);
            this.showPaymentError('Impossible de procéder au paiement. Veuillez réessayer.');
        }
    }

    // Vérifier le statut de l'abonnement
    async checkSubscriptionStatus() {
        try {
            const userData = await chrome.storage.local.get(['user', 'authToken']);

            if (!userData.authToken) {
                return { status: 'free', plan: 'free' };
            }

            const response = await fetch(`${this.BACKEND_URL}/subscription-status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${userData.authToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur vérification abonnement');
            }

            // Mettre à jour le plan local
            if (data.plan !== 'free') {
                await this.updateLocalPlan(data.plan, data);
            }

            return data;

        } catch (error) {
            console.error('Erreur vérification abonnement:', error);
            return { status: 'free', plan: 'free' };
        }
    }

    // Mettre à jour le plan dans le stockage local
    async updateLocalPlan(plan, subscriptionData) {
        try {
            // Mettre à jour freemiumManager
            if (typeof freemiumManager !== 'undefined') {
                freemiumManager.userPlan = plan;
                await freemiumManager.saveUserData();
                freemiumManager.updateUI();
            }

            // Sauvegarder les données d'abonnement
            await chrome.storage.local.set({
                userPlan: plan,
                subscriptionData: subscriptionData,
                lastPlanCheck: Date.now()
            });

            console.log(`✅ Plan mis à jour: ${plan}`);

        } catch (error) {
            console.error('Erreur mise à jour plan:', error);
        }
    }

    // Gérer le retour de Stripe (success/cancel)
    async handleStripeReturn() {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get('payment_success')) {
            // Paiement réussi
            await this.handlePaymentSuccess();
        } else if (urlParams.get('payment_cancelled')) {
            // Paiement annulé
            this.handlePaymentCancelled();
        }
    }

    async handlePaymentSuccess() {
        try {
            // Vérifier le nouveau statut d'abonnement
            const subscription = await this.checkSubscriptionStatus();

            if (subscription.plan === 'pro') {
                // Succès ! Afficher confirmation
                this.showPaymentSuccess();

                // Analytics
                this.trackEvent('upgrade_completed', {
                    plan: 'pro',
                    amount: 19
                });
            } else {
                // Attendre un peu et revérifier
                setTimeout(async () => {
                    const retryCheck = await this.checkSubscriptionStatus();
                    if (retryCheck.plan === 'pro') {
                        this.showPaymentSuccess();
                    }
                }, 3000);
            }

        } catch (error) {
            console.error('Erreur gestion succès paiement:', error);
        }
    }

    handlePaymentCancelled() {
        // Analytics
        this.trackEvent('upgrade_cancelled', {
            plan: 'pro',
            step: 'checkout'
        });

        this.showNotification('Upgrade annulé. Vos posts gratuits restent disponibles !', 'info');
    }

    // Annuler l'abonnement
    async cancelSubscription() {
        try {
            const userData = await chrome.storage.local.get(['authToken']);

            if (!userData.authToken) {
                throw new Error('Non authentifié');
            }

            const response = await fetch(`${this.BACKEND_URL}/cancel-subscription`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userData.authToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur annulation abonnement');
            }

            // Mettre à jour le plan local
            await this.updateLocalPlan('free', { status: 'cancelled' });

            this.showNotification('Abonnement annulé. Il reste actif jusqu\'à la fin de la période.', 'info');

            // Analytics
            this.trackEvent('subscription_cancelled', {
                plan: 'pro'
            });

        } catch (error) {
            console.error('Erreur annulation abonnement:', error);
            this.showNotification('Erreur lors de l\'annulation. Contactez le support.', 'error');
        }
    }

    // Interface utilisateur
    showPaymentSuccess() {
        // Créer modal de succès
        const modal = this.createSuccessModal();
        document.body.appendChild(modal);

        setTimeout(() => {
            modal.remove();
        }, 5000);
    }

    createSuccessModal() {
        const modal = document.createElement('div');
        modal.className = 'payment-success-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="success-icon">🎉</div>
                <h2>Bienvenue dans Pro !</h2>
                <p>Votre upgrade a été confirmé avec succès.</p>
                <ul>
                    <li>✅ 50 posts par mois</li>
                    <li>✅ Fonctionnalités avancées</li>
                    <li>✅ Sans watermark</li>
                </ul>
                <button id="startUsingProBtn">
                    Commencer à utiliser Pro
                </button>
            </div>
            <style>
                .payment-success-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }
                .modal-content {
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    text-align: center;
                    max-width: 400px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .success-icon {
                    font-size: 60px;
                    margin-bottom: 20px;
                }
                .modal-content h2 {
                    color: #27ae60;
                    margin-bottom: 15px;
                }
                .modal-content ul {
                    text-align: left;
                    margin: 20px 0;
                    list-style: none;
                }
                .modal-content li {
                    padding: 5px 0;
                    color: #666;
                }
                .modal-content button {
                    background: linear-gradient(45deg, #e4405f, #833ab4);
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
            </style>
        `;

        // Ajouter l'event listener pour le bouton
        setTimeout(() => {
            const startBtn = modal.querySelector('#startUsingProBtn');
            if (startBtn) {
                startBtn.addEventListener('click', () => modal.remove());
            }
        }, 0);

        return modal;
    }

    showPaymentError(message) {
        alert(`❌ Erreur de paiement\n\n${message}\n\nVeuillez réessayer ou contacter le support.`);
    }

    showNotification(message, type = 'info') {
        // Simple notification pour l'instant
        console.log(`📢 ${type}: ${message}`);

        // Vous pouvez améliorer avec une vraie notification toast
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else {
            alert(message);
        }
    }

    // Analytics et tracking
    trackEvent(eventName, properties = {}) {
        try {
            // Google Analytics ou autre service d'analytics
            console.log('📊 Event:', eventName, properties);

            // Exemple avec Google Analytics
            if (typeof gtag !== 'undefined') {
                gtag('event', eventName, {
                    event_category: 'payment',
                    ...properties
                });
            }
        } catch (error) {
            console.error('Erreur tracking:', error);
        }
    }

    // Utilitaires de prix
    formatPrice(amount, currency = 'EUR') {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    // Gestion des codes promo (futur)
    async applyPromoCode(code) {
        // Logique pour appliquer des codes promotionnels
        console.log('Code promo:', code);
    }
}

// Instance globale
const paymentManager = new PaymentManager();

// Vérifier le statut au chargement
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier les retours de Stripe
    await paymentManager.handleStripeReturn();

    // Vérifier périodiquement le statut d'abonnement
    await paymentManager.checkSubscriptionStatus();
});