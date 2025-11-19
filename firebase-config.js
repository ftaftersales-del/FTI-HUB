const firebaseConfig = {
  apiKey: "AIzaSyB9eQULzP4E2NfYc7CS-N0bKMMTMV0a-HM",
  authDomain: "ft-hub-797eb.firebaseapp.com",
  projectId: "ft-hub-797eb",
  // qui nella realtà metti anche gli altri campi
  // (storageBucket, messagingSenderId, appId, ecc.)
};

firebase.initializeApp(firebaseConfig);

// comodo per il resto del codice:
const auth = firebase.auth();
const db = firebase.firestore();
