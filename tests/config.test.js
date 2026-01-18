// =============================================================================
// TESTS UNITAIRES - CONFIG.JS
// =============================================================================

// Charger config.js via require (utilise module.exports défini dans config.js)
const APP_CONFIG = require('../config.js');

// Compteurs de tests
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
    }
}

function assertTrue(condition, message = '') {
    if (!condition) {
        throw new Error(`Expected true, got false. ${message}`);
    }
}

function assertFalse(condition, message = '') {
    if (condition) {
        throw new Error(`Expected false, got true. ${message}`);
    }
}

function assertIncludes(array, item, message = '') {
    if (!array.includes(item)) {
        throw new Error(`Array does not include ${item}. ${message}`);
    }
}

// =============================================================================
// TESTS
// =============================================================================

console.log('\n🧪 Running Config Tests...\n');

console.log('📦 APP_CONFIG Structure:');

test('APP_CONFIG exists', () => {
    assertTrue(typeof APP_CONFIG === 'object');
});

test('APP_CONFIG.app exists with required fields', () => {
    assertTrue(typeof APP_CONFIG.app === 'object');
    assertEqual(APP_CONFIG.app.name, 'Perfect Insta Post');
    assertTrue(APP_CONFIG.app.version.match(/^\d+\.\d+\.\d+$/) !== null);
});

test('APP_CONFIG.backend exists with baseUrl', () => {
    assertTrue(typeof APP_CONFIG.backend === 'object');
    assertTrue(APP_CONFIG.backend.baseUrl.startsWith('https://'));
});

test('APP_CONFIG.backend.endpoints has required routes', () => {
    const endpoints = APP_CONFIG.backend.endpoints;
    assertTrue(typeof endpoints.generatePost === 'string');
    assertTrue(typeof endpoints.login === 'string');
    assertTrue(typeof endpoints.analyze === 'string');
});

console.log('\n📏 Limits Tests:');

test('APP_CONFIG.limits.maxFileSize is 10MB', () => {
    assertEqual(APP_CONFIG.limits.maxFileSize, 10 * 1024 * 1024);
});

test('APP_CONFIG.limits.supportedFormats includes jpeg, png, webp', () => {
    assertIncludes(APP_CONFIG.limits.supportedFormats, 'image/jpeg');
    assertIncludes(APP_CONFIG.limits.supportedFormats, 'image/png');
    assertIncludes(APP_CONFIG.limits.supportedFormats, 'image/webp');
});

console.log('\n💰 Plans Tests:');

test('Free plan has 5 posts per month', () => {
    assertEqual(APP_CONFIG.plans.free.postsPerMonth, 5);
});

test('Pro plan has 50 posts per month', () => {
    assertEqual(APP_CONFIG.plans.pro.postsPerMonth, 50);
});

test('Pro plan price is 19', () => {
    assertEqual(APP_CONFIG.plans.pro.price, 19);
});

console.log('\n🔧 Helper Functions Tests:');

test('getApiUrl returns correct URL for generatePost', () => {
    const url = APP_CONFIG.getApiUrl('generatePost');
    assertTrue(url.includes('/api/generate-post'));
    assertTrue(url.startsWith('https://'));
});

test('getApiUrl returns null for unknown endpoint', () => {
    const url = APP_CONFIG.getApiUrl('unknownEndpoint');
    assertEqual(url, null);
});

test('isFormatSupported returns true for jpeg', () => {
    assertTrue(APP_CONFIG.isFormatSupported('image/jpeg'));
});

test('isFormatSupported returns true for png', () => {
    assertTrue(APP_CONFIG.isFormatSupported('image/png'));
});

test('isFormatSupported returns false for gif', () => {
    assertFalse(APP_CONFIG.isFormatSupported('image/gif'));
});

test('isFileSizeValid returns true for 5MB', () => {
    assertTrue(APP_CONFIG.isFileSizeValid(5 * 1024 * 1024));
});

test('isFileSizeValid returns false for 15MB', () => {
    assertFalse(APP_CONFIG.isFileSizeValid(15 * 1024 * 1024));
});

test('isFileSizeValid returns true for exactly 10MB', () => {
    assertTrue(APP_CONFIG.isFileSizeValid(10 * 1024 * 1024));
});

console.log('\n📋 Options Tests:');

test('postTypes has at least 5 options', () => {
    assertTrue(APP_CONFIG.postTypes.length >= 5);
});

test('tones has at least 4 options', () => {
    assertTrue(APP_CONFIG.tones.length >= 4);
});

test('captionLengths has short, medium, long', () => {
    const values = APP_CONFIG.captionLengths.map(l => l.value);
    assertIncludes(values, 'short');
    assertIncludes(values, 'medium');
    assertIncludes(values, 'long');
});

test('supportedSites includes instagram.com', () => {
    assertIncludes(APP_CONFIG.supportedSites, 'instagram.com');
});

// =============================================================================
// RÉSUMÉ
// =============================================================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50) + '\n');

process.exit(failed > 0 ? 1 : 0);
