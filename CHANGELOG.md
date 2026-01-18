# Changelog

All notable changes to Perfect Insta Post will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-18

### Added
- **History Feature**: Local history storage using IndexedDB
  - Save generated posts for later reference
  - Browse and reload previous analyses
  - Delete individual entries or clear all history
- **Export PNG**: Generate visual reports of your posts
  - Includes image preview, caption, and hashtags
  - Instagram-styled gradient design
  - One-click download
- **Grid Preview**: Preview your image in a simulated Instagram feed
  - See how your post will look in your profile grid
  - Shuffle position to visualize different layouts
- **Centralized Configuration**: New `config.js` for shared settings
  - Single source of truth for API URLs
  - Configurable limits and plans
  - Helper functions for validation
- **Unit Tests**: Test suite for configuration module
  - 21 tests covering all config functions
  - Run with `npm test`

### Changed
- **UI Improvements**: Modern dark theme with Instagram gradients
  - Glassmorphism effects
  - Smooth animations
  - Toast notifications instead of alerts
- **Security Hardening**:
  - Removed unused host permissions (vision.googleapis.com, api.openai.com)
  - Restricted content scripts from `<all_urls>` to specific sites only
  - All API calls now go through authenticated backend
- **Code Quality**:
  - Removed 2,311 lines of redundant code
  - Deleted legacy files (popup-new.js, popup-very-old.js, backend-example.js)
  - Refactored to use centralized configuration

### Security
- Manifest permissions reduced to minimum required
- Content scripts limited to: Instagram, Facebook, Twitter, Pinterest, Unsplash, Pexels

## [1.0.0] - 2025-01-17

### Added
- Initial release
- Google OAuth authentication
- AI-powered caption generation with OpenAI GPT-4o
- Hashtag suggestions
- Post type and tone selection
- Stripe payment integration for Pro subscription
- Freemium model (5 free posts/month, 50 for Pro)
- Advanced options for Pro users:
  - Location-based hashtags
  - Context/situation customization
  - Caption length control
  - Caption style selection
