// Testes de INTEGRAÇÃO das firestore.rules contra o emulador do Firestore.
//
// Objetivo: travar as garantias de segurança que a mudança recente introduziu
// (allowlist explícita de coleções, sem curinga `{document=**}`), para que uma
// regressão — reintroduzir o curinga, afrouxar a autenticação ou esquecer de
// listar uma coleção — quebre o CI em vez de passar despercebida.
//
// Rodar: `npm run test:rules` (sobe o emulador automaticamente).
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Coleções efetivamente permitidas pelas regras (devem bater com firestore.rules).
const COLECOES_PERMITIDAS = [
  'processos', 'pareceres', 'parecerVersoes', 'documentos', 'versoes',
  'calendario', 'emissores', 'modelos', 'leis', 'historico', 'config', 'users',
];

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-juriscontrol',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('usuário NÃO autenticado', () => {
  it('não consegue ler uma coleção permitida', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'processos', 'p1')));
  });

  it('não consegue escrever numa coleção permitida', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, 'processos', 'p1'), { num: '001' }));
  });
});

describe('usuário autenticado', () => {
  it('consegue escrever e ler em cada coleção da allowlist', async () => {
    const db = testEnv.authenticatedContext('user-123').firestore();
    for (const colecao of COLECOES_PERMITIDAS) {
      await assertSucceeds(setDoc(doc(db, colecao, 'doc1'), { ok: true }));
      await assertSucceeds(getDoc(doc(db, colecao, 'doc1')));
    }
  });

  it('NÃO consegue acessar coleção fora da allowlist (curinga removido)', async () => {
    const db = testEnv.authenticatedContext('user-123').firestore();
    // Se alguém reintroduzir `match /{document=**}`, estes passam a suceder e o teste falha.
    await assertFails(setDoc(doc(db, 'intrusos', 'x'), { dado: 'exfiltrado' }));
    await assertFails(getDoc(doc(db, 'colecaoInventada', 'y')));
  });
});

describe('sanidade da configuração', () => {
  it('a lista de coleções testadas cobre todas as declaradas em firestore.rules', () => {
    // Extrai `match /<colecao>/{...}` do arquivo de regras e compara com a lista
    // acima — assim, ao adicionar uma coleção nova sem testá-la, este teste avisa.
    const regras = readFileSync('firestore.rules', 'utf8');
    // Só regras de coleção: `match /<nome>/{id} { ... }` (o `\}\s*\{` no fim
    // exclui a linha externa `match /databases/{database}/documents {`).
    const declaradas = [...regras.matchAll(/match\s+\/([A-Za-z0-9_]+)\/\{[^}]*\}\s*\{/g)].map((m) => m[1]);
    expect([...declaradas].sort()).toEqual([...COLECOES_PERMITIDAS].sort());
  });
});
