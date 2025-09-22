import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Configuração do Firebase usando variáveis de ambiente
// IMPORTANTE: As chaves reais devem ser definidas em um arquivo .env ou nas configurações do servidor
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
  authDomain: window.FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
  projectId: window.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
  storageBucket: window.FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.FIREBASE_APP_ID || process.env.FIREBASE_APP_ID
};

// Verificar se todas as configurações necessárias estão presentes
const requiredConfigs = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingConfigs = requiredConfigs.filter(key => !firebaseConfig[key]);

if (missingConfigs.length > 0) {
  console.error('Configurações do Firebase ausentes:', missingConfigs);
  throw new Error(`Configurações do Firebase não encontradas: ${missingConfigs.join(', ')}`);
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
