// Config do Vitest para os testes de lógica pura do JurisControl.
//
// Um único runner cobre as DUAS implementações (web e mobile), o que permite
// inclusive testes de paridade (garantir que js/utils.js e mobile/.../dates.ts
// não divirjam). Só entram no escopo funções PURAS — nada de React Native,
// Firebase ou DOM real (o jsdom cobre o `document` usado por sanitizeHTML).
//
// Rodar:  npm test        (watch)
//         npm run test:run  (uma passada, usado no CI)

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Nota: os arquivos TS do mobile são transformados pelo oxc, que carrega o
  // tsconfig mais próximo. Um `mobile/src/tsconfig.json` auto-contido evita que
  // ele suba até o mobile/tsconfig.json (que estende `expo/tsconfig.base`, não
  // instalado fora do toolchain do Expo). Ver o comentário naquele arquivo.
  test: {
    // jsdom fornece `document` para sanitizeHTML; inofensivo para o resto.
    environment: 'jsdom',
    // describe/it/expect globais, sem precisar importar em cada arquivo.
    globals: true,
    include: ['test/**/*.test.{js,ts}'],
    // Os testes das firestore.rules precisam do emulador do Firestore rodando,
    // então NÃO entram no runner rápido — têm config e script próprios
    // (vitest.rules.config.js / `npm run test:rules`).
    exclude: ['test/rules/**', 'node_modules/**'],
  },
});
