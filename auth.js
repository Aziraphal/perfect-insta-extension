// Auth et gestion utilisateur pour Perfect Insta Post
// Utilise Firebase pour simplicité (gratuit jusqu'à 10k utilisateurs)

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.apiUrl = 'https://perfect-insta-backend.vercel.app'; // À créer
        this.initAuth();
    }

    async initAuth() {
        try {
            // Récupérer l'utilisateur stocké localement
            const userData = await chrome.storage.local.get(['user', 'authToken']);

            if (userData.user && userData.authToken) {
                this.currentUser = userData.user;
                console.log('👤 Utilisateur connecté:', this.currentUser.email);

                // Vérifier si le token est toujours valide
                await this.validateToken(userData.authToken);
            } else {
                console.log('👤 Utilisateur non connecté');
            }
        } catch (error) {
            console.error('Erreur init auth:', error);
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch(`${this.apiUrl}/api/validate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                // Token invalide, déconnecter
                await this.logout();
            }
        } catch (error) {
            console.error('Erreur validation token:', error);
        }
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.apiUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;

                // Stocker l'utilisateur et token
                await chrome.storage.local.set({
                    user: data.user,
                    authToken: data.token
                });

                console.log('✅ Connexion réussie:', email);
                return { success: true, user: data.user };
            } else {
                throw new Error(data.message || 'Erreur de connexion');
            }
        } catch (error) {
            console.error('Erreur login:', error);
            return { success: false, error: error.message };
        }
    }

    async register(email, password) {
        try {
            const response = await fetch(`${this.apiUrl}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    source: 'chrome-extension'
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Auto-login après inscription
                return await this.login(email, password);
            } else {
                throw new Error(data.message || 'Erreur d\'inscription');
            }
        } catch (error) {
            console.error('Erreur register:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            // Nettoyer le storage local
            await chrome.storage.local.remove(['user', 'authToken']);
            this.currentUser = null;
            console.log('👋 Utilisateur déconnecté');

            return { success: true };
        } catch (error) {
            console.error('Erreur logout:', error);
            return { success: false, error: error.message };
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    // Vérifier les quotas utilisateur
    async checkUsage() {
        if (!this.isAuthenticated()) {
            return {
                isPro: false,
                postsUsed: 0,
                postsLimit: 5,
                canGenerate: true
            };
        }

        try {
            const token = await this.getToken();
            const response = await fetch(`${this.apiUrl}/api/usage`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const usage = await response.json();

            return {
                isPro: usage.isPro,
                postsUsed: usage.postsUsed,
                postsLimit: usage.isPro ? 50 : 5,
                canGenerate: usage.postsUsed < (usage.isPro ? 50 : 5),
                resetDate: usage.resetDate
            };
        } catch (error) {
            console.error('Erreur check usage:', error);
            // Fallback en cas d'erreur
            return {
                isPro: false,
                postsUsed: 0,
                postsLimit: 5,
                canGenerate: true
            };
        }
    }

    // Incrémenter le compteur d'utilisation
    async incrementUsage() {
        if (!this.isAuthenticated()) {
            return { success: true }; // Laissez passer pour les non-connectés (usage local)
        }

        try {
            const token = await this.getToken();
            const response = await fetch(`${this.apiUrl}/api/increment-usage`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            return await response.json();
        } catch (error) {
            console.error('Erreur increment usage:', error);
            return { success: false };
        }
    }

    async getToken() {
        const data = await chrome.storage.local.get(['authToken']);
        return data.authToken;
    }
}

// Instance globale
const authManager = new AuthManager();