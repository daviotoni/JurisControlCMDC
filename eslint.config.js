// Config do ESLint (flat config) para o JurisControl.
// Foco: pegar BUGS reais (variável não definida, chave duplicada, código
// inalcançável, etc.) no js/ — sem exigir build e sem mexer no runtime.
// O mobile/ tem seu próprio setup (TypeScript/Expo) e não é lintado aqui.

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'app/**', 'mobile/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script', // app.js é script clássico (IIFE), não ES module
      globals: {
        ...globals.browser,
        // Bibliotecas externas carregadas via <script> no index.html
        firebase: 'readonly',
        Chart: 'readonly',
        Quill: 'readonly',
        XLSX: 'readonly',
        ExcelJS: 'readonly',
        mammoth: 'readonly',
        jspdf: 'readonly',
        jsPDF: 'readonly',
        saveAs: 'readonly',
        // Globais definidos por assignment em window (firebase.js / firestoreHelper.js / app.js)
        auth: 'readonly',
        db: 'readonly',
        storage: 'readonly',
        dbHelper: 'readonly',
        dbHelperFs: 'readonly',
        firestoreHelper: 'readonly',
        openMobileMenu: 'readonly',
        closeMobileMenu: 'readonly',
      },
    },
    rules: {
      // Ruído estilístico / de manutenção → aviso (não quebra o CI)
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      // Bugs reais → erro (quebra o CI)
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-cond-assign': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    // loginComFirebase/logoutFirebase/observarAuth são declaradas em firebase.js
    // e apenas CONSUMIDAS por app.js — declará-las como global só aqui evita
    // tanto o no-undef (em app.js) quanto o no-redeclare (em firebase.js).
    files: ['js/app.js'],
    languageOptions: {
      globals: {
        loginComFirebase: 'readonly',
        logoutFirebase: 'readonly',
        observarAuth: 'readonly',
      },
    },
  },
];
