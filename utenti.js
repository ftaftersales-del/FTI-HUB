firebase.firestore().collection('utenti').get().then(querySnapshot => {
  let html = '<ul>';
  querySnapshot.forEach(doc => {
    const utente = doc.data();
    html += `<li>UID: ${doc.id} | Ruolo: ${utente.ruolo}</li>`;
  });
  html += '</ul>';
  document.getElementById('user-list').innerHTML = html;
});

window.aggiornaUtente = function() {
  const uid = document.getElementById('uid').value;
  const ruolo = document.getElementById('ruolo').value;
  firebase.firestore().collection('utenti').doc(uid).set({ ruolo })
    .then(() => {
      alert('Utente aggiornato!');
      location.reload();
    })
    .catch(e => alert(e.message));
};
