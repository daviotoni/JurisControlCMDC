// js/firebase.js
// Firebase + Auth + Firestore + Storage helpers (Compat)

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

window.auth    = firebase.auth();
window.db      = firebase.firestore();
window.storage = firebase.storage();


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
 * Envia e-mail de redefinição de senha via Firebase Auth
 */
async function resetSenhaFirebase(email) {
  await auth.sendPasswordResetEmail(email);
  console.log('✅ E-mail de redefinição enviado para:', email);
}

/**
 * Observa mudanças no estado de autenticação
 */
function observarAuth(callback) {
  return auth.onAuthStateChanged(callback);
}

// Expõe as funções globalmente
window.loginComFirebase  = loginComFirebase;
window.logoutFirebase    = logoutFirebase;
window.observarAuth      = observarAuth;
window.resetSenhaFirebase = resetSenhaFirebase;

