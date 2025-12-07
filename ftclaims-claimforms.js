// ===============================
// ftclaims-claimforms.js
// Dettagli dei singoli claim (RSA, Garanzia, ...)
// ===============================

function normalizeClaimType(ct) {
  return (ct || "").toString().trim().toUpperCase();
}

/**
 * Entry point:
 *   - claimType: "RSA", "Garanzia", ...
 *   - container: div interno alla card della singola riparazione
 *   - claimData: dati Firestore del claim
 *   - ctx: { claimCardId, claimCode }
 */
function renderClaimDetails(claimType, container, claimData, ctx) {
  const type = normalizeClaimType(claimType);

  container.innerHTML = "";

  if (type === "RSA") {
    renderRSADetails(container, claimData, ctx);
  } else if (type) {
    const info = document.createElement("div");
    info.className = "small-text";
    info.textContent =
      "Per la tipologia \"" + type + "\" non sono ancora previsti campi aggiuntivi.";
    container.appendChild(info);
  } else {
    const info = document.createElement("div");
    info.className = "small-text";
    info.textContent = "Tipologia claim non specificata.";
    container.appendChild(info);
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

  // Riferimenti agli elementi
  const dateInput      = container.querySelector("#" + prefix + "date");
  const onlyTowInput   = container.querySelector("#" + prefix + "onlyTow");
  const dayHoursInput  = container.querySelector("#" + prefix + "dayHours");
  const dayMinInput    = container.querySelector("#" + prefix + "dayMinutes");
  const nightHoursInput= container.querySelector("#" + prefix + "nightHours");
  const nightMinInput  = container.querySelector("#" + prefix + "nightMinutes");
  const kmInput        = container.querySelector("#" + prefix + "km");
  const caseInput      = container.querySelector("#" + prefix + "case");
  const towCostsInput  = container.querySelector("#" + prefix + "towCosts");
  const invoicesInput  = container.querySelector("#" + prefix + "invoices");
  const routeInput     = container.querySelector("#" + prefix + "route");
  const saveBtn        = container.querySelector("#" + prefix + "saveBtn");

  // Pre-compilazione dai dati esistenti
  if (rsa.date) dateInput.value = rsa.date;
  if (rsa.onlyTow) onlyTowInput.checked = !!rsa.onlyTow;
  if (rsa.dayShiftHours != null)   dayHoursInput.value = rsa.dayShiftHours;
  if (rsa.dayShiftMinutes != null) dayMinInput.value   = rsa.dayShiftMinutes;
  if (rsa.nightShiftHours != null) nightHoursInput.value = rsa.nightShiftHours;
  if (rsa.nightShiftMinutes != null) nightMinInput.value = rsa.nightShiftMinutes;
  if (rsa.km != null) kmInput.value = rsa.km;
  if (rsa.caseNumber) caseInput.value = rsa.caseNumber;
  if (rsa.towCostsAmount != null) towCostsInput.value = rsa.towCostsAmount;

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

    // Non solo traino
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

  // Stato iniziale
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

      // Upload allegati (aggiunti a quelli già presenti)
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
        invoiceMeta.push({ name: f.name, path, url });
      }

      const routeFiles = routeInput.files || [];
      for (let i = 0; i < routeFiles.length; i++) {
        const f = routeFiles[i];
        const path = basePath + "Tragitto/" + Date.now() + "_" + f.name;
        const ref  = storage.ref(path);
        await ref.put(f);
        const url = await ref.getDownloadURL();
        routeMeta.push({ name: f.name, path, url });
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

        // reset solo i file (i dati restano)
        invoicesInput.value = "";
        routeInput.value = "";

        alert("Dati RSA salvati.");
      } catch (err) {
        console.error(err);
        alert("Errore nel salvataggio dati RSA: " + err.message);
      }
    });
  }
}
