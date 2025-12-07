// ===============================
// ftclaims-claimforms.js
// Form specifici per tipologia claim (RSA, Garanzia, ...)
// ===============================

const CLAIM_TYPE_SPECIFIC_CONTAINER_ID = "claimTypeSpecificContainer";

function normalizeClaimType(ct) {
  return (ct || "").toString().trim().toUpperCase();
}

function getClaimTypeSpecificContainer() {
  return document.getElementById(CLAIM_TYPE_SPECIFIC_CONTAINER_ID);
}

/**
 * Genera il form specifico per la tipologia scelta.
 * La combo NON crea nulla nel DB, decide solo quale form mostrare.
 */
function renderClaimTypeSpecificForm(claimType) {
  const container = getClaimTypeSpecificContainer();
  if (!container) return;

  container.innerHTML = "";

  const type = normalizeClaimType(claimType);

  if (type === "RSA") {
    renderRSAForm(container);
  } else if (type) {
    // Altre tipologie: per ora solo messaggio
    const info = document.createElement("div");
    info.className = "small-text";
    info.textContent =
      "Per questa tipologia non sono ancora previsti campi aggiuntivi.";
    container.appendChild(info);
  }
}

/* ===============================
   RSA - Helpers
=============================== */

function isWeekendOrItalianHoliday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;

  const day = d.getDay(); // 0 domenica, 6 sabato
  if (day === 0 || day === 6) return true;

  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const dayOfMonth = d.getDate().toString().padStart(2, "0");
  const md = month + "-" + dayOfMonth;

  const holidays = [
    "01-01", // Capodanno
    "01-06", // Epifania
    "04-25", // Liberazione
    "05-01", // Festa del lavoro
    "06-02", // Festa della Repubblica
    "08-15", // Ferragosto
    "11-01", // Ognissanti
    "12-08", // Immacolata
    "12-25", // Natale
    "12-26"  // Santo Stefano
  ];

  return holidays.includes(md);
}

function updateRSAFieldsState() {
  const container = getClaimTypeSpecificContainer();
  if (!container) return;

  const onlyTow = !!(container.querySelector("#rsaOnlyTow")?.checked);
  const rsaDate = container.querySelector("#rsaDate")?.value || "";
  const isSpecialDay = isWeekendOrItalianHoliday(rsaDate);

  const dayIds = ["rsaDayHours", "rsaDayMinutes"];
  const nightIds = ["rsaNightHours", "rsaNightMinutes"];
  const kmIds = ["rsaKm"];

  if (onlyTow) {
    [...dayIds, ...nightIds, ...kmIds].forEach(id => {
      const el = container.querySelector("#" + id);
      if (el) {
        el.disabled = true;
        el.value = "";
      }
    });
    return;
  }

  // Non solo traino: abilito/disabilito in base a weekend/festivo
  dayIds.forEach(id => {
    const el = container.querySelector("#" + id);
    if (el) {
      el.disabled = isSpecialDay;
      if (isSpecialDay) el.value = "";
    }
  });

  nightIds.forEach(id => {
    const el = container.querySelector("#" + id);
    if (el) el.disabled = false;
  });

  kmIds.forEach(id => {
    const el = container.querySelector("#" + id);
    if (el) el.disabled = false;
  });
}

/**
 * Disegna il form RSA dentro il container.
 * Usato solo per la CREAZIONE di un nuovo claim RSA.
 */
function renderRSAForm(container) {
  const html = `
    <hr>
    <h4 style="margin: 5px 0 8px; font-size: 13px;">Dati RSA</h4>

    <div class="form-group">
      <label for="rsaDate">Data RSA (inizio intervento)</label>
      <input type="date" id="rsaDate">
      <div class="small-text">
        Se cade di sabato, domenica o festività nazionale, il DAYSHIFT non è compilabile.
      </div>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="rsaOnlyTow">
        Solo Traino
      </label>
      <div class="small-text">
        Se selezionato, si compilano solo "Caso RSA n." e "Traino, costi correlati".
      </div>
    </div>

    <!-- DAYSHIFT -->
    <div class="shift-box">
      <span class="shift-label">DAYSHIFT</span>
      <input type="number" id="rsaDayHours" class="time-input" min="0" max="99" step="1">
      <span class="time-separator">:</span>
      <input type="number" id="rsaDayMinutes" class="time-input" min="0" max="59" step="1">
    </div>

    <!-- NIGHTSHIFT -->
    <div class="shift-box">
      <span class="shift-label">NIGHTSHIFT</span>
      <input type="number" id="rsaNightHours" class="time-input" min="0" max="99" step="1">
      <span class="time-separator">:</span>
      <input type="number" id="rsaNightMinutes" class="time-input" min="0" max="59" step="1">
    </div>

    <div class="form-group">
      <label>PERCORRENZA - Km</label>
      <input type="number" id="rsaKm" min="0" step="1">
    </div>

    <div class="form-group">
      <label for="rsaCaseNumber">Caso RSA n.</label>
      <input type="text" id="rsaCaseNumber" maxlength="7">
    </div>

    <div class="form-group">
      <label for="rsaTowCosts">Traino, costi correlati (€)</label>
      <input type="number" id="rsaTowCosts" min="0" step="0.01" class="currency-input">
    </div>

    <!-- Allegati -->
    <div class="form-group">
      <label for="rsaInvoices">Fatture (uno o più file)</label>
      <input type="file" id="rsaInvoices" multiple>
    </div>

    <div class="form-group">
      <label for="rsaRouteFiles">Tragitto (uno o più file)</label>
      <input type="file" id="rsaRouteFiles" multiple>
    </div>
  `;

  container.innerHTML = html;

  const dateInput = container.querySelector("#rsaDate");
  const onlyTowCheckbox = container.querySelector("#rsaOnlyTow");

  if (dateInput) {
    dateInput.addEventListener("change", updateRSAFieldsState);
  }
  if (onlyTowCheckbox) {
    onlyTowCheckbox.addEventListener("change", updateRSAFieldsState);
  }

  // Stato iniziale
  updateRSAFieldsState();
}

/* ===============================
   Raccolta dati per salvataggio
=============================== */

function collectClaimExtraDataForSave(claimType) {
  const type = normalizeClaimType(claimType);
  const container = getClaimTypeSpecificContainer();
  if (!container) return {};

  if (type === "RSA") {
    const onlyTow = !!(container.querySelector("#rsaOnlyTow")?.checked);
    const rsaDate = container.querySelector("#rsaDate")?.value || null;

    function readInt(sel) {
      const el = container.querySelector(sel);
      if (!el) return null;
      const v = el.value.trim();
      if (v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }

    function readCurrency(sel) {
      const el = container.querySelector(sel);
      if (!el) return null;
      let v = el.value.trim().replace(",", ".");
      if (v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }

    const rsaData = {
      date: rsaDate,
      onlyTow: onlyTow,
      dayShiftHours:  onlyTow ? null : readInt("#rsaDayHours"),
      dayShiftMinutes:onlyTow ? null : readInt("#rsaDayMinutes"),
      nightShiftHours:onlyTow ? null : readInt("#rsaNightHours"),
      nightShiftMinutes:onlyTow ? null : readInt("#rsaNightMinutes"),
      km:             onlyTow ? null : readInt("#rsaKm"),
      caseNumber: (container.querySelector("#rsaCaseNumber")?.value.trim() || null),
      towCostsAmount: readCurrency("#rsaTowCosts")
    };

    return { rsa: rsaData };
  }

  return {};
}

/* ===============================
   Gestione allegati dopo creazione claim
=============================== */

async function handleClaimAttachmentsAfterCreate(claimType, claimCardId, claimCode) {
  const type = normalizeClaimType(claimType);
  if (type !== "RSA") return;

  if (typeof firebase === "undefined" || !firebase.storage || !firebase.firestore) {
    console.warn("Firebase Storage/Firestore non disponibili in handleClaimAttachmentsAfterCreate.");
    return;
  }

  const container = getClaimTypeSpecificContainer();
  if (!container) return;

  const invoicesInput = container.querySelector("#rsaInvoices");
  const routeInput    = container.querySelector("#rsaRouteFiles");

  const invoiceFiles = invoicesInput?.files || [];
  const routeFiles   = routeInput?.files || [];

  if (invoiceFiles.length === 0 && routeFiles.length === 0) return;

  const storage = firebase.storage();
  const db = firebase.firestore();

  const basePath = "ClaimCards/" + claimCardId + "/Claims/" + claimCode + "/";

  const invoiceMeta = [];
  for (let i = 0; i < invoiceFiles.length; i++) {
    const f = invoiceFiles[i];
    const path = basePath + "Fatture/" + Date.now() + "_" + f.name;
    const ref = storage.ref(path);
    await ref.put(f);
    const url = await ref.getDownloadURL();
    invoiceMeta.push({ name: f.name, path, url });
  }

  const routeMeta = [];
  for (let i = 0; i < routeFiles.length; i++) {
    const f = routeFiles[i];
    const path = basePath + "Tragitto/" + Date.now() + "_" + f.name;
    const ref = storage.ref(path);
    await ref.put(f);
    const url = await ref.getDownloadURL();
    routeMeta.push({ name: f.name, path, url });
  }

  const claimRef = db
    .collection("ClaimCards")
    .doc(claimCardId)
    .collection("Claims")
    .doc(claimCode);

  await claimRef.update({
    "rsa.invoiceFiles": invoiceMeta.length ? invoiceMeta : firebase.firestore.FieldValue.delete(),
    "rsa.routeFiles":   routeMeta.length ? routeMeta   : firebase.firestore.FieldValue.delete()
  });

  if (invoicesInput) invoicesInput.value = "";
  if (routeInput)    routeInput.value = "";
}
