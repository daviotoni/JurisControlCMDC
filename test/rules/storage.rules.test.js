// Testes de INTEGRAÇÃO das storage.rules contra o emulador do Firebase Storage.
//
// Garante que o acesso a arquivos (anexos, modelos, leis) exige autenticação —
// a mesma proteção do Firestore, mas para o bucket de Storage.
//
// Rodar: `npm run test:rules` (sobe os emuladores de Firestore + Storage).
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-juriscontrol',
    storage: {
      rules: readFileSync('storage.rules', 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
});

const arquivoPequeno = () => new Uint8Array([1, 2, 3, 4]);

describe('usuário NÃO autenticado', () => {
  it('não consegue ler um arquivo', async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, 'documentos/x.pdf')));
  });

  it('não consegue enviar um arquivo', async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(uploadBytes(ref(storage, 'documentos/x.pdf'), arquivoPequeno()));
  });
});

describe('usuário autenticado', () => {
  it('consegue enviar e depois ler um arquivo dentro do limite de tamanho', async () => {
    const storage = testEnv.authenticatedContext('user-123').storage();
    const caminho = ref(storage, 'documentos/contrato.pdf');
    await assertSucceeds(uploadBytes(caminho, arquivoPequeno()));
    await assertSucceeds(getBytes(caminho));
  });
});

// Observação: o limite de 100 MB por upload (request.resource.size < 100*1024*1024)
// não é exercitado aqui de propósito — exigiria um payload de 100 MB, pesado e
// lento para o CI. Os testes acima cobrem a garantia principal (acesso só
// autenticado); o ramo do tamanho fica coberto pela leitura das próprias regras.
