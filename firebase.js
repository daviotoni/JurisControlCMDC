import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIZaSyB9dx_F8splj8n_ajSJRGiAqb02u8dUvJQ",
  authDomain: "juriscontrolcmdc.firebaseapp.com",
  projectId: "juriscontrolcmdc",
  storageBucket: "juriscontrolcmdc.firebasestorage.app",
  messagingSenderId: "570109438050",
  appId: "1:570109438050:web:ddb296a9863cdd294e093b"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
