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
    // utils.js, assets.js e parecer-modelos.js definem globais CONSUMIDOS por
    // app.js (outro arquivo). O ESLint, analisando arquivo a arquivo, não
    // enxerga esse uso — então o no-unused-vars daria falso-positivo aqui.
    files: ['js/utils.js', 'js/assets.js', 'js/parecer-modelos.js'],
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // utils.js expõe um bloco `module.exports` (guardado por typeof) para os
    // testes rodarem em Node/Vitest. `module` é global do CommonJS, não do
    // navegador — declará-lo aqui evita o no-undef sem afetar o runtime.
    files: ['js/utils.js'],
    languageOptions: { globals: { module: 'readonly' } },
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
        resetSenhaFirebase: 'readonly',
        // Definidos em js/utils.js (carregado antes do app.js)
        fmtBR: 'readonly',
        parse: 'readonly',
        todayUTC: 'readonly',
        diffDays: 'readonly',
        ymd: 'readonly',
        sanitizeHTML: 'readonly',
        safeCSSClass: 'readonly',
        getChanges: 'readonly',
        base64ToArrayBuffer: 'readonly',
        getMimeType: 'readonly',
        filtrarOrdenarProcessos: 'readonly',
        normalizeParecerParaLista: 'readonly',
        combinarPareceres: 'readonly',
        versoesDoDocumento: 'readonly',
        versaoAtual: 'readonly',
        versoesDoParecer: 'readonly',
        inferirParecerInfo: 'readonly',
        normalizarConsultaJuris: 'readonly',
        jurisSemAcento: 'readonly',
        expandirConsultaJuris: 'readonly',
        filtrarOrdenarResultadosJuris: 'readonly',
        VALID_STATS: 'readonly',
        VALID_ACAO: 'readonly',
        VALID_CAT: 'readonly',
        VALID_PARECER_STATUS: 'readonly',
        // Definido em js/assets.js
        BRASAO_DUQUE_DE_CAXIAS_B64: 'readonly',
        // Definido em js/fonts-garamond.js
        EBGARAMOND_B64: 'readonly',
        // Definidos em js/parecer-modelos.js (carregado antes do app.js)
        PARECER_TEMPLATES: 'readonly',
        getParecerTemplate: 'readonly',
        buildParecerDelta: 'readonly',
        buildParecerSeedDelta: 'readonly',
        separarTituloEmbutido: 'readonly',
      },
    },
  },
];
