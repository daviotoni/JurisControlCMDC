// js/firebase.js
// Inicialização do Firebase + Funções de ajuda (versão Compat)

// ============================================
// CONFIGURAÇÃO DO SEU PROJETO FIREBASE
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyB9dx_F8splj8n_ajSJRGiAqbo2u8dUvJQ",
  authDomain: "juriscontrolcmdc.firebaseapp.com",
  projectId: "juriscontrolcmdc",
  storageBucket: "juriscontrolcmdc.firebasestorage.app",
  messagingSenderId: "570109438050",
  appId: "1:570109438050:web:34b78eef96a240734e093b",
  measurementId: "G-7ZVC7NZRML"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("✅ Firebase inicializado com sucesso");

// ============================================
// FUNÇÕES DE AJUDA - FIRESTORE
// ============================================

/**
 * Salva um novo processo no Firestore
 * @param {Object} processo - Objeto com os dados do processo
 */
async function salvarProcesso(processo) {
  try {
    const docRef = await db.collection('processos').add({
      ...processo,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Processo salvo com ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao salvar processo:', error);
    throw error;
  }
}

/**
 * Carrega todos os processos do Firestore
 */
async function carregarProcessos() {
  try {
    const snapshot = await db.collection('processos').orderBy('criadoEm', 'desc').get();
    const processos = [];
    snapshot.forEach(doc => {
      processos.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ ${processos.length} processos carregados`);
    return processos;
  } catch (error) {
    console.error('❌ Erro ao carregar processos:', error);
    throw error;
  }
}

/**
 * Teste rápido - cria um processo de exemplo
 */
async function testeSalvarProcesso() {
  const processoTeste = {
    num: "TESTE-001",
    tipo: "Ação Civil",
    obj: "Teste de integração Firebase",
    stat: "Em andamento",
    prazo: "2026-07-01"
  };
  
  const id = await salvarProcesso(processoTeste);
  console.log('ID do processo teste:', id);
  return id;
}

// Deixa as funções acessíveis no console do navegador
window.salvarProcesso = salvarProcesso;
window.carregarProcessos = carregarProcessos;
window.testeSalvarProcesso = testeSalvarProcesso;

console.log("\n👉 Funções disponíveis no console:");
console.log("   - testeSalvarProcesso()   // cria um processo de teste");
console.log("   - carregarProcessos()     // lista todos os processos");
console.log("   - salvarProcesso({...})   // salva um processo manualmente");
