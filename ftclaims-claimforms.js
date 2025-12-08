// ===============================
// ftclaims-claimforms.js
// Dettagli dei singoli claim (RSA, Garanzia, Garanzia Ricambio, ...)
// ===============================

function normalizeClaimType(ct) {
  return (ct || "").toString().trim().toUpperCase();
}

/* ===============================
   Helpers comuni
=============================== */

function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function formatMoney(v) {
  const n = toNumberOrNull(v) || 0;
  return n.toFixed(2);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let cachedUserInfo = null;
async function getCurrentUserInfo() {
  if (cachedUserInfo) return cachedUserInfo;

  if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
    throw new Error("Firebase non disponibile.");
  }

  const auth = firebase.auth();
  const db   = firebase.firestore();
  const user = auth.currentUser;

  if (!user) throw new Error("Utente non autenticato.");

  let name = user.displayName || user.email || "Utente";
  let dealerId = null;

  try {
    const doc = await db.collection("Users").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data() || {};
      name = data.name || data.displayName || name;
      dealerId =
        data.dealerId ||
        data.dealerID ||
        data.DealerID ||
        data.DealerId ||
        null;
    }
  } catch (err) {
    console.warn("Impossibile leggere Users/<uid>:", err);
  }

  cachedUserInfo = {
    uid: user.uid,
    name,
    dealerId
  };
  return cachedUserInfo;
}

/* ===============================
   SEZIONE ALLEGATI GENERICI CLAIM
   Storage: ClaimCards/<cardId>/Claims/<code>/Attachments
=============================== */

function renderClaimAttachmentsSection(container, ctx) {
  const attPrefix = "att_" + ctx.claimCode + "_";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <hr>
    <h4 style="margin: 6px 0; font-size: 13px;">Allegati claim</h4>

    <div class="form-group" style="display:flex; gap:6px; align-items:center;">
      <input type="file" id="${attPrefix}fileInput" multiple style="flex:1;">
      <button type="button" id="${attPrefix}uploadBtn" class="btn btn-small btn-secondary">
        Carica allegati
      </button>
    </div>

    <div id="${attPrefix}list"
         class="small-text"
         style="margin-top:4px; max-height:200px; overflow-y:auto; border:1px solid #ddd; padding:4px; background:#fff;">
    </div>
  `;
  container.appendChild(wrapper);

  if (typeof firebase === "undefined" || !firebase.storage) {
    const listDiv = wrapper.querySelector("#" + attPrefix + "list");
    listDiv.textContent = "Firebase Storage non disponibile.";
    return;
  }

  const storage   = firebase.storage();
  const fileInput = wrapper.querySelector("#" + attPrefix + "fileInput");
  const uploadBtn = wrapper.querySelector("#" + attPrefix + "uploadBtn");
  const listDiv   = wrapper.querySelector("#" + attPrefix + "list");

  const basePath =
    "ClaimCards/" + ctx.claimCardId + "/Claims/" + ctx.claimCode + "/Attachments";

  async function loadAttachments() {
    listDiv.textContent = "Caricamento allegati...";
    try {
      const ref = storage.ref(basePath + "/");
      const res = await ref.listAll();

      if (!res.items.length) {
        listDiv.textContent = "Nessun allegato caricato.";
        return;
      }

      listDiv.innerHTML = "";
      for (const itemRef of res.items) {
        const url = await itemRef.getDownloadURL();
        const name = itemRef.name;

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "space-between";
        row.style.gap = "6px";
        row.style.marginBottom = "3px";

        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.textContent = name;

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "Elimina";
        delBtn.className = "btn btn-small btn-danger";

        delBtn.addEventListener("click", async () => {
          if (!confirm('Vuoi eliminare il file "' + name + '"?')) return;
          try {
            await itemRef.delete();
            await loadAttachments();
          } catch (err) {
            console.error(err);
            alert("Errore nell'eliminazione allegato: " + err.message);
          }
        });

        row.appendChild(link);
        row.appendChild(delBtn);
        listDiv.appendChild(row);
      }
    } catch (err) {
      console.error(err);
      listDiv.textContent = "Errore nel caricamento allegati: " + err.message;
    }
  }

  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      const files = fileInput.files;
      if (!files || !files.length) {
        alert("Seleziona uno o più file da caricare.");
        return;
      }

      uploadBtn.disabled = true;
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const path = basePath + "/" + Date.now() + "_" + f.name;
          const ref  = storage.ref(path);
          await ref.put(f);
        }
        fileInput.value = "";
        await loadAttachments();
      } catch (err) {
        console.error(err);
        alert("Errore nel caricamento allegati: " + err.message);
      } finally {
        uploadBtn.disabled = false;
      }
    });
  }

  loadAttachments();
}

/* ===============================
   SEZIONE NOTE (stile chat)
   Firestore: ClaimCards/<cardId>/Claims/<code>/Notes
=============================== */

function renderClaimNotesSection(container, ctx) {
  const notePrefix = "note_" + ctx.claimCode + "_";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <hr>
    <h4 style="margin: 6px 0; font-size: 13px;">Note claim</h4>

    <div id="${notePrefix}list"
         style="max-height:220px; overflow-y:auto; border:1px solid #ddd; padding:6px; background:#fff; margin-bottom:6px;">
    </div>

    <div class="form-group" style="display:flex; gap:6px; align-items:center;">
      <input type="text"
             id="${notePrefix}input"
             placeholder="Scrivi una nota..."
             style="flex:1; padding:4px 6px; font-size:12px;">
      <button type="button" id="${notePrefix}sendBtn" class="btn btn-small btn-primary">
        Invia
      </button>
    </div>
  `;
  container.appendChild(wrapper);

  if (typeof firebase === "undefined" || !firebase.firestore || !firebase.auth) {
    const listDiv = wrapper.querySelector("#" + notePrefix + "list");
    listDiv.textContent = "Firebase non disponibile per le note.";
    return;
  }

  const db       = firebase.firestore();
  const listDiv  = wrapper.querySelector("#" + notePrefix + "list");
  const inputEl  = wrapper.querySelector("#" + notePrefix + "input");
  const sendBtn  = wrapper.querySelector("#" + notePrefix + "sendBtn");

  const notesColl = db
    .collection("ClaimCards")
    .doc(ctx.claimCardId)
    .collection("Claims")
    .doc(ctx.claimCode)
    .collection("Notes");

  async function loadNotes() {
    listDiv.textContent = "Caricamento note...";
    try {
      const snap = await notesColl.orderBy("createdAt", "asc").get();
      if (snap.empty) {
        listDiv.textContent = "Nessuna nota presente.";
        return;
      }

      listDiv.innerHTML = "";
      snap.forEach(doc => {
        const d = doc.data() || {};
        const text  = d.text || "";
        const name  = d.authorName || "Utente";
        const dealer= d.authorDealerId || "";
        let when    = "";

        if (d.createdAt && typeof d.createdAt.toDate === "function") {
          try {
            when = d.createdAt.toDate().toLocaleString("it-IT");
          } catch (e) {
            when = "";
          }
        }

        const row = document.createElement("div");
        row.style.marginBottom = "6px";

        const header = document.createElement("div");
        header.style.fontSize = "11px";
        header.style.color = "#666";
        header.innerHTML =
          "<strong>" + escapeHtml(name) + "</strong>" +
          (dealer ? " [" + escapeHtml(dealer) + "]" : "") +
          (when ? " - " + escapeHtml(when) : "");

        const body = document.createElement("div");
        body.style.fontSize = "13px";
        body.style.background = "#f4f4f4";
        body.style.borderRadius = "4px";
        body.style.padding = "4px 6px";
        body.innerHTML = escapeHtml(text);

        row.appendChild(header);
        row.appendChild(body);
        listDiv.appendChild(row);
      });

      listDiv.scrollTop = listDiv.scrollHeight;
    } catch (err) {
      console.error(err);
      listDiv.textContent = "Errore nel caricamento delle note: " + err.message;
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      const txt = (inputEl.value || "").trim();
      if (!txt) return;

      sendBtn.disabled = true;
      try {
        const userInfo = await getCurrentUserInfo();

        await notesColl.add({
          text: txt,
          authorUid: userInfo.uid,
          authorName: userInfo.name,
          authorDealerId: userInfo.dealerId || null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        inputEl.value = "";
        await loadNotes();
      } catch (err) {
        console.error(err);
        alert("Errore nell'invio della nota: " + err.message);
      } finally {
        sendBtn.disabled = false;
      }
    });

    // invio anche con Enter
    inputEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        sendBtn.click();
      }
    });
  }

  loadNotes();
}

/* ===============================
   Entry point principali
=============================== */

/**
 * Entry point:
 *   - claimType: "RSA", "Garanzia", "Garanzia Ricambio", ...
 *   - container: div interno alla card della singola riparazione
 *   - claimData: dati Firestore del claim
 *   - ctx: { claimCardId, claimCode }
 */
function renderClaimDetails(claimType, container, claimData, ctx) {
  const type = normalizeClaimType(claimType);

  container.innerHTML = "";

  if (type === "RSA") {
    renderRSADetails(container, claimData, ctx);
  } else if (type === "GARANZIA") {
    renderGaranziaDetails(container, claimData, ctx, {
      includePrevInvoiceDate: false
    });
  } else if (type === "GARANZIA RICAMBIO") {
    renderGaranziaDetails(container, claimData, ctx, {
      includePrevInvoiceDate: true
    });
  } else if (type) {
    const info = document.createElement("div");
    info.className = "small-text";
    info.textContent =
      'Per la tipologia "' + type + '" non sono ancora previsti campi aggiuntivi.';
    container.appendChild(info);

    // anche per tipologie generiche mostro allegati + note
    renderClaimAttachmentsSection(container, ctx);
    renderClaimNotesSection(container, ctx);
  } else {
    const info = document.createElement("div");
    info.className = "small-text";
    info.textContent = "Tipologia claim non specificata.";
    container.appendChild(info);

    renderClaimAttachmentsSection(container, ctx);
    renderClaimNotesSection(container, ctx);
  }
}

/* ===============================
   RSA
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

function renderRSADetails(container, claimData, ctx) {
  const rsa = claimData.rsa || {};
  const prefix = "rsa_" + ctx.claimCode + "_";

  const html = `
    <h4 style="margin: 4px 0 6px; font-size: 13px;">Dati RSA</h4>

    <div class="form-group">
      <label for="${prefix}date">Data RSA (inizio intervento)</label>
      <input type="date" id="${prefix}date">
      <div class="small-text">
        Se cade di sabato, domenica o festività nazionale, il DAYSHIFT non è compilabile.
      </div>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="${prefix}onlyTow">
        Solo Traino
      </label>
      <div class="small-text">
        Se selezionato, si compilano solo "Caso RSA n." e "Traino, costi correlati".
      </div>
    </div>

    <div class="form-group">
      <div class="shift-box">
        <span class="shift-label">DAYSHIFT</span>
        <input type="number" id="${prefix}dayHours" class="time-input" min="0" max="99" step="1">
        <span class="time-separator">:</span>
        <input type="number" id="${prefix}dayMinutes" class="time-input" min="0" max="59" step="1">
      </div>

      <div class="shift-box">
        <span class="shift-label">NIGHTSHIFT</span>
        <input type="number" id="${prefix}nightHours" class="time-input" min="0" max="99" step="1">
        <span class="time-separator">:</span>
        <input type="number" id="${prefix}nightMinutes" class="time-input" min="0" max="59" step="1">
      </div>
    </div>

    <div class="form-group">
      <label for="${prefix}km">PERCORRENZA - Km</label>
      <input type="number" id="${prefix}km" min="0" step="1">
    </div>

    <div class="form-group">
      <label for="${prefix}case">Caso RSA n.</label>
      <input type="text" id="${prefix}case" maxlength="7">
    </div>

    <div class="form-group">
      <label for="${prefix}towCosts">Traino, costi correlati (€)</label>
      <input type="number" id="${prefix}towCosts" min="0" step="0.01" class="currency-input">
    </div>

    <div class="form-group">
      <label for="${prefix}invoices">Fatture (uno o più file)</label>
      <input type="file" id="${prefix}invoices" multiple>
      <div id="${prefix}invoicesList" class="small-text" style="margin-top:4px;"></div>
    </div>

    <div class="form-group">
      <label for="${prefix}route">Tragitto (uno o più file)</label>
      <input type="file" id="${prefix}route" multiple>
      <div id="${prefix}routeList" class="small-text" style="margin-top:4px;"></div>
    </div>

    <div class="form-group">
      <button type="button" id="${prefix}saveBtn" class="btn btn-primary btn-small">
        Salva dati RSA
      </button>
    </div>
  `;

  container.innerHTML = html;

  const dateInput        = container.querySelector("#" + prefix + "date");
  const onlyTowInput     = container.querySelector("#" + prefix + "onlyTow");
  const dayHoursInput    = container.querySelector("#" + prefix + "dayHours");
  const dayMinInput      = container.querySelector("#" + prefix + "dayMinutes");
  const nightHoursInput  = container.querySelector("#" + prefix + "nightHours");
  const nightMinInput    = container.querySelector("#" + prefix + "nightMinutes");
  const kmInput          = container.querySelector("#" + prefix + "km");
  const caseInput        = container.querySelector("#" + prefix + "case");
  const towCostsInput    = container.querySelector("#" + prefix + "towCosts");
  const invoicesInput    = container.querySelector("#" + prefix + "invoices");
  const routeInput       = container.querySelector("#" + prefix + "route");
  const invoicesListDiv  = container.querySelector("#" + prefix + "invoicesList");
  const routeListDiv     = container.querySelector("#" + prefix + "routeList");
  const saveBtn          = container.querySelector("#" + prefix + "saveBtn");

  // Pre-compilazione
  if (rsa.date) dateInput.value = rsa.date;
  if (rsa.onlyTow) onlyTowInput.checked = !!rsa.onlyTow;
  if (rsa.dayShiftHours != null)   dayHoursInput.value = rsa.dayShiftHours;
  if (rsa.dayShiftMinutes != null) dayMinInput.value   = rsa.dayShiftMinutes;
  if (rsa.nightShiftHours != null) nightHoursInput.value = rsa.nightShiftHours;
  if (rsa.nightShiftMinutes != null) nightMinInput.value = rsa.nightShiftMinutes;
  if (rsa.km != null) kmInput.value = rsa.km;
  if (rsa.caseNumber) caseInput.value = rsa.caseNumber;
  if (rsa.towCostsAmount != null) towCostsInput.value = rsa.towCostsAmount;

  let invoiceMeta = Array.isArray(rsa.invoiceFiles) ? rsa.invoiceFiles.slice() : [];
  let routeMeta   = Array.isArray(rsa.routeFiles)   ? rsa.routeFiles.slice()   : [];

  function updateFieldsState() {
    const onlyTow  = onlyTowInput.checked;
    const dateStr  = dateInput.value || "";
    const isSpecial= isWeekendOrItalianHoliday(dateStr);

    const dayInputs = [dayHoursInput, dayMinInput];
    const nightInputs = [nightHoursInput, nightMinInput];
    const kmInputs = [kmInput];

    if (onlyTow) {
      [...dayInputs, ...nightInputs, ...kmInputs].forEach(el => {
        if (!el) return;
        el.disabled = true;
        el.value = "";
      });
      return;
    }

    dayInputs.forEach(el => {
      if (!el) return;
      el.disabled = isSpecial;
      if (isSpecial) el.value = "";
    });

    nightInputs.forEach(el => {
      if (!el) return;
      el.disabled = false;
    });

    kmInputs.forEach(el => {
      if (!el) return;
      el.disabled = false;
    });
  }

  if (dateInput)    dateInput.addEventListener("change", updateFieldsState);
  if (onlyTowInput) onlyTowInput.addEventListener("change", updateFieldsState);
  updateFieldsState();

  function readInt(input) {
    if (!input) return null;
    const v = input.value.trim();
    if (v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  function readCurrency(input) {
    if (!input) return null;
    let v = input.value.trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  // --- Liste file RSA (fatture/tragitto) con tasto elimina ---

  function renderFileList(metaArray, listDiv, kind) {
    if (!listDiv) return;
    if (!metaArray || !metaArray.length) {
      listDiv.textContent = "Nessun file caricato.";
      return;
    }

    listDiv.innerHTML = "";
    metaArray.forEach((file, index) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "6px";
      row.style.marginTop = "2px";

      const link = document.createElement("a");
      link.href = file.url || "#";
      link.target = "_blank";
      link.textContent = file.name || "File";

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Elimina";
      delBtn.className = "btn btn-small btn-danger";

      delBtn.addEventListener("click", async () => {
        if (!confirm('Vuoi eliminare il file "' + (file.name || "") + '"?')) {
          return;
        }

        if (typeof firebase === "undefined" || !firebase.storage || !firebase.firestore) {
          alert("Firebase non disponibile.");
          return;
        }

        const storage = firebase.storage();
        const db      = firebase.firestore();

        try {
          if (file.path) {
            await storage.ref(file.path).delete();
          }

          const claimRef = db
            .collection("ClaimCards")
            .doc(ctx.claimCardId)
            .collection("Claims")
            .doc(ctx.claimCode);

          const newMeta = metaArray.slice();
          newMeta.splice(index, 1);

          const fieldName = kind === "invoice"
            ? "rsa.invoiceFiles"
            : "rsa.routeFiles";

          await claimRef.update({ [fieldName]: newMeta });

          metaArray.splice(index, 1);
          renderFileList(metaArray, listDiv, kind);
        } catch (err) {
          console.error(err);
          alert("Errore durante l'eliminazione del file: " + err.message);
        }
      });

      row.appendChild(link);
      row.appendChild(delBtn);
      listDiv.appendChild(row);
    });
  }

  renderFileList(invoiceMeta, invoicesListDiv, "invoice");
  renderFileList(routeMeta, routeListDiv, "route");

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (typeof firebase === "undefined" ||
          !firebase.firestore || !firebase.storage) {
        alert("Firebase non disponibile.");
        return;
      }

      const db = firebase.firestore();
      const storage = firebase.storage();

      const onlyTow = onlyTowInput.checked;
      const rsaDate = dateInput.value || null;

      const rsaData = {
        date: rsaDate,
        onlyTow: onlyTow,
        dayShiftHours:   onlyTow ? null : readInt(dayHoursInput),
        dayShiftMinutes: onlyTow ? null : readInt(dayMinInput),
        nightShiftHours: onlyTow ? null : readInt(nightHoursInput),
        nightShiftMinutes: onlyTow ? null : readInt(nightMinInput),
        km:              onlyTow ? null : readInt(kmInput),
        caseNumber: (caseInput.value.trim() || null),
        towCostsAmount: readCurrency(towCostsInput)
      };

      const basePath =
        "ClaimCards/" + ctx.claimCardId + "/Claims/" + ctx.claimCode + "/";

      let invoiceMetaCurrent = invoiceMeta.slice();
      let routeMetaCurrent   = routeMeta.slice();

      const invFiles = invoicesInput.files || [];
      for (let i = 0; i < invFiles.length; i++) {
        const f = invFiles[i];
        const path = basePath + "Fatture/" + Date.now() + "_" + f.name;
        const ref  = storage.ref(path);
        await ref.put(f);
        const url = await ref.getDownloadURL();
        invoiceMetaCurrent.push({ name: f.name, path, url });
      }

      const routeFiles = routeInput.files || [];
      for (let i = 0; i < routeFiles.length; i++) {
        const f = routeFiles[i];
        const path = basePath + "Tragitto/" + Date.now() + "_" + f.name;
        const ref  = storage.ref(path);
        await ref.put(f);
        const url = await ref.getDownloadURL();
        routeMetaCurrent.push({ name: f.name, path, url });
      }

      if (invoiceMetaCurrent.length) rsaData.invoiceFiles = invoiceMetaCurrent;
      if (routeMetaCurrent.length)   rsaData.routeFiles   = routeMetaCurrent;

      try {
        const claimRef = db
          .collection("ClaimCards")
          .doc(ctx.claimCardId)
          .collection("Claims")
          .doc(ctx.claimCode);

        await claimRef.update({ rsa: rsaData });

        invoiceMeta = invoiceMetaCurrent;
        routeMeta   = routeMetaCurrent;
        renderFileList(invoiceMeta, invoicesListDiv, "invoice");
        renderFileList(routeMeta, routeListDiv, "route");

        invoicesInput.value = "";
        routeInput.value = "";

        alert("Dati RSA salvati.");
      } catch (err) {
        console.error(err);
        alert("Errore nel salvataggio dati RSA: " + err.message);
      }
    });
  }

  // Sezione allegati generici + note
  renderClaimAttachmentsSection(container, ctx);
  renderClaimNotesSection(container, ctx);
}

/* ===============================
   GARANZIA / GARANZIA RICAMBIO
=============================== */

function renderGaranziaDetails(container, claimData, ctx, options) {
  const gar = claimData.garanzia || {};
  const prefix = "gar_" + ctx.claimCode + "_";
  const includePrevInvoiceDate =
    options && options.includePrevInvoiceDate ? true : false;

  const html = `
    <h4 style="margin: 4px 0 6px; font-size: 13px;">Dati Garanzia</h4>

    <!-- SYMPTOM + CCC -->
    <div class="form-group">
      <label for="${prefix}symptom">Symptom</label>
      <select id="${prefix}symptom"></select>
    </div>

    <div class="form-group">
      <label for="${prefix}ccc">CCC Codes</label>
      <select id="${prefix}ccc"></select>
    </div>

    <!-- Componente causa -->
    <div class="form-group">
      <label for="${prefix}causaCode">Componente causa (codice ricambio)</label>
      <div style="display:flex; gap:4px;">
        <input type="text" id="${prefix}causaCode" style="flex:0 0 150px;">
        <button type="button" id="${prefix}causaSearch" class="btn btn-small btn-secondary">Cerca</button>
      </div>
      <div class="small-text">
        La ricerca avviene nel DB FTPartsCodes sul campo "codice".
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="${prefix}causaExt">Codice esteso componente</label>
        <input type="text" id="${prefix}causaExt" readonly>
      </div>
      <div class="form-group">
        <label for="${prefix}causaDesc">Descrizione componente</label>
        <input type="text" id="${prefix}causaDesc" readonly>
      </div>
    </div>

    <!-- Commento tecnico -->
    <div class="form-group">
      <label for="${prefix}commento">Commento tecnico</label>
      <textarea id="${prefix}commento" rows="3"></textarea>
    </div>

    ${
      includePrevInvoiceDate
        ? `
    <div class="form-group">
      <label for="${prefix}prevInvoiceDate">Data Fattura Precedente Lavorazione</label>
      <input type="date" id="${prefix}prevInvoiceDate">
    </div>
        `
        : ""
    }

    <hr>

    <!-- RICAMBI -->
    <h4 style="margin: 4px 0 6px; font-size: 13px;">Ricambi</h4>
    <div class="small-text">Ricambi selezionati dal DB FTPartsCodes.</div>

    <div class="form-group">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border-bottom:1px solid #ddd; text-align:left;">Codice</th>
            <th style="border-bottom:1px solid #ddd; text-align:left;">Codice esteso</th>
            <th style="border-bottom:1px solid #ddd; text-align:left;">Descrizione</th>
            <th style="border-bottom:1px solid #ddd; text-align:right;">Rimborso garanzia (€/unità)</th>
            <th style="border-bottom:1px solid #ddd; text-align:right;">Quantità</th>
            <th style="border-bottom:1px solid #ddd; text-align:right;">Totale</th>
            <th style="border-bottom:1px solid #ddd; text-align:center;">Azioni</th>
          </tr>
        </thead>
        <tbody id="${prefix}partsBody"></tbody>
      </table>
    </div>

    <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
      <button type="button" id="${prefix}addPart" class="btn btn-small btn-secondary">Aggiungi ricambio</button>
      <div><strong>Totale ricambi: </strong><span id="${prefix}partsTotal">0.00</span> €</div>
    </div>

    <hr>

    <!-- MANODOPERA -->
    <h4 style="margin: 4px 0 6px; font-size: 13px;">Manodopera</h4>
    <div class="small-text" id="${prefix}labourRateLabel">Tariffa oraria dealer: -- €/h</div>

    <div class="form-group">
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="border-bottom:1px solid #ddd; text-align:left;">Codice labour</th>
            <th style="border-bottom:1px solid #ddd; text-align:left;">Descrizione</th>
            <th style="border-bottom:1px solid #ddd; text-align:right;">Quantità</th>
            <th style="border-bottom:1px solid #ddd; text-align:right;">Totale</th>
            <th style="border-bottom:1px solid #ddd; text-align:center;">Azioni</th>
          </tr>
        </thead>
        <tbody id="${prefix}labourBody"></tbody>
      </table>
    </div>

    <div class="form-group" style="display:flex; justify-content:space-between; align-items:center;">
      <button type="button" id="${prefix}addLabour" class="btn btn-small btn-secondary">Aggiungi manodopera</button>
      <div><strong>Totale manodopera: </strong><span id="${prefix}labourTotal">0.00</span> €</div>
    </div>

    <hr>

    <div class="form-group">
      <button type="button" id="${prefix}saveBtn" class="btn btn-primary btn-small">
        Salva dati Garanzia
      </button>
    </div>
  `;

  container.innerHTML = html;

  if (typeof firebase === "undefined" || !firebase.firestore) {
    const msg = document.createElement("div");
    msg.className = "small-text";
    msg.textContent = "Firebase non disponibile.";
    container.appendChild(msg);
    return;
  }

  const db = firebase.firestore();

  const symptomSelect    = container.querySelector("#" + prefix + "symptom");
  const cccSelect        = container.querySelector("#" + prefix + "ccc");
  const causaCodeInput   = container.querySelector("#" + prefix + "causaCode");
  const causaSearchBtn   = container.querySelector("#" + prefix + "causaSearch");
  const causaExtInput    = container.querySelector("#" + prefix + "causaExt");
  const causaDescInput   = container.querySelector("#" + prefix + "causaDesc");
  const commentoInput    = container.querySelector("#" + prefix + "commento");
  const prevInvoiceInput = includePrevInvoiceDate
    ? container.querySelector("#" + prefix + "prevInvoiceDate")
    : null;

  const partsBody       = container.querySelector("#" + prefix + "partsBody");
  const addPartBtn      = container.querySelector("#" + prefix + "addPart");
  const partsTotalSpan  = container.querySelector("#" + prefix + "partsTotal");

  const labourBody      = container.querySelector("#" + prefix + "labourBody");
  const addLabourBtn    = container.querySelector("#" + prefix + "addLabour");
  const labourTotalSpan = container.querySelector("#" + prefix + "labourTotal");
  const labourRateLabel = container.querySelector("#" + prefix + "labourRateLabel");

  const saveBtn         = container.querySelector("#" + prefix + "saveBtn");

  let causaPartId  = gar.causaPart && gar.causaPart.id ? gar.causaPart.id : null;
  let labourRateStd = typeof gar.labourRateStd === "number" ? gar.labourRateStd : null;

  if (includePrevInvoiceDate && prevInvoiceInput && gar.previousInvoiceDate) {
    prevInvoiceInput.value = gar.previousInvoiceDate;
  }

  // ---------- SYMPTOM + CCC ----------

  async function loadSymptoms(selectedId) {
    if (!symptomSelect) return;
    symptomSelect.innerHTML = "";

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Seleziona...";
    symptomSelect.appendChild(optEmpty);

    try {
      const snap = await db.collection("Symptom").get();
      const docs = [];
      snap.forEach(doc => docs.push(doc));
      docs.sort((a, b) => {
        const la = (a.data().label || "").toString();
        const lb = (b.data().label || "").toString();
        return la.localeCompare(lb, "it");
      });

      docs.forEach(doc => {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.id + " - " + (d.label || "");
        symptomSelect.appendChild(opt);
      });

      if (selectedId) {
        symptomSelect.value = selectedId;
      }
    } catch (err) {
      console.error("Errore caricamento Symptom:", err);
    }
  }

  async function loadCCCForSymptom(symptomId, selectedCCCId) {
    if (!cccSelect) return;
    cccSelect.innerHTML = "";

    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Seleziona...";
    cccSelect.appendChild(optEmpty);

    if (!symptomId) return;

    try {
      const collRef = db
        .collection("Symptom")
        .doc(symptomId)
        .collection("CCC_Codes");

      const snap = await collRef.get();
      if (snap.empty) {
        console.warn("[Garanzia] Nessun CCC_Code per Symptom:", symptomId);
        return;
      }

      const docs = [];
      snap.forEach(doc => docs.push(doc));

      docs.sort((a, b) => {
        const oa = toNumberOrNull(a.data().order) || 0;
        const ob = toNumberOrNull(b.data().order) || 0;
        return oa - ob;
      });

      docs.forEach(doc => {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = d.text || doc.id;
        opt.dataset.order = d.order != null ? String(d.order) : "";
        cccSelect.appendChild(opt);
      });

      if (selectedCCCId) {
        cccSelect.value = selectedCCCId;
      }
    } catch (err) {
      console.error("Errore caricamento CCC Codes:", err);
      alert("Errore nel caricamento dei CCC Codes: " + err.message);
    }
  }

  if (symptomSelect) {
    symptomSelect.addEventListener("change", () => {
      loadCCCForSymptom(symptomSelect.value, null);
    });
  }

  const garSymptomId = gar.symptom && gar.symptom.id ? gar.symptom.id : null;
  const garCCCId     = gar.ccc && gar.ccc.id ? gar.ccc.id : null;

  loadSymptoms(garSymptomId).then(() => {
    if (garSymptomId) loadCCCForSymptom(garSymptomId, garCCCId);
  });

  // ---------- Componente causa ----------

  if (gar.causaPart) {
    causaCodeInput.value = gar.causaPart.codice || "";
    causaExtInput.value  = gar.causaPart.codice_esteso || "";
    causaDescInput.value = gar.causaPart.descrizione || "";
    causaPartId          = gar.causaPart.id || null;
  }

  async function findPartByCode(code) {
    if (!code) return null;
    const snap = await db
      .collection("FTPartsCodes")
      .where("codice", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  if (causaSearchBtn) {
    causaSearchBtn.addEventListener("click", async () => {
      const code = (causaCodeInput.value || "").trim();
      if (!code) {
        alert("Inserisci un codice ricambio per la componente causa.");
        return;
      }
      try {
        const found = await findPartByCode(code);
        if (!found) {
          alert("Ricambio non trovato in FTPartsCodes.");
          return;
        }
        const d = found.data;
        causaPartId = found.id;
        causaExtInput.value  = d.codice_esteso || "";
        causaDescInput.value = d.descrizione || "";
      } catch (err) {
        console.error(err);
        alert("Errore durante la ricerca componente causa: " + err.message);
      }
    });
  }

  if (gar.commentoTecnico) {
    commentoInput.value = gar.commentoTecnico;
  }

  // ---------- Ricambi ----------

  function createPartRow(initialData) {
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.style.width = "100px";
    codeInput.value = initialData && initialData.codice ? initialData.codice : "";
    codeInput.dataset.partId = initialData && initialData.id ? initialData.id : "";

    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.textContent = "Cerca";
    searchBtn.className = "btn btn-small btn-secondary";
    searchBtn.style.marginLeft = "4px";

    tdCode.appendChild(codeInput);
    tdCode.appendChild(searchBtn);

    const tdExt = document.createElement("td");
    const extInput = document.createElement("input");
    extInput.type = "text";
    extInput.readOnly = true;
    extInput.style.width = "100%";
    extInput.value = initialData && initialData.codice_esteso ? initialData.codice_esteso : "";
    tdExt.appendChild(extInput);

    const tdDesc = document.createElement("td");
    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.readOnly = true;
    descInput.style.width = "100%";
    descInput.value = initialData && initialData.descrizione ? initialData.descrizione : "";
    tdDesc.appendChild(descInput);

    const tdRefund = document.createElement("td");
    tdRefund.style.textAlign = "right";
    const refundInput = document.createElement("input");
    refundInput.type = "number";
    refundInput.readOnly = true;
    refundInput.style.width = "90px";
    refundInput.step = "0.01";
    refundInput.value = initialData && initialData.rimborso_garanzia != null
      ? formatMoney(initialData.rimborso_garanzia)
      : "";
    tdRefund.appendChild(refundInput);

    const tdQty = document.createElement("td");
    tdQty.style.textAlign = "right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.style.width = "60px";
    qtyInput.value = initialData && initialData.quantita != null
      ? String(initialData.quantita)
      : "1";
    tdQty.appendChild(qtyInput);

    const tdTotal = document.createElement("td");
    tdTotal.style.textAlign = "right";
    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.readOnly = true;
    totalInput.style.width = "90px";
    totalInput.step = "0.01";
    totalInput.value = initialData && initialData.totale != null
      ? formatMoney(initialData.totale)
      : "0.00";
    tdTotal.appendChild(totalInput);

    const tdActions = document.createElement("td");
    tdActions.style.textAlign = "center";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Elimina";
    delBtn.className = "btn btn-small btn-danger";
    tdActions.appendChild(delBtn);

    tr.appendChild(tdCode);
    tr.appendChild(tdExt);
    tr.appendChild(tdDesc);
    tr.appendChild(tdRefund);
    tr.appendChild(tdQty);
    tr.appendChild(tdTotal);
    tr.appendChild(tdActions);

    partsBody.appendChild(tr);

    function recalcRow() {
      const refund = toNumberOrNull(refundInput.value) || 0;
      const qty    = toNumberOrNull(qtyInput.value) || 0;
      const tot    = refund * qty;
      totalInput.value = formatMoney(tot);
      recalcPartsTotals();
    }

    qtyInput.addEventListener("input", recalcRow);

    searchBtn.addEventListener("click", async () => {
      const code = (codeInput.value || "").trim();
      if (!code) {
        alert("Inserisci un codice ricambio.");
        return;
      }
      try {
        const found = await findPartByCode(code);
        if (!found) {
          alert("Ricambio non trovato in FTPartsCodes.");
          return;
        }
        const d = found.data;
        codeInput.dataset.partId = found.id;
        extInput.value   = d.codice_esteso || "";
        descInput.value  = d.descrizione || "";
        refundInput.value = d.rimborso_garanzia != null
          ? formatMoney(d.rimborso_garanzia)
          : "";
        recalcRow();
      } catch (err) {
        console.error(err);
        alert("Errore ricerca ricambio: " + err.message);
      }
    });

    delBtn.addEventListener("click", () => {
      tr.remove();
      recalcPartsTotals();
    });

    recalcRow();
  }

  function recalcPartsTotals() {
    let tot = 0;
    const rows = partsBody.querySelectorAll("tr");
    rows.forEach(tr => {
      const totalInput = tr.querySelector("td:nth-child(6) input");
      const v = totalInput ? toNumberOrNull(totalInput.value) || 0 : 0;
      tot += v;
    });
    partsTotalSpan.textContent = formatMoney(tot);
  }

  if (Array.isArray(gar.parts)) {
    gar.parts.forEach(p => createPartRow(p));
    recalcPartsTotals();
  }

  if (addPartBtn) {
    addPartBtn.addEventListener("click", () => {
      createPartRow(null);
    });
  }

  // ---------- Manodopera ----------

  async function loadLabourRateStdIfNeeded() {
    if (labourRateStd != null) {
      labourRateLabel.textContent =
        "Tariffa oraria dealer: " + formatMoney(labourRateStd) + " €/h";
      return labourRateStd;
    }
    try {
      const cardSnap = await db.collection("ClaimCards").doc(ctx.claimCardId).get();
      if (!cardSnap.exists) {
        labourRateStd = 0;
        labourRateLabel.textContent = "Tariffa oraria dealer: n/d";
        return labourRateStd;
      }
      const cardData = cardSnap.data() || {};
      const dealerId = cardData.openDealer || cardData.dealerId || null;
      if (!dealerId) {
        labourRateStd = 0;
        labourRateLabel.textContent = "Tariffa oraria dealer: n/d";
        return labourRateStd;
      }
      const dealerSnap = await db.collection("dealers").doc(dealerId).get();
      if (!dealerSnap.exists) {
        labourRateStd = 0;
        labourRateLabel.textContent = "Tariffa oraria dealer: n/d";
        return labourRateStd;
      }
      const dealerData = dealerSnap.data() || {};
      labourRateStd = toNumberOrNull(dealerData.LaborRateStd) || 0;
      labourRateLabel.textContent =
        "Tariffa oraria dealer: " + formatMoney(labourRateStd) + " €/h";
      return labourRateStd;
    } catch (err) {
      console.error("Errore lettura LaborRateStd:", err);
      labourRateStd = 0;
      labourRateLabel.textContent = "Tariffa oraria dealer: n/d";
      return labourRateStd;
    }
  }

  async function findLabourByCode(code) {
    if (!code) return null;
    const snap = await db
      .collection("FTLabourCodes")
      .where("codice_labour", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  function createLabourRow(initialData) {
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.style.width = "100px";
    codeInput.value = initialData && initialData.codice_labour
      ? initialData.codice_labour
      : "";
    codeInput.dataset.labourId = initialData && initialData.id ? initialData.id : "";

    const searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.textContent = "Cerca";
    searchBtn.className = "btn btn-small btn-secondary";
    searchBtn.style.marginLeft = "4px";

    tdCode.appendChild(codeInput);
    tdCode.appendChild(searchBtn);

    const tdDesc = document.createElement("td");
    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.readOnly = true;
    descInput.style.width = "100%";
    descInput.value = initialData && initialData.descrizione_tradotta
      ? initialData.descrizione_tradotta
      : "";
    tdDesc.appendChild(descInput);

    const tdQty = document.createElement("td");
    tdQty.style.textAlign = "right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "0.1";
    qtyInput.style.width = "60px";
    qtyInput.value = initialData && initialData.quantita != null
      ? String(initialData.quantita)
      : "1";
    tdQty.appendChild(qtyInput);

    const tdTotal = document.createElement("td");
    tdTotal.style.textAlign = "right";
    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.style.width = "90px";
    totalInput.step = "0.01";
    totalInput.value = initialData && initialData.totale != null
      ? formatMoney(initialData.totale)
      : "0.00";
    tdTotal.appendChild(totalInput);

    const tdActions = document.createElement("td");
    tdActions.style.textAlign = "center";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "Elimina";
    delBtn.className = "btn btn-small btn-danger";
    tdActions.appendChild(delBtn);

    tr.appendChild(tdCode);
    tr.appendChild(tdDesc);
    tr.appendChild(tdQty);
    tr.appendChild(tdTotal);
    tr.appendChild(tdActions);

    labourBody.appendChild(tr);

    function normalizedCode() {
      return (codeInput.value || "").replace(/\s+/g, "").toUpperCase();
    }

    function isCode96or94() {
      const c = normalizedCode();
      return c === "96000000" || c === "94000000";
    }

    function isCodeOL000() {
      const c = normalizedCode();
      return c === "OL000";
    }

    function updateFieldModes() {
      const isSpecialQty = isCode96or94();
      const isOL = isCodeOL000();

      if (isOL) {
        qtyInput.readOnly = true;
        totalInput.readOnly = false;
      } else if (isSpecialQty) {
        qtyInput.readOnly = false;
        totalInput.readOnly = true;
      } else {
        qtyInput.readOnly = true;
        totalInput.readOnly = true;
      }
    }

    function recalcRow(fromTotalChange) {
      const rate = labourRateStd || 0;

      if (isCodeOL000()) {
        if (fromTotalChange) {
          const tot = toNumberOrNull(totalInput.value) || 0;
          const qty = rate ? tot / rate : 0;
          qtyInput.value = qty.toFixed(2);
        }
      } else {
        const qty = toNumberOrNull(qtyInput.value) || 0;
        const tot = rate * qty;
        totalInput.value = formatMoney(tot);
      }

      recalcLabourTotals();
    }

    qtyInput.addEventListener("input", () => recalcRow(false));
    totalInput.addEventListener("input", () => {
      if (isCodeOL000()) recalcRow(true);
    });

    searchBtn.addEventListener("click", async () => {
      const code = (codeInput.value || "").trim();
      if (!code) {
        alert("Inserisci un codice labour.");
        return;
      }
      try {
        const found = await findLabourByCode(code);
        if (!found) {
          alert("Codice labour non trovato in FTLabourCodes.");
          return;
        }
        const d = found.data;
        codeInput.dataset.labourId = found.id;
        descInput.value = d.descrizione_tradotta || d.descrizione || "";
        if (d.quantita != null && !initialData) {
          qtyInput.value = String(d.quantita);
        }
        updateFieldModes();
        recalcRow(false);
      } catch (err) {
        console.error(err);
        alert("Errore ricerca labour: " + err.message);
      }
    });

    codeInput.addEventListener("change", () => {
      updateFieldModes();
      recalcRow(false);
    });

    delBtn.addEventListener("click", () => {
      tr.remove();
      recalcLabourTotals();
    });

    updateFieldModes();
    recalcRow(false);
  }

  function recalcLabourTotals() {
    let tot = 0;
    const rows = labourBody.querySelectorAll("tr");
    rows.forEach(tr => {
      const totalInput = tr.querySelector("td:nth-child(4) input");
      const v = totalInput ? toNumberOrNull(totalInput.value) || 0 : 0;
      tot += v;
    });
    labourTotalSpan.textContent = formatMoney(tot);
  }

  loadLabourRateStdIfNeeded().then(() => {
    if (Array.isArray(gar.labour)) {
      gar.labour.forEach(l => createLabourRow(l));
      recalcLabourTotals();
    }
  });

  if (addLabourBtn) {
    addLabourBtn.addEventListener("click", async () => {
      await loadLabourRateStdIfNeeded();
      createLabourRow(null);
    });
  }

  // ---------- Salvataggio Garanzia ----------

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      try {
        await loadLabourRateStdIfNeeded();

        const symptomId = symptomSelect.value || null;
        let symptomLabel = null;
        if (symptomId) {
          const opt = symptomSelect.options[symptomSelect.selectedIndex];
          symptomLabel = opt ? opt.textContent : null;
        }

        const cccId = cccSelect.value || null;
        let cccText = null;
        let cccOrder = null;
        if (cccId) {
          const opt = cccSelect.options[cccSelect.selectedIndex];
          if (opt) {
            cccText = opt.textContent;
            cccOrder = opt.dataset.order ? Number(opt.dataset.order) : null;
          }
        }

        const garanziaData = {
          symptom: symptomId
            ? { id: symptomId, label: symptomLabel }
            : null,
          ccc: cccId
            ? { id: cccId, text: cccText, order: cccOrder }
            : null,
          causaPart: causaPartId
            ? {
                id: causaPartId,
                codice: (causaCodeInput.value || "").trim() || null,
                codice_esteso: causaExtInput.value || null,
                descrizione: causaDescInput.value || null
              }
            : null,
          commentoTecnico: (commentoInput.value || "").trim() || null,
          labourRateStd: labourRateStd != null ? labourRateStd : null
        };

        if (includePrevInvoiceDate && prevInvoiceInput) {
          garanziaData.previousInvoiceDate =
            prevInvoiceInput.value ? prevInvoiceInput.value : null;
        }

        const parts = [];
        let partsTotal = 0;
        const partRows = partsBody.querySelectorAll("tr");
        partRows.forEach(tr => {
          const codeInput = tr.querySelector("td:nth-child(1) input");
          const refundInput = tr.querySelector("td:nth-child(4) input");
          const qtyInput = tr.querySelector("td:nth-child(5) input");
          const totalInput = tr.querySelector("td:nth-child(6) input");

          const codice = codeInput ? (codeInput.value || "").trim() : "";
          if (!codice) return;

          const p = {
            id: codeInput.dataset.partId || null,
            codice: codice,
            codice_esteso: tr.querySelector("td:nth-child(2) input").value || null,
            descrizione: tr.querySelector("td:nth-child(3) input").value || null,
            rimborso_garanzia: toNumberOrNull(refundInput.value),
            quantita: toNumberOrNull(qtyInput.value),
            totale: toNumberOrNull(totalInput.value)
          };
          partsTotal += p.totale || 0;
          parts.push(p);
        });
        garanziaData.parts = parts;
        garanziaData.totaleRicambi = partsTotal;

        const labour = [];
        let labourTotal = 0;
        const labourRows = labourBody.querySelectorAll("tr");
        labourRows.forEach(tr => {
          const codeInput = tr.querySelector("td:nth-child(1) input");
          const qtyInput   = tr.querySelector("td:nth-child(3) input");
          const totalInput = tr.querySelector("td:nth-child(4) input");
          const codice = codeInput ? (codeInput.value || "").trim() : "";
          if (!codice) return;

          const l = {
            id: codeInput.dataset.labourId || null,
            codice_labour: codice,
            descrizione_tradotta: tr.querySelector("td:nth-child(2) input").value || null,
            quantita: toNumberOrNull(qtyInput.value),
            totale: toNumberOrNull(totalInput.value)
          };
          labourTotal += l.totale || 0;
          labour.push(l);
        });
        garanziaData.labour = labour;
        garanziaData.totaleManodopera = labourTotal;

        const claimRef = db
          .collection("ClaimCards")
          .doc(ctx.claimCardId)
          .collection("Claims")
          .doc(ctx.claimCode);

        await claimRef.update({ garanzia: garanziaData });

        alert("Dati Garanzia salvati.");
      } catch (err) {
        console.error(err);
        alert("Errore nel salvataggio dati Garanzia: " + err.message);
      }
    });
  }

  // Sezione allegati generici + note
  renderClaimAttachmentsSection(container, ctx);
  renderClaimNotesSection(container, ctx);
}
