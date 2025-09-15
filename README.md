# 📸 Perfect Insta Post

Extension Chrome qui génère automatiquement des posts Instagram parfaits à partir de vos photos en utilisant l'IA.

## ✨ Fonctionnalités

- **Analyse d'image intelligente** avec Google Vision API
- **Génération de légendes** optimisées avec OpenAI GPT-3.5
- **Hashtags pertinents** automatiques
- **Suggestions d'amélioration** pour maximiser l'engagement
- **Interface intuitive** et facile à utiliser
- **Sécurité** - vos clés API restent locales

## 🚀 Installation

### Prérequis

1. **Clé API OpenAI** - Obtenez la vôtre sur [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Clé API Google Vision** - Créez un projet sur [Google Cloud Console](https://console.cloud.google.com/) et activez l'API Vision

### Installation de l'extension

1. **Téléchargez** ou clonez ce dossier `perfect-insta-extension`

2. **Ouvrez Chrome** et allez sur `chrome://extensions/`

3. **Activez le mode développeur** (toggle en haut à droite)

4. **Cliquez sur "Charger l'extension non empaquetée"**

5. **Sélectionnez** le dossier `perfect-insta-extension`

6. **L'extension est installée!** Vous verrez l'icône dans la barre d'outils

## 🔧 Configuration initiale

1. **Cliquez sur l'icône** de l'extension
2. **Entrez vos clés API** lors de la première utilisation
3. **Sauvegardez** - vos clés sont stockées localement et en sécurité

## 💡 Utilisation

### Méthode 1 : Upload direct
1. Cliquez sur l'icône de l'extension
2. Glissez-déposez ou sélectionnez votre image
3. Choisissez le type de post et le ton
4. Cliquez sur "Générer le post"
5. Copiez le résultat et collez sur Instagram!

### Méthode 2 : Sélection sur une page web (bientôt disponible)
1. Sur une page avec des images, cliquez sur l'extension
2. Activez le mode sélection
3. Cliquez sur l'image de votre choix
4. Suivez les étapes de génération

## 📊 Coûts estimés

Pour un usage personnel :
- **OpenAI GPT-3.5** : ~2-5€/mois
- **Google Vision API** : ~1-3€/mois
- **Total** : 3-8€/mois pour ~100 posts

## 🔒 Sécurité et confidentialité

- ✅ **Clés API stockées localement** uniquement
- ✅ **Aucune données envoyées** à nos serveurs
- ✅ **Communication directe** avec OpenAI et Google
- ✅ **Code open source** - vérifiez par vous-même

## 🎨 Types de posts supportés

- **Lifestyle** - Posts personnels et quotidien
- **Nourriture** - Photos culinaires
- **Voyage** - Destinations et aventures
- **Mode** - Outfits et style
- **Business** - Contenu professionnel
- **Nature** - Paysages et environnement
- **Art** - Créations artistiques
- **Auto-détection** - L'IA choisit le type optimal

## 🎭 Tons disponibles

- **Décontracté** - Conversationnel et friendly
- **Professionnel** - Sérieux et informatif
- **Humoristique** - Fun et engageant
- **Inspirant** - Motivant et positif
- **Éducatif** - Instructif et utile

## 🔧 Développement

### Structure du projet
```
perfect-insta-extension/
├── manifest.json          # Configuration extension
├── popup.html             # Interface utilisateur
├── popup.css              # Styles
├── popup.js               # Logique principale
├── background.js          # Service worker
├── content.js             # Script injection pages
├── icons/                 # Icônes extension
└── README.md             # Documentation
```

### APIs utilisées
- **OpenAI GPT-3.5 Turbo** pour la génération de contenu
- **Google Vision API** pour l'analyse d'images
- **Chrome Extensions API** pour l'interface

## 📝 Changelog

### v1.0.0 (Version initiale)
- ✅ Interface utilisateur complète
- ✅ Intégration OpenAI GPT-3.5
- ✅ Intégration Google Vision API
- ✅ Génération de légendes et hashtags
- ✅ Système de suggestions
- ✅ Copie vers le presse-papier

## 🤝 Contribution

Les contributions sont les bienvenues! N'hésitez pas à :
- 🐛 Signaler des bugs
- 💡 Proposer des fonctionnalités
- 🔧 Soumettre des pull requests

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## ⚠️ Avertissement

Cette extension utilise des APIs tierces payantes. Surveillez votre utilisation pour éviter des coûts inattendus. Les tarifs sont généralement très abordables pour un usage personnel.

---

**Made with ❤️ pour créer des posts Instagram parfaits!**