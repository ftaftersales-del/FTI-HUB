# Firebase HTML Login Admin

**Progetto di esempio** che utilizza Firebase Authentication e Firestore per la gestione di login, ruoli e utenti.

## Funzionamento

- `index.html`: login; se utente è "admin" accede alla main, altrimenti vede "in costruzione"
- `main.html`: grossi tasti per scelte (admin)
- `dms.html`: pagina gestione utenti Firestore ("DMS")
- `firebase-config.js`: configura Firebase per il progetto
- `utenti.js`: script per aggiungere/modificare utenti Firestore

## Prerequisiti

- Crea un progetto su [console Firebase](https://console.firebase.google.com/)
- Inserisci i tuoi dati in `firebase-config.js`
- Su Firestore crea la collection chiamata **utenti**

---

**Per dubbi o richieste, chiedimi qui!**
