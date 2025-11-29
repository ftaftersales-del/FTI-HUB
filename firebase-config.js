// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyB9eQULzP4E2NfYc7CS-N0bKMMTMV0a-HM",
  authDomain: "ft-hub-797eb.firebaseapp.com",
  projectId: "ft-hub-797eb",
  storageBucket: "ft-hub-797eb.firebasestorage.app",   // <--- QUESTA È LA CHIAVE
  // se li hai, puoi (ma non è obbligatorio per Storage) aggiungere anche:
  // messagingSenderId: "XXXXXXX",
  // appId: "1:XXXXXXX:web:YYYYYYYY"
};

// inizializzazione condivisa per tutto il portale
firebase.initializeApp(firebaseConfig);

// comodo per il resto del codice globale:
const auth = firebase.auth();
const db   = firebase.firestore();
