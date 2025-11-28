// ================== FTHOTLINE.js ==================

// Init Firebase (se non già fatto in firebase-config.js)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ================== STATO GLOBALE ==================
let currentUser = null;
let currentUserData = null;   // doc in "Users"
let currentDealerId = null;
let currentUserRoles = [];    // es. ["Admin"]
let isDistributor = false;    // dealerId === "FT001"

let hotlineDepartments = [];  // {id, code, name, allowedRoles, order}
let hotlineTickets = [];      // lista ticket visibili
let selectedTicketId = null;

let ticketsUnsubscribe = null;
let messagesUnsubscribe = null;

// DOM refs
let currentUserInfoEl;
let searchInput, statusFilter, departmentFilter, ticketsList;
let noTicketSelectedMessage, ticketHeaderContent, ticketBodyContainer;
let ticketCodeInput, ticketSubjectInput, ticketDealerInput, ticketCreatorInput, ticketCreatedAtInput;
let ticketStatusBadge, ticketVinInput, ticketPlateInput, ticketKmInput, ticketEngineHoursInput, ticketDepartmentSelect;
let ticketBodyTextEl, ticketWarrantyRequestTextEl;
let chatMessagesEl, chatMessageInput, chatFileInput;
let btnNewTicket, btnCloseTicket, btnSendMessage;

// DOM refs modale nuovo ticket
let newTicketModal, newTicketSubjectInput, newTicketDepartmentSelect;
let newTicketVinInput, newTicketPlateInput, newTicketKmInput, newTicketEngineHoursInput;
let newTicketWarrantyInput, newTicketBodyInput;
let newTicketErrorEl, newTicketCancelBtn, newTicketSubmitBtn;

// ================== ON LOAD ==================
window.addEventListener("load", () => {
  // header utente
  currentUserInfoEl = document.getElementById("currentUserInfo");

  // pannello sinistro
  searchInput = document.getElementById("searchInput");
  statusFilter = document.getElementById("statusFilter");
  departmentFilter = document.getElementById("departmentFilter");
  ticketsList = document.getElementById("ticketsList");

  // dettaglio ticket
  noTicketSelectedMessage = document.getElementById("noTicketSelectedMessage");
  ticketHeaderContent = document.getElementById("ticketHeaderContent");
  ticketBodyContainer = document.getElementById("ticketBodyContainer");

  ticketCodeInput = document.getElementById("ticketCode");
  ticketSubjectInput = document.getElementById("ticketSubject");
  ticketDealerInput = document.getElementById("ticketDealer");
  ticketCreatorInput = document.getElementById("ticketCreator");
  ticketCreatedAtInput = document.getElementById("ticketCreatedAt");
  ticketStatusBadge = document.getElementById("ticketStatusBadge");

  ticketVinInput = document.getElementById("ticketVin");
  ticketPlateInput = document.getElementById("ticketPlate");
  ticketKmInput = document.getElementById("ticketKm");
  ticketEngineHoursInput = document.getElementById("ticketEngineHours");
  ticketDepartmentSelect = document.getElementById("ticketDepartment");

  ticketBodyTextEl = document.getElementById("ticketBodyText");
  ticketWarrantyRequestTextEl = document.getElementById("ticketWarrantyRequestText");

  // chat
  chatMessagesEl = document.getElementById("chatMessages");
  chatMessageInput = document.getElementById("chatMessageInput");
  chatFileInput = document.getElementById("chatFileInput");

  btnNewTicket = document.getElementById("btnNewTicket");
  btnCloseTicket = document.getElementById("btnCloseTicket");
  btnSendMessage = document.getElementById("btnSendMessage");

  // modale nuovo ticket
  newTicketModal = document.getElementById("newTicketModal");
  newTicketSubjectInput = document.getElementById("newTicketSubject");
  newTicketDepartmentSelect = document.getElementById("newTicketDepartment");
  newTicketVinInput = document.getElementById("newTicketVin");
  newTicketPlateInput = document.getElementById("newTicketPlate");
  newTicketKmInput = document.getElementById("newTicketKm");
  newTicketEngineHoursInput = document.getElementById("newTicketEngineHours");
  newTicketWarrantyInput = document.getElementById("newTicketWarranty");
  newTicketBodyInput = document.getElementById("newTicketBody");
  newTicketErrorEl = document.getElementById("newTicketError");
  newTicketCancelBtn = document.getElementById("newTicketCancel");
  newTicketSubmitBtn = document.getElementById("newTicketSubmit");

  // Eventi filtri/lista
  searchInput.addEventListener("input", renderTicketsList);
  statusFilter.addEventListener("change", renderTicketsList);
  departmentFilter.addEventListener("change", renderTicketsList);

  // Eventi azioni
  btnNewTicket.addEventListener("click", onNewTicketClick);
  btnCloseTicket.addEventListener("click", onCloseTicketClick);
  btnSendMessage.addEventListener("click", onSendMessageClick);

  newTicketCancelBtn.addEventListener("click", closeNewTicketModal);
  newTicketSubmitBtn.addEventListener("click", submitNewTicket);

  // Auth listener
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      currentUser = null;
      currentUserData = null;
      currentDealerId = null;
      currentUserRoles = [];
      isDistributor = false;
      currentUserInfoEl.textContent = "Non autenticato";
      clearTickets();
      return;
    }

    currentUser = user;

    try {
      await loadCurrentUserProfile();
      await loadDepartments();
      subscribeTickets();
    } catch (err) {
      console.error("Errore inizializzazione FTHOTLINE:", err);
      alert("Errore nel caricamento della Hotline. Controlla la console.");
    }
  });
});

// ================== PROFILO UTENTE (Users) ==================
async function loadCurrentUserProfile() {
  const uid = currentUser.uid;
  const docRef = db.collection("Users").doc(uid);
  const snap = await docRef.get();

  if (!snap.exists) {
    console.warn("Documento Users non trovato per uid:", uid);
    currentUserData = null;
    currentDealerId = null;
    currentUserRoles = [];
    isDistributor = false;
    currentUserInfoEl.textContent = "[Utente senza profilo Users]";
    return;
  }

  const data = snap.data();
  currentUserData = data;

  currentDealerId = data.dealerId || null;
  const roleId = data.role || "User";
  currentUserRoles = [roleId];
  isDistributor = currentDealerId === "FT001";

  const displayName = data.displayName || currentUser.email || "(utente)";
  currentUserInfoEl.textContent =
    `${displayName} - Dealer ${currentDealerId || "-"} - Ruolo: ${roleId}`;
}

// ================== REPARTI HOTLINE ==================
async function loadDepartments() {
  hotlineDepartments = [];

  try {
    // i documenti hanno: code, name, order, allowedRoles (array)
    const snap = await db.collection("HotlineDepartments")
      .orderBy("order", "asc")
      .get();

    snap.forEach((doc) => {
      const data = doc.data() || {};

      const allowed = Array.isArray(data.allowedRoles)
        ? data.allowedRoles
        : [];

      hotlineDepartments.push({
        id: doc.id,
        code: data.code || "",
        name: data.name || "",
        allowedRoles: allowed,
        order: data.order || 0,
      });
    });

    // riempi le combo
    fillDepartmentFilterSelect();
    fillTicketDepartmentSelect();
    fillNewTicketDepartmentSelect();

    console.log("Reparti caricati:", hotlineDepartments);
  } catch (err) {
    console.error("Errore caricamento HotlineDepartments:", err);
    alert("Errore nel caricamento dei reparti Hotline. Controlla la console.");
  }
}

function fillDepartmentFilterSelect() {
  departmentFilter.innerHTML = "";

  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Tutti i reparti";
  departmentFilter.appendChild(optAll);

  hotlineDepartments.forEach((dep) => {
    const opt = document.createElement("option");
    opt.value = dep.code;
    opt.textContent = dep.name;
    departmentFilter.appendChild(opt);
  });
}

function fillTicketDepartmentSelect() {
  ticketDepartmentSelect.innerHTML = "";

  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "";
  ticketDepartmentSelect.appendChild(optEmpty);

  hotlineDepartments.forEach((dep) => {
    const opt = document.createElement("option");
    opt.value = dep.code;
    opt.textContent = dep.name;
    ticketDepartmentSelect.appendChild(opt);
  });

  ticketDepartmentSelect.disabled = true; // solo lettura
}

function fillNewTicketDepartmentSelect() {
  newTicketDepartmentSelect.innerHTML = "";

  const optRoot = document.createElement("option");
  optRoot.value = "";
  optRoot.textContent = "Seleziona reparto";
  newTicketDepartmentSelect.appendChild(optRoot);

  hotlineDepartments.forEach((dep) => {
    const opt = document.createElement("option");
    opt.value = dep.code;
    opt.textContent = dep.name;
    newTicketDepartmentSelect.appendChild(opt);
  });
}

// ================== TICKET: SUBSCRIBE & RENDER ==================
function subscribeTickets() {
  if (!currentDealerId) {
    console.warn("Nessun dealerId, impossibile caricare i ticket.");
    return;
  }

  if (ticketsUnsubscribe) {
    ticketsUnsubscribe();
    ticketsUnsubscribe = null;
  }

  let query = db.collection("HotlineTickets");

  if (isDistributor) {
    // distributore: per ruolo, sui departmentRoles
    if (currentUserRoles.length > 0) {
      query = query.where("departmentRoles", "array-contains-any", currentUserRoles);
    } else {
      // nessun ruolo → nessun risultato
      query = query.where("departmentId", "==", "__none__");
    }
  } else {
    // dealer: solo ticket del proprio dealer
    query = query.where("dealerId", "==", currentDealerId);
  }

  query = query.orderBy("lastUpdate", "desc");

  ticketsUnsubscribe = query.onSnapshot(
    (snap) => {
      hotlineTickets = [];
      snap.forEach((doc) => {
        hotlineTickets.push({ id: doc.id, ...doc.data() });
      });

      console.log("Ticket hotline caricati:", hotlineTickets.length);
      renderTicketsList();

      if (selectedTicketId) {
        const stillExists = hotlineTickets.some((t) => t.id === selectedTicketId);
        if (!stillExists) {
          clearTicketDetail();
        } else {
          const t = hotlineTickets.find((tt) => tt.id === selectedTicketId);
          if (t) renderTicketDetail(t);
        }
      }
    },
    (err) => {
      console.error("Errore subscribe HotlineTickets:", err);
      alert("Errore nel caricamento dei ticket Hotline. Controlla la console.");
    }
  );
}

function renderTicketsList() {
  ticketsList.innerHTML = "";

  const search = (searchInput.value || "").trim().toLowerCase();
  const statusVal = statusFilter.value;
  const depVal = departmentFilter.value;

  let filtered = hotlineTickets.slice();

  if (statusVal) {
    filtered = filtered.filter((t) => t.status === statusVal);
  }

  if (depVal) {
    filtered = filtered.filter((t) => t.departmentId === depVal);
  }

  if (search) {
    filtered = filtered.filter((t) => {
      const code = (t.ticketCode || "").toLowerCase();
      const subject = (t.subject || "").toLowerCase();
      const vin = (t.vin || "").toLowerCase();
      const plate = (t.plate || "").toLowerCase();
      return (
        code.includes(search) ||
        subject.includes(search) ||
        vin.includes(search) ||
        plate.includes(search)
      );
    });
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ticket-item";
    empty.textContent = "Nessun ticket trovato.";
    ticketsList.appendChild(empty);
    return;
  }

  filtered.forEach((t) => {
    const item = document.createElement("div");
    item.className = "ticket-item";
    if (t.id === selectedTicketId) item.classList.add("selected");
    item.dataset.ticketId = t.id;

    const codeDiv = document.createElement("div");
    codeDiv.className = "ticket-item-code";
    codeDiv.textContent = t.ticketCode || "(senza codice)";

    const subjectDiv = document.createElement("div");
    subjectDiv.className = "ticket-item-subject";
    subjectDiv.textContent = t.subject || "(senza oggetto)";

    const metaDiv = document.createElement("div");
    metaDiv.className = "ticket-item-meta";
    const dealerText = isDistributor ? `Dealer ${t.dealerId || ""}` : "";
    const statusLabel = getStatusLabelForUser(t.status);
    const createdAt =
      t.createdAt && t.createdAt.toDate ? t.createdAt.toDate() : null;
    const dateStr = createdAt ? formatDateTimeShort(createdAt) : "";
    metaDiv.textContent = `${dealerText} ${
      statusLabel ? "- " + statusLabel : ""
    } ${dateStr ? "- " + dateStr : ""}`;

    item.appendChild(codeDiv);
    item.appendChild(subjectDiv);
    item.appendChild(metaDiv);

    item.addEventListener("click", () => onTicketSelected(t.id));

    ticketsList.appendChild(item);
  });
}

function clearTickets() {
  hotlineTickets = [];
  ticketsList.innerHTML = "";
  clearTicketDetail();
}

// ================== DETTAGLIO & CHAT ==================
function onTicketSelected(ticketId) {
  selectedTicketId = ticketId;

  document.querySelectorAll(".ticket-item").forEach((el) => {
    if (el.dataset.ticketId === ticketId) el.classList.add("selected");
    else el.classList.remove("selected");
  });

  const ticket = hotlineTickets.find((t) => t.id === ticketId);
  if (!ticket) {
    clearTicketDetail();
    return;
  }

  renderTicketDetail(ticket);
  subscribeMessages(ticket.id);
}

function clearTicketDetail() {
  selectedTicketId = null;

  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }

  noTicketSelectedMessage.style.display = "";
  ticketHeaderContent.style.display = "none";
  ticketBodyContainer.style.display = "none";

  ticketCodeInput.value = "";
  ticketSubjectInput.value = "";
  ticketDealerInput.value = "";
  ticketCreatorInput.value = "";
  ticketCreatedAtInput.value = "";
  ticketStatusBadge.textContent = "-";

  ticketVinInput.value = "";
  ticketPlateInput.value = "";
  ticketKmInput.value = "";
  ticketEngineHoursInput.value = "";
  ticketDepartmentSelect.value = "";

  ticketBodyTextEl.textContent = "";
  ticketWarrantyRequestTextEl.textContent = "";

  chatMessagesEl.innerHTML = "";
  chatMessageInput.value = "";
  chatFileInput.value = "";
}

function renderTicketDetail(ticket) {
  noTicketSelectedMessage.style.display = "none";
  ticketHeaderContent.style.display = "";
  ticketBodyContainer.style.display = "";

  ticketCodeInput.value = ticket.ticketCode || "";
  ticketSubjectInput.value = ticket.subject || "";
  ticketDealerInput.value = ticket.dealerId || "";
  ticketCreatorInput.value = ticket.creatorName || "";
  const createdAt =
    ticket.createdAt && ticket.createdAt.toDate
      ? ticket.createdAt.toDate()
      : null;
  ticketCreatedAtInput.value = createdAt ? formatDateTime(createdAt) : "";

  const statusInfo = getStatusLabelAndClass(ticket.status);
  ticketStatusBadge.textContent = statusInfo.label;
  ticketStatusBadge.classList.remove(
    "ticket-status-open",
    "ticket-status-waiting",
    "ticket-status-closed"
  );
  if (statusInfo.cssClass) ticketStatusBadge.classList.add(statusInfo.cssClass);

  ticketVinInput.value = ticket.vin || "";
  ticketPlateInput.value = ticket.plate || "";
  ticketKmInput.value = ticket.km != null ? ticket.km : "";
  ticketEngineHoursInput.value =
    ticket.engineHours != null ? ticket.engineHours : "";
  ticketDepartmentSelect.value = ticket.departmentId || "";

  ticketBodyTextEl.textContent = ticket.body || "";
  ticketWarrantyRequestTextEl.textContent = ticket.warrantyRequest || "";

  const isClosed = ticket.status === "closed";
  btnCloseTicket.disabled = isClosed;
  chatMessageInput.disabled = isClosed;
  chatFileInput.disabled = isClosed;
  btnSendMessage.disabled = isClosed;
  btnCloseTicket.textContent = isClosed ? "Ticket chiuso" : "Chiudi ticket";
}

// ================== CHAT ==================
function subscribeMessages(ticketId) {
  if (messagesUnsubscribe) {
    messagesUnsubscribe();
    messagesUnsubscribe = null;
  }

  const ref = db
    .collection("HotlineTickets")
    .doc(ticketId)
    .collection("messages")
    .orderBy("createdAt", "asc");

  messagesUnsubscribe = ref.onSnapshot(
    (snap) => {
      const messages = [];
      snap.forEach((doc) => messages.push({ id: doc.id, ...doc.data() }));
      renderMessages(messages);
    },
    (err) => {
      console.error("Errore subscribe messages hotline:", err);
    }
  );
}

function renderMessages(messages) {
  chatMessagesEl.innerHTML = "";

  if (!messages || messages.length === 0) {
    const empty = document.createElement("div");
    empty.style.fontSize = "12px";
    empty.style.color = "#555";
    empty.textContent = "Nessun messaggio. Scrivi la prima risposta.";
    chatMessagesEl.appendChild(empty);
    return;
  }

  messages.forEach((msg) => {
    const row = document.createElement("div");
    row.className = "chat-message-row";

    const fromDistributor =
      msg.authorIsDistributor === true || msg.authorDealerId === "FT001";
    row.classList.add(fromDistributor ? "distributor" : "dealer");

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (fromDistributor ? "distributor" : "dealer");

    const metaDiv = document.createElement("div");
    metaDiv.className = "chat-meta";

    const authorName = msg.authorName || "Sconosciuto";
    const dealerId = msg.authorDealerId || "";
    const createdAt =
      msg.createdAt && msg.createdAt.toDate ? msg.createdAt.toDate() : null;
    const dateStr = createdAt ? formatDateTimeShort(createdAt) : "";
    const roleText = dealerId === "FT001" ? "Distributore" : "Dealer";

    metaDiv.textContent = `${authorName} (${roleText} ${dealerId}) - ${dateStr}`;

    const textDiv = document.createElement("div");
    textDiv.textContent = msg.text || "";

    bubble.appendChild(metaDiv);
    bubble.appendChild(textDiv);

    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const attDiv = document.createElement("div");
      attDiv.className = "chat-attachments";
      attDiv.textContent = "Allegati: ";
      msg.attachments.forEach((att) => {
        if (!att.downloadUrl || !att.fileName) return;
        const link = document.createElement("a");
        link.href = att.downloadUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = att.fileName;
        attDiv.appendChild(link);
      });
      bubble.appendChild(attDiv);
    }

    row.appendChild(bubble);
    chatMessagesEl.appendChild(row);
  });

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// ================== INVIO MESSAGGIO ==================
async function onSendMessageClick() {
  if (!selectedTicketId) {
    alert("Seleziona prima un ticket.");
    return;
  }

  const ticket = hotlineTickets.find((t) => t.id === selectedTicketId);
  if (!ticket) {
    alert("Ticket non trovato.");
    return;
  }
  if (ticket.status === "closed") {
    alert("Il ticket è chiuso, non puoi aggiungere messaggi.");
    return;
  }

  const text = (chatMessageInput.value || "").trim();
  const files = chatFileInput.files;

  if (!text && (!files || files.length === 0)) {
    alert("Scrivi un messaggio o allega un file.");
    return;
  }

  if (!currentUser || !currentUserData) {
    alert("Utente non valido.");
    return;
  }

  btnSendMessage.disabled = true;

  try {
    const attachments = []; // upload file lo aggiungeremo in seguito

    const displayName =
      currentUserData.displayName || currentUser.email || "(utente)";

    const msgData = {
      authorUid: currentUser.uid,
      authorName: displayName,
      authorDealerId: currentDealerId,
      authorIsDistributor: isDistributor,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      attachments: attachments,
    };

    await db
      .collection("HotlineTickets")
      .doc(selectedTicketId)
      .collection("messages")
      .add(msgData);

    let newStatus = ticket.status;
    if (ticket.status !== "closed") {
      newStatus = isDistributor
        ? "open_waiting_dealer"
        : "open_waiting_distributor";
    }

    await db.collection("HotlineTickets").doc(selectedTicketId).update({
      status: newStatus,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
    });

    chatMessageInput.value = "";
    chatFileInput.value = "";
  } catch (err) {
    console.error("Errore invio messaggio hotline:", err);
    alert("Errore durante l'invio del messaggio.");
  } finally {
    btnSendMessage.disabled = false;
  }
}

// ================== CHIUDI TICKET ==================
async function onCloseTicketClick() {
  if (!selectedTicketId) {
    alert("Seleziona prima un ticket.");
    return;
  }

  const ticket = hotlineTickets.find((t) => t.id === selectedTicketId);
  if (!ticket) {
    alert("Ticket non trovato.");
    return;
  }
  if (ticket.status === "closed") return;

  const conferma = confirm(
    "Vuoi davvero chiudere questo ticket? Non sarà più modificabile."
  );
  if (!conferma) return;

  btnCloseTicket.disabled = true;

  try {
    await db.collection("HotlineTickets").doc(selectedTicketId).update({
      status: "closed",
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("Errore chiusura ticket:", err);
    alert("Errore durante la chiusura del ticket.");
    btnCloseTicket.disabled = false;
  }
}

// ================== NUOVO TICKET ==================
function onNewTicketClick() {
  if (!currentDealerId) {
    alert("Profilo utente non valido (manca dealerId).");
    return;
  }

  newTicketSubjectInput.value = "";
  newTicketDepartmentSelect.value = "";
  newTicketVinInput.value = "";
  newTicketPlateInput.value = "";
  newTicketKmInput.value = "";
  newTicketEngineHoursInput.value = "";
  newTicketWarrantyInput.value = "";
  newTicketBodyInput.value = "";
  newTicketErrorEl.textContent = "";

  newTicketModal.style.display = "flex";
}

function closeNewTicketModal() {
  newTicketModal.style.display = "none";
}

function generateTicketCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function submitNewTicket() {
  if (!currentUser || !currentUserData || !currentDealerId) {
    newTicketErrorEl.textContent = "Profilo utente non valido.";
    return;
  }

  const subject = (newTicketSubjectInput.value || "").trim();
  const departmentCode = newTicketDepartmentSelect.value;
  const vin = (newTicketVinInput.value || "").trim();
  const plate = (newTicketPlateInput.value || "").trim();
  const kmStr = (newTicketKmInput.value || "").trim();
  const engineHoursStr = (newTicketEngineHoursInput.value || "").trim();
  const warranty = (newTicketWarrantyInput.value || "").trim();
  const body = (newTicketBodyInput.value || "").trim();

  if (!subject) {
    newTicketErrorEl.textContent = "L'oggetto è obbligatorio.";
    return;
  }
  if (!departmentCode) {
    newTicketErrorEl.textContent = "Il reparto è obbligatorio.";
    return;
  }
  if (!body) {
    newTicketErrorEl.textContent = "La descrizione è obbligatoria.";
    return;
  }

  const dep = hotlineDepartments.find((d) => d.code === departmentCode);
  if (!dep) {
    newTicketErrorEl.textContent = "Reparto non valido.";
    return;
  }

  const km = kmStr ? Number(kmStr) : null;
  const engineHours = engineHoursStr ? Number(engineHoursStr) : null;
  const displayName =
    currentUserData.displayName || currentUser.email || "(utente)";

  const ticketData = {
    ticketCode: generateTicketCode(),

    dealerId: currentDealerId,
    creatorUid: currentUser.uid,
    creatorName: displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),

    subject: subject,
    body: body,

    vin: vin || "",
    plate: plate || "",
    km: km,
    engineHours: engineHours,
    warrantyRequest: warranty || "",

    departmentId: dep.code,
    departmentName: dep.name,
    departmentRoles: dep.allowedRoles || [],

    status: "open_waiting_distributor",
    lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
  };

  newTicketSubmitBtn.disabled = true;
  newTicketErrorEl.textContent = "";

  try {
    await db.collection("HotlineTickets").add(ticketData);
    closeNewTicketModal();
  } catch (err) {
    console.error("Errore creazione ticket hotline:", err);
    newTicketErrorEl.textContent =
      "Errore nella creazione del ticket: " + (err.message || "");
  } finally {
    newTicketSubmitBtn.disabled = false;
  }
}

// ================== HELPER STATO & DATE ==================
function getStatusLabelForUser(status) {
  if (status === "closed") return "Chiuso";

  if (isDistributor) {
    if (status === "open_waiting_distributor") return "In attesa";
    if (status === "open_waiting_dealer") return "Gestita";
  } else {
    if (status === "open_waiting_distributor") return "Inviata";
    if (status === "open_waiting_dealer") return "In attesa";
  }
  return status || "";
}

function getStatusLabelAndClass(status) {
  let label = getStatusLabelForUser(status);
  let cssClass = "";

  if (status === "closed") cssClass = "ticket-status-closed";
  else if (status === "open_waiting_distributor") cssClass = "ticket-status-open";
  else if (status === "open_waiting_dealer") cssClass = "ticket-status-waiting";

  return { label, cssClass };
}

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function formatDateTime(date) {
  if (!date) return "";
  const d = pad2(date.getDate());
  const m = pad2(date.getMonth() + 1);
  const y = date.getFullYear();
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

function formatDateTimeShort(date) {
  if (!date) return "";
  const d = pad2(date.getDate());
  const m = pad2(date.getMonth() + 1);
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${d}/${m} ${hh}:${mm}`;
}
