// ===============================
// ftclaims-claimforms.js
// Dettagli dei singoli claim (RSA, Garanzia, Garanzia Ricambio, Service Contract)
// + Allegati + Note (stile chat) per ogni claim
// ===============================

function normalizeClaimType(ct) {
  return (ct || "").toString().trim().toUpperCase();
}

function escapeHtml(s) {
  return (s || "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

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

function toBool(v) {
  return v === true || v === "true" || v === "TRUE" || v === 1 || v === "1" || v === "SI" || v === "YES";
}

/**
 * Entry point:
 *   - claimType: "RSA", "Garanzia", "Garanzia Ricambio", "Service Contract", ...
 *   - container: div interno alla card della singola riparazione
 *   - claimData: dati Firestore del claim
 *   - ctx: { claimCardId, claimCode }
 */
function renderClaimDetails(claimType, container, claimData, ctx) {
  const type = normalizeClaimType(claimType);

  container.innerHTML = "";

  if (type === "RSA") {
    renderRSADetails(container, claimData, ctx);
    return;
  } else if (type === "GARANZIA") {
    renderGaranziaDetails(container, claimData, ctx);
    return;
  } else if (type === "GARANZIA RICAMBIO") {
    renderGaranziaRicambioDetails(container, claimData, ctx);
    return;
  } else if (type === "SERVICE CONTRACT" || type === "MANUTENZIONE") {
    renderServiceContractDetails(container, claimData, ctx);
    return;
  }

  const info = document.createElement("div");
  info.className = "small-text";
  info.textContent =
    'Per la tipologia "' + type + '" non sono ancora previsti campi aggiuntivi.';
  container.appendChild(info);

  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
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
    "01-01", "01-06", "04-25", "05-01", "06-02",
    "08-15", "11-01", "12-08", "12-25", "12-26"
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
    </div>

    <div class="form-group">
      <label for="${prefix}route">Tragitto (uno o più file)</label>
      <input type="file" id="${prefix}route" multiple>
    </div>

    <div class="form-group">
      <button type="button" id="${prefix}saveBtn" class="btn btn-primary btn-small">
        Salva dati RSA
      </button>
    </div>
  `;

  container.innerHTML = html;

  const dateInput       = container.querySelector("#" + prefix + "date");
  const onlyTowInput    = container.querySelector("#" + prefix + "onlyTow");
  const dayHoursInput   = container.querySelector("#" + prefix + "dayHours");
  const dayMinInput     = container.querySelector("#" + prefix + "dayMinutes");
  const nightHoursInput = container.querySelector("#" + prefix + "nightHours");
  const nightMinInput   = container.querySelector("#" + prefix + "nightMinutes");
  const kmInput         = container.querySelector("#" + prefix + "km");
  const caseInput       = container.querySelector("#" + prefix + "case");
  const towCostsInput   = container.querySelector("#" + prefix + "towCosts");
  const invoicesInput   = container.querySelector("#" + prefix + "invoices");
  const routeInput      = container.querySelector("#" + prefix + "route");
  const saveBtn         = container.querySelector("#" + prefix + "saveBtn");

  if (rsa.date) dateInput.value = rsa.date;
  if (rsa.onlyTow) onlyTowInput.checked = !!rsa.onlyTow;
  if (rsa.dayShiftHours != null)   dayHoursInput.value  = rsa.dayShiftHours;
  if (rsa.dayShiftMinutes != null) dayMinInput.value    = rsa.dayShiftMinutes;
  if (rsa.nightShiftHours != null) nightHoursInput.value = rsa.nightShiftHours;
  if (rsa.nightShiftMinutes != null) nightMinInput.value = rsa.nightShiftMinutes;
  if (rsa.km != null) kmInput.value = rsa.km;
  if (rsa.caseNumber) caseInput.value = rsa.caseNumber;
  if (rsa.towCostsAmount != null) towCostsInput.value = rsa.towCostsAmount;

  function updateFieldsState() {
    const onlyTow  = onlyTowInput.checked;
    const dateStr  = dateInput.value || "";
    const isSpecial= isWeekendOrItalianHoliday(dateStr);

    const dayInputs   = [dayHoursInput, dayMinInput];
    const nightInputs = [nightHoursInput, nightMinInput];
    const kmInputs    = [kmInput];

    if (onlyTow) {
      [].concat(dayInputs, nightInputs, kmInputs).forEach(function (el) {
        if (!el) return;
        el.disabled = true;
        el.value = "";
      });
      return;
    }

    dayInputs.forEach(function (el) {
      if (!el) return;
      el.disabled = isSpecial;
      if (isSpecial) el.value = "";
    });

    nightInputs.forEach(function (el) {
      if (!el) return;
      el.disabled = false;
    });

    kmInputs.forEach(function (el) {
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
    var v = input.value.trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async function () {
      if (typeof firebase === "undefined" || !firebase.firestore || !firebase.storage) {
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
        dayShiftHours:    onlyTow ? null : readInt(dayHoursInput),
        dayShiftMinutes:  onlyTow ? null : readInt(dayMinInput),
        nightShiftHours:  onlyTow ? null : readInt(nightHoursInput),
        nightShiftMinutes:onlyTow ? null : readInt(nightMinInput),
        km:               onlyTow ? null : readInt(kmInput),
        caseNumber: (caseInput.value.trim() || null),
        towCostsAmount: readCurrency(towCostsInput)
      };

      const basePath = "ClaimCards/" + ctx.claimCardId + "/Claims/" + ctx.claimCode + "/";

      let invoiceMeta = Array.isArray(rsa.invoiceFiles) ? rsa.invoiceFiles.slice() : [];
      let routeMeta   = Array.isArray(rsa.routeFiles)   ? rsa.routeFiles.slice()   : [];

      const invFiles = invoicesInput.files || [];
      for (let i = 0; i < invFiles.length; i++) {
        const f = invFiles[i];
        const path = basePath + "Fatture/" + Date.now() + "_" + f.name;
        const ref  = storage.ref(path);
        await ref.put(f);
        const url = await ref.getDownloadURL();
        invoiceMeta.push({ name: f.name, path: path, url: url });
      }

      const routeFiles = routeInput.files || [];
      for (let i = 0; i < routeFiles.length; i++) {
        const f = routeFiles[i];
        const path = basePath + "Tragitto/" + Date.now() + "_" + f.name;
        const ref  = storage.ref(path);
        await ref.put(f);
        const url = await ref.getDownloadURL();
        routeMeta.push({ name: f.name, path: path, url: url });
      }

      if (invoiceMeta.length) rsaData.invoiceFiles = invoiceMeta;
      if (routeMeta.length)   rsaData.routeFiles   = routeMeta;

      try {
        const claimRef = db
          .collection("ClaimCards")
          .doc(ctx.claimCardId)
          .collection("Claims")
          .doc(ctx.claimCode);

        await claimRef.update({ rsa: rsaData });

        invoicesInput.value = "";
        routeInput.value = "";

        alert("Dati RSA salvati.");
      } catch (err) {
        console.error(err);
        alert("Errore nel salvataggio dati RSA: " + err.message);
      }
    });
  }

  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
}
/* ===============================
   GARANZIA / GARANZIA RICAMBIO
=============================== */

function renderGaranziaDetailsInternal(container, garData, ctx, options) {
  const gar = garData || {};
  const isRicambio = !!(options && options.isRicambio);

  const prefixBase = isRicambio ? "gric_" : "gar_";
  const prefix = prefixBase + ctx.claimCode + "_";

  const titolo = isRicambio ? "Dati Garanzia Ricambio" : "Dati Garanzia";
  const labelSave = isRicambio ? "Salva dati Garanzia Ricambio" : "Salva dati Garanzia";

  const html = `
    <h4 style="margin: 4px 0 6px; font-size: 13px;">${titolo}</h4>

    <div class="form-group">
      <label for="${prefix}symptom">Symptom</label>
      <select id="${prefix}symptom"></select>
    </div>

    <div class="form-group">
      <label for="${prefix}ccc">CCC Codes</label>
      <select id="${prefix}ccc"></select>
    </div>

    ${
      isRicambio
        ? `
    <div class="form-group">
      <label for="${prefix}prevInvDate">Data Fattura Precedente Lavorazione</label>
      <input type="date" id="${prefix}prevInvDate">
    </div>
    `
        : ""
    }

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

    <div class="form-group">
      <label for="${prefix}commento">Commento tecnico</label>
      <textarea id="${prefix}commento" rows="3"></textarea>
    </div>

    <hr>

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
        ${labelSave}
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

  const symptomSelect   = container.querySelector("#" + prefix + "symptom");
  const cccSelect       = container.querySelector("#" + prefix + "ccc");
  const prevInvDateInput= isRicambio ? container.querySelector("#" + prefix + "prevInvDate") : null;
  const causaCodeInput  = container.querySelector("#" + prefix + "causaCode");
  const causaSearchBtn  = container.querySelector("#" + prefix + "causaSearch");
  const causaExtInput   = container.querySelector("#" + prefix + "causaExt");
  const causaDescInput  = container.querySelector("#" + prefix + "causaDesc");
  const commentoInput   = container.querySelector("#" + prefix + "commento");

  const partsBody       = container.querySelector("#" + prefix + "partsBody");
  const addPartBtn      = container.querySelector("#" + prefix + "addPart");
  const partsTotalSpan  = container.querySelector("#" + prefix + "partsTotal");

  const labourBody      = container.querySelector("#" + prefix + "labourBody");
  const addLabourBtn    = container.querySelector("#" + prefix + "addLabour");
  const labourTotalSpan = container.querySelector("#" + prefix + "labourTotal");
  const labourRateLabel = container.querySelector("#" + prefix + "labourRateLabel");

  const saveBtn         = container.querySelector("#" + prefix + "saveBtn");

  let causaPartId   = gar.causaPart && gar.causaPart.id ? gar.causaPart.id : null;
  let labourRateStd = typeof gar.labourRateStd === "number" ? gar.labourRateStd : null;

  async function loadSymptoms(selectedId) {
    symptomSelect.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Seleziona...";
    symptomSelect.appendChild(optEmpty);

    try {
      const snap = await db.collection("Symptom").get();
      const docs = [];
      snap.forEach(doc => docs.push(doc));
      docs.sort((a, b) => (a.data().label || "").toString().localeCompare((b.data().label || "").toString(), "it"));

      docs.forEach(function (doc) {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.id + " - " + (d.label || "");
        symptomSelect.appendChild(opt);
      });

      if (selectedId) symptomSelect.value = selectedId;
    } catch (err) {
      console.error("Errore caricamento Symptom:", err);
    }
  }

  async function loadCCCForSymptom(symptomId, selectedCCCId) {
    cccSelect.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Seleziona...";
    cccSelect.appendChild(optEmpty);
    if (!symptomId) return;

    try {
      const collRef = db.collection("Symptom").doc(symptomId).collection("CCC_Codes");
      const snap = await collRef.get();
      if (snap.empty) return;

      const docs = [];
      snap.forEach(doc => docs.push(doc));

      docs.sort((a, b) => (toNumberOrNull(a.data().order) || 0) - (toNumberOrNull(b.data().order) || 0));

      docs.forEach(function (doc) {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = d.text || doc.id;
        opt.dataset.order = d.order != null ? String(d.order) : "";
        cccSelect.appendChild(opt);
      });

      if (selectedCCCId) cccSelect.value = selectedCCCId;
    } catch (err) {
      console.error("Errore caricamento CCC Codes:", err);
      alert("Errore nel caricamento dei CCC Codes: " + err.message);
    }
  }

  symptomSelect.addEventListener("change", function () {
    loadCCCForSymptom(symptomSelect.value, null);
  });

  const garSymptomId = gar.symptom && gar.symptom.id ? gar.symptom.id : null;
  const garCCCId     = gar.ccc && gar.ccc.id ? gar.ccc.id : null;

  loadSymptoms(garSymptomId).then(function () {
    if (garSymptomId) loadCCCForSymptom(garSymptomId, garCCCId);
  });

  if (gar.causaPart) {
    causaCodeInput.value = gar.causaPart.codice || "";
    causaExtInput.value  = gar.causaPart.codice_esteso || "";
    causaDescInput.value = gar.causaPart.descrizione || "";
    causaPartId          = gar.causaPart.id || null;
  }

  async function findPartByCode(code) {
    if (!code) return null;
    const snap = await db.collection("FTPartsCodes").where("codice", "==", code).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  causaSearchBtn.addEventListener("click", async function () {
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

  if (gar.commentoTecnico) commentoInput.value = gar.commentoTecnico;
  if (isRicambio && prevInvDateInput && gar.previousInvoiceDate) prevInvDateInput.value = gar.previousInvoiceDate;

  function recalcPartsTotals() {
    let tot = 0;
    const rows = partsBody.querySelectorAll("tr");
    rows.forEach(function (tr) {
      const totalInput = tr.querySelector("td:nth-child(6) input");
      const v = totalInput ? toNumberOrNull(totalInput.value) || 0 : 0;
      tot += v;
    });
    partsTotalSpan.textContent = formatMoney(tot);
  }

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
    refundInput.value = initialData && initialData.rimborso_garanzia != null ? formatMoney(initialData.rimborso_garanzia) : "";
    tdRefund.appendChild(refundInput);

    const tdQty = document.createElement("td");
    tdQty.style.textAlign = "right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.style.width = "60px";
    qtyInput.value = initialData && initialData.quantita != null ? String(initialData.quantita) : "1";
    tdQty.appendChild(qtyInput);

    const tdTotal = document.createElement("td");
    tdTotal.style.textAlign = "right";
    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.readOnly = true;
    totalInput.style.width = "90px";
    totalInput.step = "0.01";
    totalInput.value = initialData && initialData.totale != null ? formatMoney(initialData.totale) : "0.00";
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
      const qty = toNumberOrNull(qtyInput.value) || 0;
      const tot = refund * qty;
      totalInput.value = formatMoney(tot);
      recalcPartsTotals();
    }

    qtyInput.addEventListener("input", recalcRow);

    searchBtn.addEventListener("click", async function () {
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
        extInput.value = d.codice_esteso || "";
        descInput.value = d.descrizione || "";
        refundInput.value = d.rimborso_garanzia != null ? formatMoney(d.rimborso_garanzia) : "";
        recalcRow();
      } catch (err) {
        console.error(err);
        alert("Errore ricerca ricambio: " + err.message);
      }
    });

    delBtn.addEventListener("click", function () {
      tr.remove();
      recalcPartsTotals();
    });

    recalcRow();
  }

  if (Array.isArray(gar.parts)) {
    gar.parts.forEach(p => createPartRow(p));
    recalcPartsTotals();
  }

  addPartBtn.addEventListener("click", function () {
    createPartRow(null);
  });

  async function loadLabourRateStdIfNeeded() {
    if (labourRateStd != null) {
      labourRateLabel.textContent = "Tariffa oraria dealer: " + formatMoney(labourRateStd) + " €/h";
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
      labourRateLabel.textContent = "Tariffa oraria dealer: " + formatMoney(labourRateStd) + " €/h";
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
    const snap = await db.collection("FTLabourCodes").where("codice_labour", "==", code).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  function recalcLabourTotals() {
    let tot = 0;
    const rows = labourBody.querySelectorAll("tr");
    rows.forEach(function (tr) {
      const totalInput = tr.querySelector("td:nth-child(4) input");
      const v = totalInput ? toNumberOrNull(totalInput.value) || 0 : 0;
      tot += v;
    });
    labourTotalSpan.textContent = formatMoney(tot);
  }

  function createLabourRow(initialData) {
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.style.width = "100px";
    codeInput.value = initialData && initialData.codice_labour ? initialData.codice_labour : "";
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
    descInput.value = initialData && initialData.descrizione_tradotta ? initialData.descrizione_tradotta : "";
    tdDesc.appendChild(descInput);

    const tdQty = document.createElement("td");
    tdQty.style.textAlign = "right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "0.1";
    qtyInput.style.width = "60px";
    qtyInput.value = initialData && initialData.quantita != null ? String(initialData.quantita) : "1";
    tdQty.appendChild(qtyInput);

    const tdTotal = document.createElement("td");
    tdTotal.style.textAlign = "right";
    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.style.width = "90px";
    totalInput.step = "0.01";
    totalInput.value = initialData && initialData.totale != null ? formatMoney(initialData.totale) : "0.00";
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

    qtyInput.addEventListener("input", function () { recalcRow(false); });
    totalInput.addEventListener("input", function () {
      if (isCodeOL000()) recalcRow(true);
    });

    searchBtn.addEventListener("click", async function () {
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
        if (d.quantita != null && !initialData) qtyInput.value = String(d.quantita);
        updateFieldModes();
        recalcRow(false);
      } catch (err) {
        console.error(err);
        alert("Errore ricerca labour: " + err.message);
      }
    });

    codeInput.addEventListener("change", function () {
      updateFieldModes();
      recalcRow(false);
    });

    delBtn.addEventListener("click", function () {
      tr.remove();
      recalcLabourTotals();
    });

    updateFieldModes();
    recalcRow(false);
  }

  loadLabourRateStdIfNeeded().then(function () {
    if (Array.isArray(gar.labour)) {
      gar.labour.forEach(l => createLabourRow(l));
      recalcLabourTotals();
    }
  });

  addLabourBtn.addEventListener("click", async function () {
    await loadLabourRateStdIfNeeded();
    createLabourRow(null);
  });

  saveBtn.addEventListener("click", async function () {
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
        symptom: symptomId ? { id: symptomId, label: symptomLabel } : null,
        ccc: cccId ? { id: cccId, text: cccText, order: cccOrder } : null,
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

      if (isRicambio && prevInvDateInput) {
        garanziaData.previousInvoiceDate = prevInvDateInput.value || null;
      }

      const parts = [];
      let partsTotal = 0;
      const partRows = partsBody.querySelectorAll("tr");
      partRows.forEach(function (tr) {
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
      labourRows.forEach(function (tr) {
        const codeInput = tr.querySelector("td:nth-child(1) input");
        const qtyInput = tr.querySelector("td:nth-child(3) input");
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

      const fieldName = isRicambio ? "garanziaRicambio" : "garanzia";
      const updateObj = {};
      updateObj[fieldName] = garanziaData;

      await claimRef.update(updateObj);

      alert(labelSave + " salvati.");
    } catch (err) {
      console.error(err);
      alert("Errore nel salvataggio dati Garanzia: " + err.message);
    }
  });

  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
}

function renderGaranziaDetails(container, claimData, ctx) {
  renderGaranziaDetailsInternal(container, claimData.garanzia || {}, ctx, { isRicambio: false });
}

function renderGaranziaRicambioDetails(container, claimData, ctx) {
  renderGaranziaDetailsInternal(container, claimData.garanziaRicambio || {}, ctx, { isRicambio: true });
}
/* ===============================
   GARANZIA / GARANZIA RICAMBIO
=============================== */

function renderGaranziaDetailsInternal(container, garData, ctx, options) {
  const gar = garData || {};
  const isRicambio = !!(options && options.isRicambio);

  const prefixBase = isRicambio ? "gric_" : "gar_";
  const prefix = prefixBase + ctx.claimCode + "_";

  const titolo = isRicambio ? "Dati Garanzia Ricambio" : "Dati Garanzia";
  const labelSave = isRicambio ? "Salva dati Garanzia Ricambio" : "Salva dati Garanzia";

  const html = `
    <h4 style="margin: 4px 0 6px; font-size: 13px;">${titolo}</h4>

    <div class="form-group">
      <label for="${prefix}symptom">Symptom</label>
      <select id="${prefix}symptom"></select>
    </div>

    <div class="form-group">
      <label for="${prefix}ccc">CCC Codes</label>
      <select id="${prefix}ccc"></select>
    </div>

    ${
      isRicambio
        ? `
    <div class="form-group">
      <label for="${prefix}prevInvDate">Data Fattura Precedente Lavorazione</label>
      <input type="date" id="${prefix}prevInvDate">
    </div>
    `
        : ""
    }

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

    <div class="form-group">
      <label for="${prefix}commento">Commento tecnico</label>
      <textarea id="${prefix}commento" rows="3"></textarea>
    </div>

    <hr>

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
        ${labelSave}
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

  const symptomSelect   = container.querySelector("#" + prefix + "symptom");
  const cccSelect       = container.querySelector("#" + prefix + "ccc");
  const prevInvDateInput= isRicambio ? container.querySelector("#" + prefix + "prevInvDate") : null;
  const causaCodeInput  = container.querySelector("#" + prefix + "causaCode");
  const causaSearchBtn  = container.querySelector("#" + prefix + "causaSearch");
  const causaExtInput   = container.querySelector("#" + prefix + "causaExt");
  const causaDescInput  = container.querySelector("#" + prefix + "causaDesc");
  const commentoInput   = container.querySelector("#" + prefix + "commento");

  const partsBody       = container.querySelector("#" + prefix + "partsBody");
  const addPartBtn      = container.querySelector("#" + prefix + "addPart");
  const partsTotalSpan  = container.querySelector("#" + prefix + "partsTotal");

  const labourBody      = container.querySelector("#" + prefix + "labourBody");
  const addLabourBtn    = container.querySelector("#" + prefix + "addLabour");
  const labourTotalSpan = container.querySelector("#" + prefix + "labourTotal");
  const labourRateLabel = container.querySelector("#" + prefix + "labourRateLabel");

  const saveBtn         = container.querySelector("#" + prefix + "saveBtn");

  let causaPartId   = gar.causaPart && gar.causaPart.id ? gar.causaPart.id : null;
  let labourRateStd = typeof gar.labourRateStd === "number" ? gar.labourRateStd : null;

  async function loadSymptoms(selectedId) {
    symptomSelect.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Seleziona...";
    symptomSelect.appendChild(optEmpty);

    try {
      const snap = await db.collection("Symptom").get();
      const docs = [];
      snap.forEach(doc => docs.push(doc));
      docs.sort((a, b) => (a.data().label || "").toString().localeCompare((b.data().label || "").toString(), "it"));

      docs.forEach(function (doc) {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = doc.id + " - " + (d.label || "");
        symptomSelect.appendChild(opt);
      });

      if (selectedId) symptomSelect.value = selectedId;
    } catch (err) {
      console.error("Errore caricamento Symptom:", err);
    }
  }

  async function loadCCCForSymptom(symptomId, selectedCCCId) {
    cccSelect.innerHTML = "";
    const optEmpty = document.createElement("option");
    optEmpty.value = "";
    optEmpty.textContent = "Seleziona...";
    cccSelect.appendChild(optEmpty);
    if (!symptomId) return;

    try {
      const collRef = db.collection("Symptom").doc(symptomId).collection("CCC_Codes");
      const snap = await collRef.get();
      if (snap.empty) return;

      const docs = [];
      snap.forEach(doc => docs.push(doc));

      docs.sort((a, b) => (toNumberOrNull(a.data().order) || 0) - (toNumberOrNull(b.data().order) || 0));

      docs.forEach(function (doc) {
        const d = doc.data() || {};
        const opt = document.createElement("option");
        opt.value = doc.id;
        opt.textContent = d.text || doc.id;
        opt.dataset.order = d.order != null ? String(d.order) : "";
        cccSelect.appendChild(opt);
      });

      if (selectedCCCId) cccSelect.value = selectedCCCId;
    } catch (err) {
      console.error("Errore caricamento CCC Codes:", err);
      alert("Errore nel caricamento dei CCC Codes: " + err.message);
    }
  }

  symptomSelect.addEventListener("change", function () {
    loadCCCForSymptom(symptomSelect.value, null);
  });

  const garSymptomId = gar.symptom && gar.symptom.id ? gar.symptom.id : null;
  const garCCCId     = gar.ccc && gar.ccc.id ? gar.ccc.id : null;

  loadSymptoms(garSymptomId).then(function () {
    if (garSymptomId) loadCCCForSymptom(garSymptomId, garCCCId);
  });

  if (gar.causaPart) {
    causaCodeInput.value = gar.causaPart.codice || "";
    causaExtInput.value  = gar.causaPart.codice_esteso || "";
    causaDescInput.value = gar.causaPart.descrizione || "";
    causaPartId          = gar.causaPart.id || null;
  }

  async function findPartByCode(code) {
    if (!code) return null;
    const snap = await db.collection("FTPartsCodes").where("codice", "==", code).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  causaSearchBtn.addEventListener("click", async function () {
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

  if (gar.commentoTecnico) commentoInput.value = gar.commentoTecnico;
  if (isRicambio && prevInvDateInput && gar.previousInvoiceDate) prevInvDateInput.value = gar.previousInvoiceDate;

  function recalcPartsTotals() {
    let tot = 0;
    const rows = partsBody.querySelectorAll("tr");
    rows.forEach(function (tr) {
      const totalInput = tr.querySelector("td:nth-child(6) input");
      const v = totalInput ? toNumberOrNull(totalInput.value) || 0 : 0;
      tot += v;
    });
    partsTotalSpan.textContent = formatMoney(tot);
  }

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
    refundInput.value = initialData && initialData.rimborso_garanzia != null ? formatMoney(initialData.rimborso_garanzia) : "";
    tdRefund.appendChild(refundInput);

    const tdQty = document.createElement("td");
    tdQty.style.textAlign = "right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "1";
    qtyInput.style.width = "60px";
    qtyInput.value = initialData && initialData.quantita != null ? String(initialData.quantita) : "1";
    tdQty.appendChild(qtyInput);

    const tdTotal = document.createElement("td");
    tdTotal.style.textAlign = "right";
    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.readOnly = true;
    totalInput.style.width = "90px";
    totalInput.step = "0.01";
    totalInput.value = initialData && initialData.totale != null ? formatMoney(initialData.totale) : "0.00";
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
      const qty = toNumberOrNull(qtyInput.value) || 0;
      const tot = refund * qty;
      totalInput.value = formatMoney(tot);
      recalcPartsTotals();
    }

    qtyInput.addEventListener("input", recalcRow);

    searchBtn.addEventListener("click", async function () {
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
        extInput.value = d.codice_esteso || "";
        descInput.value = d.descrizione || "";
        refundInput.value = d.rimborso_garanzia != null ? formatMoney(d.rimborso_garanzia) : "";
        recalcRow();
      } catch (err) {
        console.error(err);
        alert("Errore ricerca ricambio: " + err.message);
      }
    });

    delBtn.addEventListener("click", function () {
      tr.remove();
      recalcPartsTotals();
    });

    recalcRow();
  }

  if (Array.isArray(gar.parts)) {
    gar.parts.forEach(p => createPartRow(p));
    recalcPartsTotals();
  }

  addPartBtn.addEventListener("click", function () {
    createPartRow(null);
  });

  async function loadLabourRateStdIfNeeded() {
    if (labourRateStd != null) {
      labourRateLabel.textContent = "Tariffa oraria dealer: " + formatMoney(labourRateStd) + " €/h";
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
      labourRateLabel.textContent = "Tariffa oraria dealer: " + formatMoney(labourRateStd) + " €/h";
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
    const snap = await db.collection("FTLabourCodes").where("codice_labour", "==", code).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, data: doc.data() || {} };
  }

  function recalcLabourTotals() {
    let tot = 0;
    const rows = labourBody.querySelectorAll("tr");
    rows.forEach(function (tr) {
      const totalInput = tr.querySelector("td:nth-child(4) input");
      const v = totalInput ? toNumberOrNull(totalInput.value) || 0 : 0;
      tot += v;
    });
    labourTotalSpan.textContent = formatMoney(tot);
  }

  function createLabourRow(initialData) {
    const tr = document.createElement("tr");

    const tdCode = document.createElement("td");
    const codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.style.width = "100px";
    codeInput.value = initialData && initialData.codice_labour ? initialData.codice_labour : "";
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
    descInput.value = initialData && initialData.descrizione_tradotta ? initialData.descrizione_tradotta : "";
    tdDesc.appendChild(descInput);

    const tdQty = document.createElement("td");
    tdQty.style.textAlign = "right";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.step = "0.1";
    qtyInput.style.width = "60px";
    qtyInput.value = initialData && initialData.quantita != null ? String(initialData.quantita) : "1";
    tdQty.appendChild(qtyInput);

    const tdTotal = document.createElement("td");
    tdTotal.style.textAlign = "right";
    const totalInput = document.createElement("input");
    totalInput.type = "number";
    totalInput.style.width = "90px";
    totalInput.step = "0.01";
    totalInput.value = initialData && initialData.totale != null ? formatMoney(initialData.totale) : "0.00";
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

    qtyInput.addEventListener("input", function () { recalcRow(false); });
    totalInput.addEventListener("input", function () {
      if (isCodeOL000()) recalcRow(true);
    });

    searchBtn.addEventListener("click", async function () {
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
        if (d.quantita != null && !initialData) qtyInput.value = String(d.quantita);
        updateFieldModes();
        recalcRow(false);
      } catch (err) {
        console.error(err);
        alert("Errore ricerca labour: " + err.message);
      }
    });

    codeInput.addEventListener("change", function () {
      updateFieldModes();
      recalcRow(false);
    });

    delBtn.addEventListener("click", function () {
      tr.remove();
      recalcLabourTotals();
    });

    updateFieldModes();
    recalcRow(false);
  }

  loadLabourRateStdIfNeeded().then(function () {
    if (Array.isArray(gar.labour)) {
      gar.labour.forEach(l => createLabourRow(l));
      recalcLabourTotals();
    }
  });

  addLabourBtn.addEventListener("click", async function () {
    await loadLabourRateStdIfNeeded();
    createLabourRow(null);
  });

  saveBtn.addEventListener("click", async function () {
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
        symptom: symptomId ? { id: symptomId, label: symptomLabel } : null,
        ccc: cccId ? { id: cccId, text: cccText, order: cccOrder } : null,
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

      if (isRicambio && prevInvDateInput) {
        garanziaData.previousInvoiceDate = prevInvDateInput.value || null;
      }

      const parts = [];
      let partsTotal = 0;
      const partRows = partsBody.querySelectorAll("tr");
      partRows.forEach(function (tr) {
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
      labourRows.forEach(function (tr) {
        const codeInput = tr.querySelector("td:nth-child(1) input");
        const qtyInput = tr.querySelector("td:nth-child(3) input");
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

      const fieldName = isRicambio ? "garanziaRicambio" : "garanzia";
      const updateObj = {};
      updateObj[fieldName] = garanziaData;

      await claimRef.update(updateObj);

      alert(labelSave + " salvati.");
    } catch (err) {
      console.error(err);
      alert("Errore nel salvataggio dati Garanzia: " + err.message);
    }
  });

  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
}

function renderGaranziaDetails(container, claimData, ctx) {
  renderGaranziaDetailsInternal(container, claimData.garanzia || {}, ctx, { isRicambio: false });
}

function renderGaranziaRicambioDetails(container, claimData, ctx) {
  renderGaranziaDetailsInternal(container, claimData.garanziaRicambio || {}, ctx, { isRicambio: true });
}
/* ===============================
   SERVICE CONTRACT (Maintenance)
=============================== */

function renderServiceContractDetails(container, claimData, ctx) {
  if (typeof firebase === "undefined" || !firebase.firestore) {
    const msg = document.createElement("div");
    msg.className = "small-text";
    msg.textContent = "Firebase non disponibile.";
    container.appendChild(msg);
    return;
  }

  const db = firebase.firestore();
  const sc = claimData.serviceContract || {};
  const prefix = "sc_" + ctx.claimCode + "_";

  container.innerHTML = `
    <h4 style="margin: 4px 0 6px; font-size: 13px;">Dati Service Contract</h4>

    <div class="small-text" style="margin-bottom:8px;">
      Seleziona il pacchetto di manutenzione. Le righe (ricambi/manodopera) vengono precompilate dal template in Firestore.
    </div>

    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap;">
      <div class="form-group" style="flex:1; min-width:220px;">
        <label for="${prefix}family">Famiglia</label>
        <select id="${prefix}family"></select>
        <div class="small-text">Esempio: 470 / 510 (derivato dai documenti presenti in Maintenance).</div>
      </div>

      <div class="form-group" style="flex:2; min-width:320px;">
        <label for="${prefix}package">Tipo manutenzione</label>
        <select id="${prefix}package"></select>
        <div class="small-text">Mostra le descrizioni da Maintenance/_meta.menuOptions.</div>
      </div>
    </div>

    <div class="form-group" style="margin-top:6px;">
      <label>
        <input type="checkbox" id="${prefix}voith">
        Veicolo con rallentatore VOITH (Intarder/Retarder)
      </label>
      <div class="small-text">Se attivo, includiamo anche le righe “voithOnly”.</div>
    </div>

    <div class="form-group" style="margin-top:8px;">
      <button type="button" id="${prefix}save" class="btn btn-primary btn-small">Salva manutenzione</button>
    </div>

    <hr>

    <h4 style="margin: 6px 0 6px; font-size: 13px;">Righe precompilate</h4>
    <div class="small-text" id="${prefix}hint">Seleziona un pacchetto per visualizzare righe ricambi e manodopera.</div>

    <div class="form-group" style="margin-top:6px;">
      <strong>Manodopera</strong>
      <div id="${prefix}labourWrap" class="small-text" style="margin-top:4px;"></div>
    </div>

    <div class="form-group" style="margin-top:6px;">
      <strong>Ricambi</strong>
      <div id="${prefix}partsWrap" class="small-text" style="margin-top:4px;"></div>
    </div>
  `;

  const familySel   = container.querySelector("#" + prefix + "family");
  const packageSel  = container.querySelector("#" + prefix + "package");
  const voithChk    = container.querySelector("#" + prefix + "voith");
  const saveBtn     = container.querySelector("#" + prefix + "save");
  const labourWrap  = container.querySelector("#" + prefix + "labourWrap");
  const partsWrap   = container.querySelector("#" + prefix + "partsWrap");
  const hint        = container.querySelector("#" + prefix + "hint");

  const claimRef = db
    .collection("ClaimCards")
    .doc(ctx.claimCardId)
    .collection("Claims")
    .doc(ctx.claimCode);

  function renderTable(items) {
    if (!items || !items.length) return `<div>Nessuna riga.</div>`;

    const rows = items.map(it => `
      <tr>
        <td style="border-bottom:1px solid #eee; padding:4px 6px;">${escapeHtml(it.code || "")}</td>
        <td style="border-bottom:1px solid #eee; padding:4px 6px;">${escapeHtml(it.description || "")}</td>
        <td style="border-bottom:1px solid #eee; padding:4px 6px; text-align:right;">${escapeHtml(it.qty != null ? String(it.qty) : "")}</td>
        <td style="border-bottom:1px solid #eee; padding:4px 6px;">${escapeHtml(it.note || "")}</td>
      </tr>
    `).join("");

    return `
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 6px;">Codice</th>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 6px;">Descrizione</th>
            <th style="text-align:right; border-bottom:1px solid #ddd; padding:4px 6px;">Q.tà</th>
            <th style="text-align:left; border-bottom:1px solid #ddd; padding:4px 6px;">Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  async function loadFamilies() {
    const snap = await db.collection("Maintenance").limit(300).get();
    const famSet = new Set();

    snap.forEach(doc => {
      const id = doc.id || "";
      if (id === "_meta") return;
      const m = id.match(/^(\d+)_/);
      if (m && m[1]) famSet.add(m[1]);
    });

    const fams = Array.from(famSet).sort((a, b) => Number(a) - Number(b));
    return fams.length ? fams : ["470"];
  }

  async function loadMenuOptions() {
    const metaSnap = await db.collection("Maintenance").doc("_meta").get();
    const d = metaSnap.exists ? (metaSnap.data() || {}) : {};
    const menuOptions = Array.isArray(d.menuOptions) ? d.menuOptions : [];
    return menuOptions
      .filter(x => x && x.key)
      .map(x => ({
        key: String(x.key),
        label: (x.label_it && x.label_it.it) ? x.label_it.it : (x.label || x.key)
      }));
  }

  function setSelectOptions(select, options, placeholder) {
    select.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder || "Seleziona...";
    ph.disabled = true;
    ph.selected = true;
    select.appendChild(ph);

    options.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      select.appendChild(opt);
    });
  }

  function currentFamily() {
    return familySel && familySel.value ? familySel.value : null;
  }

  function currentTemplateId() {
    return packageSel && packageSel.value ? packageSel.value : null; // es: 470_1s
  }

  async function loadTemplateAndRender() {
    const templateId = currentTemplateId();
    if (!templateId) {
      labourWrap.innerHTML = "";
      partsWrap.innerHTML = "";
      hint.textContent = "Seleziona un pacchetto per visualizzare righe ricambi e manodopera.";
      return null;
    }

    const voithEnabled = !!voithChk.checked;

    const snap = await db.collection("Maintenance").doc(templateId).get();
    if (!snap.exists) {
      labourWrap.innerHTML = "<div>Template non trovato: " + escapeHtml(templateId) + "</div>";
      partsWrap.innerHTML = "";
      return null;
    }

    const t = snap.data() || {};
    const items = Array.isArray(t.items) ? t.items : [];

    const filtered = items.filter(it => {
      const c = it && it.conditions ? it.conditions : {};
      const voithOnly = toBool(c.voithOnly);
      if (voithOnly && !voithEnabled) return false;
      return true;
    });

    const labour = filtered.filter(it => (it.kind || "").toString().toUpperCase() === "LABOUR");
    const parts  = filtered.filter(it => (it.kind || "").toString().toUpperCase() === "PART");

    hint.textContent = "";

    labourWrap.innerHTML = renderTable(labour);
    partsWrap.innerHTML  = renderTable(parts);

    return {
      templateId,
      family: t.family || (templateId.split("_")[0] || null),
      key: t.key || (templateId.split("_")[1] || null),
      label: t.label || templateId,
      voithEnabled,
      items: filtered
    };
  }

  (async function init() {
    if (sc.voithEnabled != null) voithChk.checked = !!sc.voithEnabled;

    const [fams, menu] = await Promise.all([loadFamilies(), loadMenuOptions()]);

    familySel.innerHTML = "";
    fams.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      familySel.appendChild(opt);
    });

    if (sc.family && fams.includes(String(sc.family))) {
      familySel.value = String(sc.family);
    } else {
      familySel.value = fams[0];
    }

    function repopulatePackageSelect() {
      const fam = currentFamily();
      const opts = menu.map(m => ({
        value: fam + "_" + m.key,
        label: m.label
      }));
      setSelectOptions(packageSel, opts, "-- Seleziona pacchetto --");

      if (sc.templateId && String(sc.templateId).startsWith(fam + "_")) {
        packageSel.value = String(sc.templateId);
      }
    }

    repopulatePackageSelect();

    familySel.addEventListener("change", async function () {
      repopulatePackageSelect();
      await loadTemplateAndRender();
    });

    packageSel.addEventListener("change", loadTemplateAndRender);
    voithChk.addEventListener("change", loadTemplateAndRender);

    await loadTemplateAndRender();
  })();

  saveBtn.addEventListener("click", async function () {
    const templateId = currentTemplateId();
    if (!templateId) {
      alert("Seleziona un tipo manutenzione.");
      return;
    }

    saveBtn.disabled = true;
    try {
      const payload = await loadTemplateAndRender();
      if (!payload) {
        alert("Selezione non valida.");
        return;
      }

      await claimRef.update({
        serviceContract: {
          templateId: payload.templateId,
          family: payload.family || null,
          key: payload.key || null,
          label: payload.label || null,
          voithEnabled: payload.voithEnabled,
          items: payload.items || [],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      });

      alert("Manutenzione salvata.");
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio manutenzione: " + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // PER SERVICE CONTRACT: niente Ticket/Sinistro
  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: true });
}

/* ===============================
   Dati generali + Allegati + Note per claim
=============================== */

function addAttachmentsAndNotesSection(container, ctx, options) {
  options = options || {};
  const hideGeneral = !!options.hideGeneral;

  if (typeof firebase === "undefined" || !firebase.firestore || !firebase.storage) {
    return;
  }

  const db = firebase.firestore();
  const storage = firebase.storage();

  const claimDocRef = db
    .collection("ClaimCards")
    .doc(ctx.claimCardId)
    .collection("Claims")
    .doc(ctx.claimCode);

  // ---------- DATI GENERALI CLAIM (TICKET / SINISTRO) ----------
  if (!hideGeneral) {
    const genPrefix = "gen_" + ctx.claimCode + "_";

    const genSection = document.createElement("div");
    genSection.className = "form-group";
    genSection.innerHTML = `
      <h4 style="margin: 12px 0 4px; font-size: 13px;">Dati generali claim</h4>

      <div class="form-group">
        <label for="${genPrefix}ticket">Ticket</label>
        <input type="text" id="${genPrefix}ticket">
      </div>

      <div class="form-group">
        <label for="${genPrefix}sinistro">Sinistro</label>
        <input type="text" id="${genPrefix}sinistro">
        <div class="small-text">
          Campo modificabile solo dal distributore (dealer FT001).
        </div>
      </div>

      <div class="form-group">
        <button type="button" id="${genPrefix}save" class="btn btn-small btn-primary">
          Salva dati generali
        </button>
      </div>
    `;
    container.appendChild(genSection);

    const ticketInput    = genSection.querySelector("#" + genPrefix + "ticket");
    const sinistroInput  = genSection.querySelector("#" + genPrefix + "sinistro");
    const saveGeneralBtn = genSection.querySelector("#" + genPrefix + "save");

    let isDistributor = false;

    getCurrentUserInfo().then(function (info) {
      if (info && info.dealerId === "FT001") {
        isDistributor = true;
      } else {
        if (sinistroInput) sinistroInput.disabled = true;
      }
    });

    claimDocRef.get().then(function (snap) {
      if (!snap.exists) return;
      const d = snap.data() || {};
      if (ticketInput && d.ticket != null) ticketInput.value = d.ticket;
      if (sinistroInput && d.sinistro != null) sinistroInput.value = d.sinistro;
    }).catch(function () {});

    saveGeneralBtn.addEventListener("click", async function () {
      const ticketVal   = ticketInput ? ticketInput.value.trim() : "";
      const sinistroVal = sinistroInput ? sinistroInput.value.trim() : "";

      const updateData = { ticket: ticketVal || null };
      if (isDistributor) updateData.sinistro = sinistroVal || null;

      try {
        await claimDocRef.update(updateData);
        alert("Dati generali claim salvati.");
      } catch (err) {
        console.error(err);
        alert("Errore nel salvataggio dei dati generali claim: " + err.message);
      }
    });
  }

  // ---------- ALLEGATI ----------
  const attPrefix = "att_" + ctx.claimCode + "_";

  const attSection = document.createElement("div");
  attSection.className = "form-group";
  attSection.innerHTML = `
    <h4 style="margin: 12px 0 4px; font-size: 13px;">Allegati</h4>
    <div class="small-text">Allegati generici relativi a questo claim.</div>
    <div style="margin-top:4px; display:flex; gap:4px; align-items:center;">
      <input type="file" id="${attPrefix}file" multiple>
      <button type="button" id="${attPrefix}uploadBtn" class="btn btn-small btn-secondary">Carica</button>
    </div>
    <div id="${attPrefix}list" class="small-text" style="margin-top:6px;"></div>
  `;
  container.appendChild(attSection);

  const attFileInput = attSection.querySelector("#" + attPrefix + "file");
  const attUploadBtn = attSection.querySelector("#" + attPrefix + "uploadBtn");
  const attListDiv   = attSection.querySelector("#" + attPrefix + "list");

  const attRefBase = db
    .collection("ClaimCards")
    .doc(ctx.claimCardId)
    .collection("Claims")
    .doc(ctx.claimCode)
    .collection("Attachments");

  function renderAttachmentsList(items) {
    if (!items.length) {
      attListDiv.textContent = "Nessun allegato presente.";
      return;
    }
    const ul = document.createElement("ul");
    ul.style.listStyleType = "none";
    ul.style.paddingLeft = "0";

    items.forEach(function (item) {
      const li = document.createElement("li");
      li.style.marginBottom = "4px";

      const link = document.createElement("a");
      link.href = item.url || "#";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = item.name || item.path || "file";

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "Elimina";
      delBtn.className = "btn btn-small btn-danger";
      delBtn.style.marginLeft = "6px";

      delBtn.addEventListener("click", async function () {
        if (!confirm('Vuoi eliminare l\'allegato "' + (item.name || "") + '"?')) return;
        try {
          if (item.path) {
            try { await storage.ref(item.path).delete(); } catch (e) {}
          }
          await attRefBase.doc(item.id).delete();
          loadAttachments();
        } catch (err) {
          console.error(err);
          alert("Errore durante l'eliminazione dell'allegato: " + err.message);
        }
      });

      li.appendChild(link);
      li.appendChild(delBtn);
      ul.appendChild(li);
    });

    attListDiv.innerHTML = "";
    attListDiv.appendChild(ul);
  }

  async function loadAttachments() {
    try {
      const snap = await attRefBase.orderBy("createdAt", "asc").get();
      const items = [];
      snap.forEach(function (doc) {
        const d = doc.data() || {};
        items.push({ id: doc.id, name: d.name || "", path: d.path || "", url: d.url || "" });
      });
      renderAttachmentsList(items);
    } catch (err) {
      console.error(err);
      attListDiv.textContent = "Errore nel caricamento degli allegati.";
    }
  }

  attUploadBtn.addEventListener("click", async function () {
    const files = attFileInput.files;
    if (!files || !files.length) {
      alert("Seleziona almeno un file.");
      return;
    }

    attUploadBtn.disabled = true;
    try {
      const basePath = "ClaimCards/" + ctx.claimCardId + "/Claims/" + ctx.claimCode + "/Attachments/";
      const userInfo = await getCurrentUserInfo();

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const path = basePath + Date.now() + "_" + i + "_" + f.name;
        const ref  = storage.ref(path);
        await ref.put(f);
        const url = await ref.getDownloadURL();

        await attRefBase.add({
          name: f.name,
          path: path,
          url: url,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          authorUid: userInfo.uid || null,
          authorName: userInfo.name || null,
          authorDealerId: userInfo.dealerId || null
        });
      }

      attFileInput.value = "";
      loadAttachments();
    } catch (err) {
      console.error(err);
      alert("Errore nel caricamento degli allegati: " + err.message);
    } finally {
      attUploadBtn.disabled = false;
    }
  });

  loadAttachments();

  // ---------- NOTE ----------
  const notesPrefix = "note_" + ctx.claimCode + "_";

  const notesSection = document.createElement("div");
  notesSection.className = "form-group";
  notesSection.innerHTML = `
    <h4 style="margin: 12px 0 4px; font-size: 13px;">Note</h4>
    <div id="${notesPrefix}list"
         class="small-text"
         style="max-height:150px; overflow-y:auto; border:1px solid #ddd; background:#ffffff; padding:4px;">
      Nessuna nota.
    </div>
    <div style="margin-top:4px; display:flex; gap:4px;">
      <textarea id="${notesPrefix}text" rows="2" style="flex:1;" placeholder="Scrivi una nota..."></textarea>
      <button type="button" id="${notesPrefix}send" class="btn btn-small btn-primary">Invia</button>
    </div>
  `;
  container.appendChild(notesSection);

  const notesListDiv = notesSection.querySelector("#" + notesPrefix + "list");
  const noteTextArea = notesSection.querySelector("#" + notesPrefix + "text");
  const noteSendBtn  = notesSection.querySelector("#" + notesPrefix + "send");

  const notesRef = db
    .collection("ClaimCards")
    .doc(ctx.claimCardId)
    .collection("Claims")
    .doc(ctx.claimCode)
    .collection("Notes");

  function renderNotesSnapshot(snap) {
    if (snap.empty) {
      notesListDiv.textContent = "Nessuna nota.";
      return;
    }
    notesListDiv.innerHTML = "";
    snap.forEach(function (doc) {
      const d = doc.data() || {};
      const line = document.createElement("div");
      line.style.marginBottom = "6px";
      line.style.borderBottom = "1px solid #eee";
      line.style.paddingBottom = "4px";

      const header = document.createElement("div");
      header.style.fontWeight = "bold";

      let author = d.authorName || "";
      if (!author && d.authorDealerId) author = d.authorDealerId;

      let when = "";
      if (d.createdAt && d.createdAt.toDate) {
        const t = d.createdAt.toDate();
        const dd = String(t.getDate()).padStart(2, "0");
        const mm = String(t.getMonth() + 1).padStart(2, "0");
        const yyyy = t.getFullYear();
        const hh = String(t.getHours()).padStart(2, "0");
        const mi = String(t.getMinutes()).padStart(2, "0");
        when = dd + "/" + mm + "/" + yyyy + " " + hh + ":" + mi;
      }

      header.textContent = author ? author + (when ? " (" + when + ")" : "") : (when || "");

      const body = document.createElement("div");
      body.textContent = d.text || "";

      line.appendChild(header);
      line.appendChild(body);
      notesListDiv.appendChild(line);
    });

    notesListDiv.scrollTop = notesListDiv.scrollHeight;
  }

  notesRef.orderBy("createdAt", "asc").onSnapshot(
    function (snap) { renderNotesSnapshot(snap); },
    function (err) { console.error("Errore onSnapshot Note:", err); }
  );

  noteSendBtn.addEventListener("click", async function () {
    const txt = (noteTextArea.value || "").trim();
    if (!txt) return;

    noteSendBtn.disabled = true;
    try {
      const userInfo = await getCurrentUserInfo();
      await notesRef.add({
        text: txt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authorUid: userInfo.uid || null,
        authorName: userInfo.name || null,
        authorDealerId: userInfo.dealerId || null
      });
      noteTextArea.value = "";
    } catch (err) {
      console.error(err);
      alert("Errore nell'invio della nota: " + err.message);
    } finally {
      noteSendBtn.disabled = false;
    }
  });
}

/**
 * Recupero info utente corrente (usato per allegati, note, sinistro)
 */
let _ftclaimsUserInfoPromise = null;

function getCurrentUserInfo() {
  if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
    return Promise.resolve({ uid: null, name: null, dealerId: null });
  }

  if (!_ftclaimsUserInfoPromise) {
    _ftclaimsUserInfoPromise = (async function () {
      const auth = firebase.auth();
      const user = auth.currentUser;
      if (!user) return { uid: null, name: null, dealerId: null };

      const db = firebase.firestore();
      let name = user.displayName || null;
      let dealerId = null;

      try {
        const snap = await db.collection("Users").doc(user.uid).get();
        if (snap.exists) {
          const d = snap.data() || {};
          dealerId = d.dealerId || d.DealerID || d.dealerID || d.dealerID || null;
          if (!name) name = d.fullName || d.name || d.displayName || null;
        }
      } catch (err) {}

      return { uid: user.uid, name: name, dealerId: dealerId };
    })();
  }

  return _ftclaimsUserInfoPromise;
}

