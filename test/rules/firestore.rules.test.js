// Testes de INTEGRAÇÃO das firestore.rules contra o emulador do Firestore.
//
// Objetivo: travar as garantias de segurança do modelo de acesso por papel
// (perfis/{uid} com aprovação por admin), para que uma regressão — afrouxar a
// autenticação, permitir auto-aprovação, reintroduzir o curinga `{document=**}`
// ou esquecer uma coleção — quebre o CI em vez de passar despercebida.
//
// Rodar: `npm run test:rules` (sobe o emulador automaticamente).
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Coleções de DADOS liberadas para qualquer usuário APROVADO
// (devem bater com o bloco "Dados de trabalho" de firestore.rules).
const COLECOES_APROVADO = [
  'processos', 'pareceres', 'parecerVersoes', 'documentos', 'versoes',
  'calendario', 'emissores', 'modelos', 'leis', 'config',
];
// Coleções com regra própria (também declaradas em firestore.rules).
const COLECOES_ESPECIAIS = ['perfis', 'historico', 'auditoria', 'users'];

// Deve bater com a lista BOOTSTRAP_ADMINS em js/app.js e bootstrapAdmin() nas rules.
const EMAIL_BOOTSTRAP = 'dosvleite@yahoo.com.br';

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

// Grava perfis direto no banco (sem regras), simulando o estado provisionado.
async function seedPerfil(uid, dados) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'perfis', uid), dados);
  });
}
const perfilAprovado = (uid, role = 'user') => ({
  uid, email: `${uid}@teste.dev`, name: uid, role, aprovado: true,
});

describe('usuário NÃO autenticado', () => {
  it('não consegue ler nem escrever em coleção permitida', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'processos', 'p1')));
    await assertFails(setDoc(doc(db, 'processos', 'p1'), { num: '001' }));
  });
});

describe('usuário autenticado SEM perfil aprovado', () => {
  it('não acessa nenhuma coleção de dados', async () => {
    const db = testEnv.authenticatedContext('sem-perfil').firestore();
    for (const colecao of [...COLECOES_APROVADO, 'historico']) {
      await assertFails(setDoc(doc(db, colecao, 'doc1'), { ok: true }));
      await assertFails(getDoc(doc(db, colecao, 'doc1')));
    }
  });

  it('perfil PENDENTE (aprovado=false) também não acessa dados', async () => {
    await seedPerfil('pendente-1', { ...perfilAprovado('pendente-1'), aprovado: false });
    const db = testEnv.authenticatedContext('pendente-1').firestore();
    await assertFails(getDoc(doc(db, 'processos', 'p1')));
    await assertFails(setDoc(doc(db, 'processos', 'p1'), { num: '001' }));
  });

  it('pode se auto-registrar como usuário comum PENDENTE (primeiro login)', async () => {
    const db = testEnv.authenticatedContext('novato').firestore();
    await assertSucceeds(setDoc(doc(db, 'perfis', 'novato'), {
      uid: 'novato', email: 'novato@teste.dev', name: 'novato', role: 'user', aprovado: false,
    }));
  });

  it('NÃO pode se auto-aprovar nem se auto-promover a admin', async () => {
    const db = testEnv.authenticatedContext('espertinho').firestore();
    await assertFails(setDoc(doc(db, 'perfis', 'espertinho'), {
      uid: 'espertinho', role: 'user', aprovado: true,
    }));
    await assertFails(setDoc(doc(db, 'perfis', 'espertinho'), {
      uid: 'espertinho', role: 'admin', aprovado: false,
    }));
    // ...nem criar perfil para OUTRO uid.
    await assertFails(setDoc(doc(db, 'perfis', 'vitima'), {
      uid: 'vitima', role: 'user', aprovado: false,
    }));
  });
});

describe('usuário APROVADO (papel: user)', () => {
  const UID = 'user-aprovado';
  beforeEach(async () => {
    await seedPerfil(UID, perfilAprovado(UID));
  });

  it('lê e escreve em todas as coleções de dados', async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    for (const colecao of COLECOES_APROVADO) {
      await assertSucceeds(setDoc(doc(db, colecao, 'doc1'), { ok: true }));
      await assertSucceeds(getDoc(doc(db, colecao, 'doc1')));
    }
  });

  it('histórico e auditoria são APPEND-ONLY para ele', async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, 'historico', 'h1'), { acao: 'criado' }));
    await assertFails(updateDoc(doc(db, 'historico', 'h1'), { acao: 'adulterado' }));
    await assertFails(deleteDoc(doc(db, 'historico', 'h1')));
    await assertSucceeds(setDoc(doc(db, 'auditoria', 'a1'), { acao: 'login' }));
    await assertFails(getDoc(doc(db, 'auditoria', 'a1'))); // ler auditoria é só admin
    await assertFails(deleteDoc(doc(db, 'auditoria', 'a1')));
  });

  it('NÃO gerencia perfis de outros nem escala o próprio papel', async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await seedPerfil('outro', perfilAprovado('outro'));
    await assertFails(updateDoc(doc(db, 'perfis', 'outro'), { role: 'user', aprovado: false }));
    await assertFails(updateDoc(doc(db, 'perfis', UID), { role: 'admin' }));
    // ...mas pode ajustar o próprio nome (role/aprovado intactos).
    await assertSucceeds(updateDoc(doc(db, 'perfis', UID), { name: 'Novo Nome' }));
  });

  it('NÃO acessa a coleção legada `users` nem coleções fora da allowlist', async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertFails(getDoc(doc(db, 'users', 'u1')));
    await assertFails(setDoc(doc(db, 'users', 'u1'), { hackeado: true }));
    // Se alguém reintroduzir `match /{document=**}`, estes passam a suceder e o teste falha.
    await assertFails(setDoc(doc(db, 'intrusos', 'x'), { dado: 'exfiltrado' }));
    await assertFails(getDoc(doc(db, 'colecaoInventada', 'y')));
  });
});

describe('ADMIN aprovado', () => {
  const UID = 'admin-1';
  beforeEach(async () => {
    await seedPerfil(UID, perfilAprovado(UID, 'admin'));
  });

  it('gerencia perfis: aprova, promove e remove', async () => {
    await seedPerfil('novato', { ...perfilAprovado('novato'), aprovado: false });
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(updateDoc(doc(db, 'perfis', 'novato'), { aprovado: true }));
    await assertSucceeds(updateDoc(doc(db, 'perfis', 'novato'), { role: 'admin' }));
    await assertSucceeds(deleteDoc(doc(db, 'perfis', 'novato')));
  });

  it('lê e limpa auditoria, mas NÃO edita registros (append-only de verdade)', async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, 'auditoria', 'a1'), { acao: 'login' }));
    await assertSucceeds(getDoc(doc(db, 'auditoria', 'a1')));
    await assertFails(updateDoc(doc(db, 'auditoria', 'a1'), { acao: 'adulterado' }));
    await assertSucceeds(deleteDoc(doc(db, 'auditoria', 'a1')));
  });

  it('acessa a coleção legada `users`', async () => {
    const db = testEnv.authenticatedContext(UID).firestore();
    await assertSucceeds(setDoc(doc(db, 'users', 'u1'), { legado: true }));
    await assertSucceeds(getDoc(doc(db, 'users', 'u1')));
  });
});

describe('BOOTSTRAP admin (anti-lockout por e-mail)', () => {
  it('tem poderes de admin mesmo sem doc de perfil', async () => {
    const db = testEnv
      .authenticatedContext('boot-1', { email: EMAIL_BOOTSTRAP })
      .firestore();
    await assertSucceeds(setDoc(doc(db, 'processos', 'p1'), { num: '001' }));
    await assertSucceeds(setDoc(doc(db, 'perfis', 'boot-1'), {
      uid: 'boot-1', email: EMAIL_BOOTSTRAP, role: 'admin', aprovado: true,
    }));
    await assertSucceeds(getDoc(doc(db, 'auditoria', 'a1')));
  });

  it('e-mail qualquer NÃO ganha bootstrap', async () => {
    const db = testEnv
      .authenticatedContext('mal-1', { email: 'atacante@evil.dev' })
      .firestore();
    await assertFails(setDoc(doc(db, 'processos', 'p1'), { num: '001' }));
  });
});

describe('sanidade da configuração', () => {
  it('a lista de coleções testadas cobre todas as declaradas em firestore.rules', () => {
    // Extrai `match /<colecao>/{...}` do arquivo de regras e compara com as listas
    // acima — assim, ao adicionar uma coleção nova sem testá-la, este teste avisa.
    const regras = readFileSync('firestore.rules', 'utf8');
    // Só regras de coleção: `match /<nome>/{id} { ... }` (o `\}\s*\{` no fim
    // exclui a linha externa `match /databases/{database}/documents {`).
    const declaradas = [...regras.matchAll(/match\s+\/([A-Za-z0-9_]+)\/\{[^}]*\}\s*\{/g)].map((m) => m[1]);
    expect([...declaradas].sort()).toEqual([...COLECOES_APROVADO, ...COLECOES_ESPECIAIS].sort());
  });

  it('o e-mail de bootstrap do teste é o mesmo declarado nas rules', () => {
    const regras = readFileSync('firestore.rules', 'utf8');
    expect(regras).toContain(`'${EMAIL_BOOTSTRAP}'`);
  });
});
