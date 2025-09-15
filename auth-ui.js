// Interface utilisateur pour l'authentification
document.addEventListener('DOMContentLoaded', () => {
    // Éléments DOM
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authError = document.getElementById('authError');
    const skipAuth = document.getElementById('skipAuth');

    // Gestion des onglets
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Mettre à jour les onglets actifs
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Afficher le formulaire correspondant
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${tabName}Form`) {
                    form.classList.add('active');
                }
            });

            hideError();
        });
    });

    // Gestion du formulaire de connexion
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const loginBtn = document.getElementById('loginBtn');

        // État de chargement
        loginBtn.disabled = true;
        loginBtn.textContent = 'Connexion...';

        try {
            const result = await authManager.login(email, password);

            if (result.success) {
                // Succès - rediriger vers l'extension principale
                showSuccess('Connexion réussie ! Redirection...');
                setTimeout(() => {
                    window.location.href = 'popup.html';
                }, 1000);
            } else {
                showError(result.error);
            }
        } catch (error) {
            showError('Erreur de connexion. Veuillez réessayer.');
        }

        // Restaurer le bouton
        loginBtn.disabled = false;
        loginBtn.textContent = 'Se connecter';
    });

    // Gestion du formulaire d'inscription
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const registerBtn = document.getElementById('registerBtn');

        // Validation
        if (password !== confirmPassword) {
            showError('Les mots de passe ne correspondent pas');
            return;
        }

        if (password.length < 6) {
            showError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        // État de chargement
        registerBtn.disabled = true;
        registerBtn.textContent = 'Création du compte...';

        try {
            const result = await authManager.register(email, password);

            if (result.success) {
                // Succès - rediriger vers l'extension principale
                showSuccess('Compte créé avec succès ! Redirection...');
                setTimeout(() => {
                    window.location.href = 'popup.html';
                }, 1000);
            } else {
                showError(result.error);
            }
        } catch (error) {
            showError('Erreur lors de la création du compte. Veuillez réessayer.');
        }

        // Restaurer le bouton
        registerBtn.disabled = false;
        registerBtn.textContent = 'Créer mon compte';
    });

    // Continuer sans compte
    skipAuth.addEventListener('click', (e) => {
        e.preventDefault();

        // Marquer comme utilisateur anonyme
        chrome.storage.local.set({
            skipAuth: true,
            anonymousUser: true
        });

        window.location.href = 'popup.html';
    });

    // Fonctions utilitaires
    function showError(message) {
        authError.textContent = message;
        authError.style.display = 'block';
    }

    function hideError() {
        authError.style.display = 'none';
    }

    function showSuccess(message) {
        // Remplacer temporairement l'erreur par un message de succès
        authError.className = 'auth-success';
        authError.textContent = message;
        authError.style.display = 'block';
    }

    // Vérification si déjà connecté
    initAuthCheck();

    async function initAuthCheck() {
        try {
            const userData = await chrome.storage.local.get(['user', 'authToken']);

            if (userData.user && userData.authToken) {
                // Utilisateur déjà connecté - rediriger
                showSuccess('Déjà connecté ! Redirection...');
                setTimeout(() => {
                    window.location.href = 'popup.html';
                }, 500);
            }
        } catch (error) {
            console.error('Erreur vérification auth:', error);
        }
    }
});