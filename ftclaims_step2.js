// ===============================
// ftclaims_step2.js
// Logica specifica della pagina FTCLAIMS_STEP2
// ===============================

// Firestore
let db = null;

// Dati della ClaimCard corrente
let currentClaimCardId = null;
let currentClaimCardType = null; // "Warranty" | "Maintenance" | "FSA" | "Goodwill"

document.addEventListener("DOMContentLoaded", () => {
  // Inizializza Firestore (firebase-config.js deve aver già fatto initializeApp)
  if (!firebase.apps.length) {
    console.error("Firebase non inizializzato. Controlla firebase-config.js");
    return;
  }
  db = firebase.firestore();

  // Recupero ID e tipo della ClaimCard da sessionStorage (puoi cambiare se usi altro metodo)
  currentClaimCardId = sessionStorage.getItem("currentClaimCardId");
  currentClaimCardType = sessionStorage.getItem("currentClaimCardType");

  if (!currentClaimCardId || !currentClaimCardType) {
    console.error("ClaimCard corrente non definita. currentClaimCardId / currentClaimCardType mancanti.");
    alert("Errore: nessuna ClaimCard selezionata. Torna alla pagina precedente.");
    return;
  }

  // Mostra info base (opzionale, solo se hai questi elementi HTML)
  const spanCardId = document.getElementById("claimCardIdDisplay");
  const spanCardType = document.getElementById("claimCardTypeDisplay");
  if (spanCardId) spanCardId.textContent = currentClaimCardId;
  if (spanCardType) spanCardType.textContent = currentClaimCardType;

  // Inizializza la UI della tipologia claim (combobox o tipo fisso)
  initClaimTypeControls(currentClaimCardType);

  // Aggancio evento al bottone "Nuovo claim" / "Salva claim"
  const btnSaveClaim = document.getElementById("btnSaveClaim");
  if (btnSaveClaim) {
    btnSaveClaim.addEventListener("click", onSaveClaim);
  } else {
    console.warn("Bottone #btnSaveClaim non trovato nell'HTML.");
  }

  // Qui potresti aggiungere il caricamento della lista claims esistenti, se già previsto
  // loadClaimsList();
});

// ===============================
// Salvataggio di un nuovo claim
// ===============================
async function onSaveClaim() {
  if (!db || !currentClaimCardId || !currentClaimCardType) {
    alert("Errore interno: dati ClaimCard mancanti.");
    return;
  }

  // 1. Tipologia claim (gestita dalla logica esterna in ftclaims-claims.js)
  const claimType = getCurrentClaimType(currentClaimCardType);
  if (!claimType) {
    alert("Seleziona una tipologia di claim valida.");
    return;
  }

  // 2. Leggi gli altri campi della pagina (adatta agli ID reali dei tuoi input)
  const descriptionInput = document.getElementById("claimDescription");
  const notesInput = document.getElementById("claimNotes");
  const amountInput = document.getElementById("claimAmount");

  const description = descriptionInput ? descriptionInput.value.trim() : "";
  const notes = notesInput ? notesInput.value.trim() : "";
  const amount = amountInput ? parseFloat(amountInput.value.replace(",", ".")) : null;

  if (!description) {
    alert("Inserisci una descrizione del claim.");
    return;
  }

  // 3. Crea oggetto claim da salvare
  const now = new Date();
  const newClaimData = {
    claimType: claimType,              // RSA / Garanzia / Garanzia Ricambio / Manutenzione / FSA / Goodwill
    description: description || null,
    notes: notes || null,
    amount: isNaN(amount) ? null : amount,
    createdAt: firebase.firestore.Timestamp.fromDate(now),
    status: "Aperto"                   // opzionale: stato iniziale
    // Qui puoi aggiungere altri campi che ti servono (es: user, dealer, ecc.)
  };

  try {
    // 4. Salvo il claim come sottocollezione del ClaimCard
    // Percorso: ClaimCards/{claimCardId}/Claims/{auto-id}
    await db
      .collection("ClaimCards")
      .doc(currentClaimCardId)
      .collection("Claims")
      .add(newClaimData);

    alert("Claim salvato correttamente.");

    // Reset form (se vuoi)
    if (descriptionInput) descriptionInput.value = "";
    if (notesInput) notesInput.value = "";
    if (amountInput) amountInput.value = "";

    // Qui potresti ricaricare la lista claims se la mostri a schermo:
    // loadClaimsList();

  } catch (error) {
    console.error("Errore nel salvataggio del claim:", error);
    alert("Errore nel salvataggio del claim. Controlla la console.");
  }
}
