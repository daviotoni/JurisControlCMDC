import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword, createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIZaSyB9dx_F8splj8n_ajSJRGiAqb02u8dUvJQ",
  authDomain: "juriscontrolcmdc.firebaseapp.com",
  projectId: "juriscontrolcmdc",
  storageBucket: "juriscontrolcmdc.firebasestorage.app",
  messagingSenderId: "570109438050",
  appId: "1:570109438050:web:ddb296a9863cdd294e093b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const signInWithEmailAndPassword = (email, password) =>
  firebaseSignInWithEmailAndPassword(auth, email, password);

const createUserWithEmailAndPassword = (email, password) =>
  firebaseCreateUserWithEmailAndPassword(auth, email, password);

export { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword };
