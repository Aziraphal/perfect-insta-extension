# 🚀 Installation Guide - Perfect Insta Post

## Étape 1 : Préparer les clés API

### 🔑 Clé OpenAI (obligatoire)

1. Allez sur [OpenAI Platform](https://platform.openai.com/api-keys)
2. Connectez-vous ou créez un compte
3. Cliquez sur "Create new secret key"
4. Donnez un nom à votre clé (ex: "Perfect Insta Post")
5. **Copiez et sauvegardez** votre clé (format: `sk-...`)
6. **Ajoutez du crédit** à votre compte (~5-10€ suffisent pour des mois d'utilisation)

### 👁️ Clé Google Vision API (obligatoire)

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez-en un
3. Activez l'**API Vision** :
   - Menu ☰ → APIs & Services → Library
   - Recherchez "Vision API"
   - Cliquez "Enable"
4. Créez une clé API :
   - APIs & Services → Credentials
   - "Create Credentials" → "API Key"
   - **Copiez votre clé** (format: `AIza...`)
5. **Configurez la facturation** si pas encore fait

---

## Étape 2 : Installer l'extension

### 📁 Télécharger les fichiers

Vous devez avoir le dossier `perfect-insta-extension/` avec ces fichiers :
```
perfect-insta-extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── content.js
├── icons/
├── create_icons.html (temporaire)
└── README.md
```

### 🔧 Créer les icônes

1. **Ouvrez** le fichier `create_icons.html` dans votre navigateur
2. **Clic droit** sur chaque icône → "Enregistrer l'image sous..."
3. **Sauvegardez** dans le dossier `/icons/` :
   - `icon16.png`
   - `icon32.png`
   - `icon48.png`
   - `icon128.png`
4. **Supprimez** le fichier `create_icons.html`

### 🌐 Charger dans Chrome

1. **Ouvrez Chrome** et tapez dans la barre d'adresse :
   ```
   chrome://extensions/
   ```

2. **Activez le mode développeur** (toggle en haut à droite)

3. **Cliquez sur "Charger l'extension non empaquetée"**

4. **Sélectionnez** le dossier `perfect-insta-extension`

5. ✅ **L'extension est installée !** Vous verrez l'icône dans la barre d'outils

---

## Étape 3 : Configuration initiale

### ⚙️ Première utilisation

1. **Cliquez** sur l'icône de Perfect Insta Post
2. **Entrez vos clés API** :
   - Clé OpenAI : `sk-proj-...`
   - Clé Google Vision : `AIza...`
3. **Cliquez "Sauvegarder"**
4. 🎉 **C'est prêt !**

---

## Étape 4 : Premier test

### 📸 Testez l'extension

1. **Cliquez** sur l'icône de l'extension
2. **Glissez-déposez** une image ou cliquez pour en sélectionner une
3. **Choisissez** :
   - Type de post (Lifestyle, Food, Travel...)
   - Ton (Casual, Professional, Funny...)
4. **Cliquez "Générer le post"**
5. ⏳ **Attendez** 5-15 secondes
6. 🎯 **Récupérez** votre post parfait !

---

## 🚨 Résolution des problèmes

### ❌ "Erreur lors de l'analyse de l'image"
- ✅ Vérifiez votre clé Google Vision API
- ✅ Assurez-vous que la facturation est activée sur Google Cloud
- ✅ Vérifiez que l'API Vision est bien activée

### ❌ "Erreur lors de la génération du contenu"
- ✅ Vérifiez votre clé OpenAI
- ✅ Assurez-vous d'avoir du crédit sur votre compte OpenAI
- ✅ Testez votre clé sur [OpenAI Platform](https://platform.openai.com/playground)

### ❌ L'extension ne se charge pas
- ✅ Vérifiez que tous les fichiers sont présents
- ✅ Vérifiez le mode développeur activé dans Chrome
- ✅ Rechargez l'extension (bouton refresh sur chrome://extensions/)

### ❌ Les icônes ne s'affichent pas
- ✅ Assurez-vous d'avoir créé les 4 fichiers PNG dans /icons/
- ✅ Les noms doivent être exacts : icon16.png, icon32.png, icon48.png, icon128.png

---

## 💰 Coûts d'utilisation

### Prix par post généré :
- **OpenAI GPT-3.5** : ~0,01-0,02€ par post
- **Google Vision API** : ~0,0015€ par image
- **Total** : ~0,02€ par post

### Exemples mensuels :
- **50 posts/mois** = ~1€
- **200 posts/mois** = ~4€
- **500 posts/mois** = ~10€

---

## ✨ Conseils d'utilisation

### 🎯 Pour de meilleurs résultats :
- **Utilisez des images claires** et bien éclairées
- **Choisissez le bon type de post** (auto-détection fonctionne bien aussi)
- **Expérimentez avec différents tons** selon votre audience
- **Éditez les légendes** générées selon votre style

### 🔒 Sécurité :
- Vos **clés API restent locales** - jamais envoyées à nos serveurs
- **Communication directe** avec OpenAI et Google
- **Aucune donnée collectée** par l'extension

---

## 🆘 Support

Si vous rencontrez des problèmes :

1. **Vérifiez cette documentation** d'abord
2. **Consultez les logs** dans la console Chrome (F12 → Console)
3. **Testez vos clés API** directement sur les plateformes OpenAI/Google

---

**🎉 Félicitations ! Vous êtes prêt à créer des posts Instagram parfaits ! 🎉**