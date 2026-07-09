// Config do Vitest SÓ para os testes das firestore.rules.
//
// Diferente dos testes rápidos (vitest.config.js), estes são de INTEGRAÇÃO:
// falam com o emulador do Firestore. Por isso rodam separados, via
// `npm run test:rules` (que sobe o emulador com `firebase emulators:exec`).
//
// Ambiente `node` (não jsdom) — não há DOM aqui, só o SDK do Firestore.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/rules/**/*.test.{js,ts}'],
  },
});
