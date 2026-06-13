// js/firebase.js
// Inicialização do Firebase usando a versão Compat (mais simples para o projeto atual)

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

// Cria referências globais úteis
window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("✅ Firebase inicializado com sucesso (versão Compat)");

// ============================================
// Funções de ajuda (vamos expandir depois)
// ============================================

// Exemplo futuro: salvar um processo
// async function salvarProcesso(processo) {
//   return await db.collection('processos').add(processo);
// }
