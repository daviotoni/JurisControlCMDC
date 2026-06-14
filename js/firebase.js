// js/firebase.js
// Firebase + Auth + Firestore helpers (Compat)

// ============================================
// CONFIG
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

firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.storage = firebase.storage();
window.db = firebase.firestore();

console.log("✅ Firebase, Firestore e Storage inicializados");
// ============================================
// AUTH HELPERS
// ============================================

/**
 * Login com email e senha usando Firebase Auth
 */
async function loginComFirebase(email, senha) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, senha);
    console.log('✅ Login realizado com sucesso:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.error('❌ Erro no login Firebase:', error.code, error.message);
    throw error;
  }
}

/**
 * Logout
 */
async function logoutFirebase() {
  await auth.signOut();
  console.log('✅ Logout realizado');
}

/**
 * Observa mudanças no estado de autenticação
 */
function observarAuth(callback) {
  return auth.onAuthStateChanged(callback);
}

// Expõe as funções
window.loginComFirebase = loginComFirebase;
window.logoutFirebase = logoutFirebase;
window.observarAuth = observarAuth;

console.log("\n👉 Funções de Auth disponíveis:");
console.log("   loginComFirebase(email, senha)");
console.log("   logoutFirebase()");
console.log("   observarAuth(callback)");
