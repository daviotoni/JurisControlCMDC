// Variante WEB (resolvida pelo Metro no export web): usa a persistência de
// navegador do Firebase Auth em vez do AsyncStorage nativo.
// Mesmo projeto Firebase do sistema web (js/firebase.js).
import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyB9dx_F8splj8n_ajSJRGiAqbo2u8dUvJQ',
  authDomain: 'juriscontrolcmdc.firebaseapp.com',
  projectId: 'juriscontrolcmdc',
  storageBucket: 'juriscontrolcmdc.firebasestorage.app',
  messagingSenderId: '570109438050',
  appId: '1:570109438050:web:34b78eef96a240734e093b',
  measurementId: 'G-7ZVC7NZRML',
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});

export const db = getFirestore(app);
export const storage = getStorage(app);
