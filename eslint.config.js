/**
 * The checks every push runs over the code: mistakes, not taste. The site's
 * own scripts are plain browser scripts, one IIFE each, sharing a few globals;
 * everything else is Node.
 */
'use strict';

const js = require('@eslint/js');
const globals = require('globals');

/* What the site's scripts hand one another on window */
const SITE = {
  $: 'readonly', jQuery: 'readonly', T: 'readonly',
  I18n: 'readonly', Mushaf: 'readonly', Recite: 'readonly', Meaning: 'readonly',
  Ayahs: 'readonly', Listen: 'readonly', Pager: 'readonly', Offline: 'readonly',
  Leaves: 'readonly', umami: 'readonly',
  QuranShell: 'readonly',   // the Android app's bridge, where the site runs inside it
};

module.exports = [
  { ignores: ['**/node_modules/**', 'tests/vendor/**', '**/*.min.js', 'public/surah/**', 'public/juz/**', 'reference/**', 'qul/**'] },
  js.configs.recommended,
  {
    files: ['public/js/**/*.js', 'public/admin/**/*.js', 'feedback/admin/**/*.js', 'tests/audit.js'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: { ...globals.browser, ...SITE } },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'server.js', 'feedback/src/**/*.js', 'feedback/test/**/*.js', 'mcp/**/*.js', 'eslint.config.js'],
    ignores: ['tests/audit.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    // Browser tests: the functions handed to page.evaluate run in the page
    files: ['tests/check-browser.js', 'tests/check-dom.js'],
    languageOptions: { globals: { ...globals.browser, $: 'readonly' } },
  },
  {
    rules: {
      // An unused argument documents a callback's shape; an unused variable is a mistake
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      // Empty catch blocks here say why in a comment
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
