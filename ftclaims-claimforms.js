// ===============================
// ftclaims-claimforms.js
// Gestione UI e salvataggio dei singoli CLAIM
// (RSA, Garanzia, Garanzia Ricambio, ecc.)
// ===============================

(function () {
  // ==========================
  // Utility comuni
  // ==========================

  function getDb() {
    if (!firebase || !firebase.firestore) {
      console.error('[ftclaims-claimforms] Firestore non disponibile');
      return null;
    }
    return firebase.firestore();
  }

  function getStorage() {
    if (!firebase || !firebase.storage) {
      console.error('[ftclaims-claimforms] Storage non disponibile');
      return null;
    }
    return firebase.storage();
  }

  function toNumberOrNull(v) {
    if (v === null || v === undefined) return null;
    const s = v.toString().trim();
    if (s === '') return null;
    const n = Number(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function formatEuro(v) {
    const n = Number(v || 0);
    return n.toFixed(2) + ' €';
  }

  // --------------------------
  // Festività italiane "standard"
  // (solo per blocco DAYSHIFT RSA)
  // --------------------------
  const IT_HOLIDAYS = [
    '01-01', // Capodanno
    '01-06', // Epifania
    '04-25', // Liberazione
    '05-01', // Lavoro
    '06-02', // Repubblica
    '08-15', // Ferragosto
    '11-01', // Ognissanti
    '12-08', // Immacolata
    '12-25', // Natale
    '12-26'  // S. Stefano
  ];

  function isItalianHoliday(dateStr) {
    // dateStr nel formato YYYY-MM-DD
    if (!dateStr || dateStr.length !== 10) return false;
    const mmdd = dateStr.substring(5); // "MM-DD"
    return IT_HOLIDAYS.indexOf(mmdd) !== -1;
  }

  function isWeekend(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Dom, 6=Sab
    return day === 0 || day === 6;
  }

  // ==========================
  // Entry Point: renderClaimDetails
  // ==========================

  /**
   * Disegna il contenuto di un claim all'interno di container,
   * in base alla tipologia:
   *  - "RSA"
   *  - "Garanzia"
   *  - "Garanzia Ricambio"
   */
  window.renderClaimDetails = function renderClaimDetails(claimType, container, claimData, ctx) {
    if (!container) return;
    const db = getDb();
    if (!db) return;

    const type = (claimType || claimData.type || '').toString().trim();
    const normType = type.toUpperCase();
    const claimCardId = ctx && ctx.claimCardId;
    const claimCode   = ctx && ctx.claimCode;

    if (!claimCardId || !claimCode) {
      console.error('[ftclaims-claimforms] renderClaimDetails: ctx mancante o incompleto', ctx);
      return;
    }

    const claimRef = db
      .collection('ClaimCards')
      .doc(claimCardId)
      .collection('Claims')
      .doc(claimCode);

    console.log('[ftclaims-claimforms] renderClaimDetails:', {
      type,
      normType,
      claimCardId,
      claimCode
    });

    if (normType === 'RSA') {
      renderRsaClaimSection(container, claimRef, claimData, claimCode);
    } else if (normType === 'GARANZIA' || normType === 'GARANZIA RICAMBIO') {
      const isReplacementWarranty = (normType === 'GARANZIA RICAMBIO');
      renderWarrantyClaimSection(container, claimRef, claimData, claimCode, isReplacementWarranty, claimCardId);
    } else {
      const info = document.createElement('div');
      info.className = 'small-text';
      info.textContent = 'Per questa tipologia di claim non sono ancora previsti campi aggiuntivi.';
      container.appendChild(info);
    }
  };

  // ==========================
  // 1) CLAIM RSA
  // ==========================

  function renderRsaClaimSection(container, claimRef, claimData, claimCode) {
    const rsaData = (claimData && claimData.rsa) || {};

    const card = document.createElement('div');
    card.className = 'card';
    card.style.marginTop = '8px';

    card.innerHTML = `
      <h3>Claim RSA</h3>

      <div class="form-row">
        <div class="form-group">
          <label for="rsa_date_${claimCode}">Data RSA</label>
          <input type="date" id="rsa_date_${claimCode}">
          <div class="small-text">
            Se la data è sabato, domenica o festività nazionale, i campi DAYSHIFT non saranno compilabili.
          </div>
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <div>
            <label style="font-size:12px;">
              <input type="checkbox" id="rsa_onlytow_${claimCode}">
              Solo traino
            </label>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>Turni di lavoro</label>
        <div class="shift-box">
          <span class="shift-label">DAYSHIFT</span>
          <input type="number" min="0" max="99" step="1"
                 id="rsa_day_h_${claimCode}"
                 class="time-input">
          <span class="time-separator">:</span>
          <input type="number" min="0" max="59" step="1"
                 id="rsa_day_m_${claimCode}"
                 class="time-input">
        </div>
        <div class="shift-box">
          <span class="shift-label">NIGHTSHIFT</span>
          <input type="number" min="0" max="99" step="1"
                 id="rsa_night_h_${claimCode}"
                 class="time-input">
          <span class="time-separator">:</span>
          <input type="number" min="0" max="59" step="1"
                 id="rsa_night_m_${claimCode}"
                 class="time-input">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="rsa_km_${claimCode}">Percorrenza (Km)</label>
          <input type="number" min="0" step="1" id="rsa_km_${claimCode}">
        </div>
        <div class="form-group">
          <label for="rsa_case_${claimCode}">Caso RSA n.</label>
          <input type="text" id="rsa_case_${claimCode}" maxlength="7" placeholder="Max 7 caratteri">
        </div>
      </div>

      <div class="form-group">
        <label for="rsa_towcost_${claimCode}">Traino, costi correlati (€)</label>
        <input type="number" min="0" step="0.01" id="rsa_towcost_${claimCode}">
      </div>

      <div style="margin-top:10px; text-align:right;">
        <button type="button" class="btn btn-primary btn-small" id="rsa_save_${claimCode}">
          Salva dati RSA
        </button>
      </div>
    `;

    container.appendChild(card);

    // Riferimenti input
    const dateInput   = document.getElementById('rsa_date_' + claimCode);
    const chkOnlyTow  = document.getElementById('rsa_onlytow_' + claimCode);
    const dayH        = document.getElementById('rsa_day_h_' + claimCode);
    const dayM        = document.getElementById('rsa_day_m_' + claimCode);
    const nightH      = document.getElementById('rsa_night_h_' + claimCode);
    const nightM      = document.getElementById('rsa_night_m_' + claimCode);
    const kmInput     = document.getElementById('rsa_km_' + claimCode);
    const caseInput   = document.getElementById('rsa_case_' + claimCode);
    const towCost     = document.getElementById('rsa_towcost_' + claimCode);
    const btnSave     = document.getElementById('rsa_save_' + claimCode);

    if (!dateInput || !chkOnlyTow || !dayH || !dayM || !nightH || !nightM || !kmInput || !caseInput || !towCost || !btnSave) {
      console.warn('[ftclaims-claimforms] Elementi RSA mancanti per claim', claimCode);
      return;
    }

    // Prefill da claimData.rsa
    if (rsaData.date)        dateInput.value  = rsaData.date;
    if (rsaData.onlyTow)     chkOnlyTow.checked = !!rsaData.onlyTow;
    if (rsaData.dayHours != null)   dayH.value   = rsaData.dayHours;
    if (rsaData.dayMinutes != null) dayM.value   = rsaData.dayMinutes;
    if (rsaData.nightHours != null) nightH.value = rsaData.nightHours;
    if (rsaData.nightMinutes != null) nightM.value = rsaData.nightMinutes;
    if (rsaData.km != null)  kmInput.value      = rsaData.km;
    if (rsaData.caseNumber)  caseInput.value    = rsaData.caseNumber;
    if (rsaData.towCost != null) towCost.value  = rsaData.towCost;

    // Funzione per abilitare/disabilitare DAYSHIFT in base alla data
    function updateDayShiftEnabled() {
      const val = dateInput.value;
      const disabled = isWeekend(val) || isItalianHoliday(val);
      dayH.disabled = disabled;
      dayM.disabled = disabled;
      if (disabled) {
        dayH.value = '';
        dayM.value = '';
      }
    }

    // Funzione per "Solo traino"
    function updateOnlyTowEnabled() {
      const onlyTow = chkOnlyTow.checked;

      // se solo traino => disabilito tutti i campi tranne caso e costi
      dayH.disabled    = onlyTow || dayH.disabled;
      dayM.disabled    = onlyTow || dayM.disabled;
      nightH.disabled  = onlyTow;
      nightM.disabled  = onlyTow;
      kmInput.disabled = onlyTow;

      if (onlyTow) {
        dayH.value = '';
        dayM.value = '';
        nightH.value = '';
        nightM.value = '';
        kmInput.value = '';
      } else {
        updateDayShiftEnabled();
      }
    }

    // Listener (protetti)
    dateInput.addEventListener('change', updateDayShiftEnabled);
    chkOnlyTow.addEventListener('change', updateOnlyTowEnabled);

    // Init stato
    updateDayShiftEnabled();
    updateOnlyTowEnabled();

    // Salvataggio
    btnSave.addEventListener('click', async () => {
      try {
        const newRsa = {
          date: dateInput.value || null,
          onlyTow: !!chkOnlyTow.checked,
          dayHours: toNumberOrNull(dayH.value),
          dayMinutes: toNumberOrNull(dayM.value),
          nightHours: toNumberOrNull(nightH.value),
          nightMinutes: toNumberOrNull(nightM.value),
          km: toNumberOrNull(kmInput.value),
          caseNumber: (caseInput.value || '').trim() || null,
          towCost: toNumberOrNull(towCost.value)
        };

        await claimRef.update({ rsa: newRsa });
        alert('Dati RSA salvati.');
      } catch (err) {
        console.error('[ftclaims-claimforms] Errore salvataggio RSA:', err);
        alert('Errore nel salvataggio RSA: ' + err.message);
      }
    });
  }

  // ==========================
  // 2) CLAIM GARANZIA / GARANZIA RICAMBIO
  // ==========================

  async function getLaborRateStdForClaimCard(claimCardId) {
    const db = getDb();
    if (!db) return 0;
    try {
      const cardSnap = await db.collection('ClaimCards').doc(claimCardId).get();
      if (!cardSnap.exists) return 0;
      const cardData = cardSnap.data() || {};
      const dealerId =
        cardData.openDealer ||
        cardData.dealerId ||
        cardData.DealerID ||
        cardData.DealerId ||
        null;

      if (!dealerId) return 0;

      const dealerSnap = await db.collection('dealers').doc(dealerId).get();
      if (!dealerSnap.exists) return 0;

      const d = dealerSnap.data() || {};
      const rate =
        d.LaborRateStd ||
        d.laborRateStd ||
        d.labor_rate_std ||
        0;

      return Number(rate) || 0;
    } catch (e) {
      console.error('[ftclaims-claimforms] getLaborRateStdForClaimCard errore:', e);
      return 0;
    }
  }

  function normalizeLabourCode(code) {
    if (!code) return '';
    return code.toString().replace(/\s+/g, '').toUpperCase();
  }

  function isQuantityEditableLabour(code) {
    const n = normalizeLabourCode(code);
    return n === '96000000' || n === '94000000';
  }

  function isTotalEditableLabour(code) {
    const n = normalizeLabourCode(code);
    return n === 'OL000';
  }

  function renderWarrantyClaimSection(container, claimRef, claimData, claimCode, isReplacementWarranty, claimCardId) {
    const db = getDb();
    if (!db) return;

    const warranty = (claimData && claimData.warranty) || {};
    const partsModel  = Array.isArray(warranty.parts)  ? warranty.parts.slice()  : [];
    const labourModel = Array.isArray(warranty.labour) ? warranty.labour.slice() : [];

    let laborRateStd = 0;

    // Card principale
    const section = document.createElement('div');
    section.className = 'card claim-detail-card';
    section.style.marginTop = '8px';

    section.innerHTML = `
      <h3>Claim Garanzia${isReplacementWarranty ? ' (Ricambio)' : ''}</h3>

      <div class="form-row">
        <div class="form-group">
          <label>Symptom</label>
          <select id="gar_symptom_${claimCode}">
            <option value="">Seleziona...</option>
          </select>
        </div>
        <div class="form-group">
          <label>CCC Codes</label>
          <select id="gar_ccc_${claimCode}">
            <option value="">Seleziona...</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Componente causa (codice ricambio)</label>
          <div style="display:flex; gap:4px;">
            <input type="text" id="gar_causa_code_${claimCode}" placeholder="Codice ricambio">
            <button type="button" class="btn btn-secondary btn-small" id="gar_causa_search_${claimCode}">Cerca</button>
          </div>
          <div class="small-text">
            La ricerca avviene nel DB FTPartsCodes sul campo codice.
          </div>
        </div>
        <div class="form-group">
          <label>Descrizione componente</label>
          <input type="text" id="gar_causa_descr_${claimCode}" readonly>
        </div>
      </div>

      <div class="form-group">
        <label>Commento tecnico</label>
        <textarea id="gar_commento_${claimCode}" rows="3"></textarea>
      </div>

      <!-- RICAMBI -->
      <h4>Ricambi</h4>
      <div class="small-text">Ricambi selezionati dal DB FTPartsCodes.</div>

      <div class="form-row">
        <div class="form-group">
          <label>Codice</label>
          <div style="display:flex; gap:4px;">
            <input type="text" id="gar_part_code_${claimCode}">
            <button type="button" class="btn btn-secondary btn-small" id="gar_part_search_${claimCode}">Cerca</button>
          </div>
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button type="button" class="btn btn-primary btn-small" id="gar_part_add_${claimCode}">Aggiungi ricambio</button>
        </div>
      </div>

      <table class="simple-table" style="margin-top:6px;">
        <thead>
          <tr>
            <th style="width:130px;">Codice</th>
            <th style="width:180px;">Codice esteso</th>
            <th>Descrizione</th>
            <th style="width:110px;">Rimborso garanzia (€/unità)</th>
            <th style="width:80px;">Quantità</th>
            <th style="width:110px;">Totale</th>
            <th style="width:80px;">Azioni</th>
          </tr>
        </thead>
        <tbody id="gar_parts_body_${claimCode}"></tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="text-align:right; font-weight:bold;">Totale ricambi:</td>
            <td id="gar_parts_total_${claimCode}">0.00 €</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- MANODOPERA -->
      <h4 style="margin-top:14px;">Manodopera</h4>
      <div class="small-text">La tariffa oraria viene letta dal dealer (LaborRateStd).</div>

      <div class="form-row">
        <div class="form-group">
          <label>Codice labour</label>
          <div style="display:flex; gap:4px;">
            <input type="text" id="gar_labour_code_${claimCode}">
            <button type="button" class="btn btn-secondary btn-small" id="gar_labour_search_${claimCode}">Cerca</button>
          </div>
        </div>
        <div class="form-group">
          <label>&nbsp;</label>
          <button type="button" class="btn btn-primary btn-small" id="gar_labour_add_${claimCode}">Aggiungi manodopera</button>
        </div>
      </div>

      <table class="simple-table" style="margin-top:6px;">
        <thead>
          <tr>
            <th style="width:130px;">Codice</th>
            <th>Descrizione</th>
            <th style="width:80px;">Quantità</th>
            <th style="width:110px;">Totale</th>
            <th style="width:80px;">Azioni</th>
          </tr>
        </thead>
        <tbody id="gar_labour_body_${claimCode}"></tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align:right; font-weight:bold;">Totale manodopera:</td>
            <td id="gar_labour_total_${claimCode}">0.00 €</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:10px; text-align:right;">
        <button type="button" class="btn btn-primary btn-small" id="gar_save_${claimCode}">
          Salva dati Garanzia
        </button>
      </div>
    `;

    container.appendChild(section);

    // --- Fattura riparazione precedente solo per Garanzia Ricambio ---
    if (isReplacementWarranty) {
      const fatturaBox = document.createElement('div');
      fatturaBox.className = 'card claim-detail-card';
      fatturaBox.style.marginTop = '8px';

      fatturaBox.innerHTML = `
        <h4>Fattura riparazione precedente (obbligatoria)</h4>
        <div class="small-text">
          Carica almeno un file (png, jpeg, xlsx, xls, doc, docx, pdf, rar, zip, mp4, mp3).
        </div>
        <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
          <input type="file" id="prev_invoice_file_${claimCode}">
          <button type="button" class="btn btn-primary btn-small" id="prev_invoice_upload_${claimCode}">
            Carica fattura
          </button>
        </div>
        <div id="prev_invoice_list_${claimCode}" class="attachments-list small-text" style="margin-top:6px;">
          Nessuna fattura caricata per questo claim.
        </div>
      `;
      container.appendChild(fatturaBox);

      setupPrevInvoiceHandlers(claimRef, claimCode);
    }

    // Riferimenti elementi
    const selSymptom    = document.getElementById('gar_symptom_' + claimCode);
    const selCcc        = document.getElementById('gar_ccc_' + claimCode);
    const causaCode     = document.getElementById('gar_causa_code_' + claimCode);
    const causaDescr    = document.getElementById('gar_causa_descr_' + claimCode);
    const btnCausaSearch= document.getElementById('gar_causa_search_' + claimCode);
    const commento      = document.getElementById('gar_commento_' + claimCode);

    const partCodeInput = document.getElementById('gar_part_code_' + claimCode);
    const btnPartSearch = document.getElementById('gar_part_search_' + claimCode);
    const btnPartAdd    = document.getElementById('gar_part_add_' + claimCode);
    const partsBody     = document.getElementById('gar_parts_body_' + claimCode);
    const partsTotalEl  = document.getElementById('gar_parts_total_' + claimCode);

    const labourCodeInput = document.getElementById('gar_labour_code_' + claimCode);
    const btnLabourSearch = document.getElementById('gar_labour_search_' + claimCode);
    const btnLabourAdd    = document.getElementById('gar_labour_add_' + claimCode);
    const labourBody      = document.getElementById('gar_labour_body_' + claimCode);
    const labourTotalEl   = document.getElementById('gar_labour_total_' + claimCode);

    const btnSave         = document.getElementById('gar_save_' + claimCode);

    if (!selSymptom || !selCcc || !causaCode || !causaDescr || !btnCausaSearch ||
        !commento || !partCodeInput || !btnPartSearch || !btnPartAdd ||
        !partsBody || !partsTotalEl || !labourCodeInput || !btnLabourSearch ||
        !btnLabourAdd || !labourBody || !labourTotalEl || !btnSave) {
      console.warn('[ftclaims-claimforms] Elementi Garanzia mancanti per claim', claimCode);
      return;
    }

    // Prefill campo commento / componente causa
    if (warranty.comment) commento.value = warranty.comment;
    if (warranty.causePartCode)  causaCode.value  = warranty.causePartCode;
    if (warranty.causePartDescr) causaDescr.value = warranty.causePartDescr;

    // =======================
    // Symptom + CCC codes
    // =======================

    async function loadSymptomsAndSelect() {
      if (!selSymptom || !selCcc) return;
      try {
        const snap = await db.collection('Symptom').get();
        const savedSymptomId = warranty.symptomId || null;
        selSymptom.innerHTML = '<option value="">Seleziona...</option>';

        snap.forEach(doc => {
          const d = doc.data() || {};
          const opt = document.createElement('option');
          opt.value = doc.id;
          const label =
            (d.SymptomCode || d.code || doc.id) +
            ' - ' +
            (d.SymptomDescriptionItalian || d.description || d.Descrizione || '');
          opt.textContent = label.trim();
          selSymptom.appendChild(opt);
        });

        if (savedSymptomId) {
          selSymptom.value = savedSymptomId;
          await loadCccForSymptom(savedSymptomId, warranty.cccId || null);
        } else {
          selCcc.innerHTML = '<option value="">Seleziona...</option>';
        }
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore caricamento Symptom:', e);
      }
    }

    async function loadCccForSymptom(symptomId, preselectCccId) {
      if (!selCcc) return;
      selCcc.innerHTML = '<option value="">Seleziona...</option>';
      if (!symptomId) return;
      try {
        const snap = await db
          .collection('Symptom')
          .doc(symptomId)
          .collection('CCC_Codes')
          .get();

        snap.forEach(doc => {
          const d = doc.data() || {};
          const opt = document.createElement('option');
          opt.value = doc.id;
          const label =
            (d.CCC_Code || d.code || doc.id) +
            ' - ' +
            (d.DescriptionItalian || d.description || d.Descrizione || '');
          opt.textContent = label.trim();
          selCcc.appendChild(opt);
        });

        if (preselectCccId) {
          selCcc.value = preselectCccId;
        }
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore caricamento CCC_Codes:', e);
      }
    }

    if (selSymptom) {
      selSymptom.addEventListener('change', () => {
        const symptomId = selSymptom.value || null;
        loadCccForSymptom(symptomId, null);
      });
    }

    // =======================
    // Componente causa (FTPartsCodes)
    // =======================
    async function searchCauseComponent() {
      const code = (causaCode.value || '').trim();
      if (!code) {
        alert('Inserisci un codice ricambio da cercare.');
        return;
      }

      try {
        const snap = await db
          .collection('FTPartsCodes')
          .where('codice', '==', code)
          .limit(1)
          .get();

        if (snap.empty) {
          alert('Nessun ricambio trovato per il codice inserito.');
          causaDescr.value = '';
          return;
        }

        const doc = snap.docs[0];
        const d = doc.data() || {};

        const descr =
          d.descrizione ||
          d.Descrizione ||
          d.description ||
          '';

        causaDescr.value = descr;
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore ricerca componente causa:', e);
        alert('Errore durante la ricerca del ricambio: ' + e.message);
      }
    }

    if (btnCausaSearch) {
      btnCausaSearch.addEventListener('click', searchCauseComponent);
    }

    // =======================
    // Ricambi
    // =======================

    function rebuildPartsTable() {
      if (!partsBody || !partsTotalEl) return;

      partsBody.innerHTML = '';
      let total = 0;

      partsModel.forEach((p, index) => {
        const tr = document.createElement('tr');

        const tdCode = document.createElement('td');
        tdCode.textContent = p.code || '';

        const tdExt = document.createElement('td');
        tdExt.textContent = p.extendedCode || '';

        const tdDesc = document.createElement('td');
        tdDesc.textContent = p.description || '';

        const tdRefund = document.createElement('td');
        tdRefund.textContent = formatEuro(p.refund || 0);

        const tdQty = document.createElement('td');
        const inputQty = document.createElement('input');
        inputQty.type = 'number';
        inputQty.min = '0';
        inputQty.step = '1';
        inputQty.value = p.quantity != null ? p.quantity : 1;
        inputQty.style.width = '60px';
        inputQty.addEventListener('change', () => {
          p.quantity = Number(inputQty.value) || 0;
          p.total = (p.refund || 0) * p.quantity;
          rebuildPartsTable();
        });
        tdQty.appendChild(inputQty);

        const tdTotal = document.createElement('td');
        tdTotal.textContent = formatEuro(p.total || 0);

        const tdActions = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn btn-danger btn-small';
        btnDel.textContent = 'Elimina';
        btnDel.addEventListener('click', () => {
          partsModel.splice(index, 1);
          rebuildPartsTable();
        });
        tdActions.appendChild(btnDel);

        tr.appendChild(tdCode);
        tr.appendChild(tdExt);
        tr.appendChild(tdDesc);
        tr.appendChild(tdRefund);
        tr.appendChild(tdQty);
        tr.appendChild(tdTotal);
        tr.appendChild(tdActions);

        partsBody.appendChild(tr);

        total += p.total || 0;
      });

      partsTotalEl.textContent = formatEuro(total);
    }

    async function searchPartAndAdd() {
      const code = (partCodeInput.value || '').trim();
      if (!code) {
        alert('Inserisci un codice ricambio da cercare.');
        return;
      }

      try {
        const snap = await db
          .collection('FTPartsCodes')
          .where('codice', '==', code)
          .limit(1)
          .get();

        if (snap.empty) {
          alert('Nessun ricambio trovato per il codice inserito.');
          return;
        }

        const doc = snap.docs[0];
        const d = doc.data() || {};

        const part = {
          code: d.codice || d.code || doc.id,
          extendedCode: d.codice_esteso || d.CodiceEsteso || d.extendedCode || '',
          description: d.descrizione || d.Descrizione || d.description || '',
          refund: Number(d.rimborso_garanzia || d.RimborsoGaranzia || d.warrantyRefund || 0),
          quantity: 1
        };
        part.total = part.refund * part.quantity;
        partsModel.push(part);
        rebuildPartsTable();
        partCodeInput.value = '';
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore ricerca ricambio:', e);
        alert('Errore durante la ricerca del ricambio: ' + e.message);
      }
    }

    if (btnPartSearch) btnPartSearch.addEventListener('click', searchPartAndAdd);
    if (btnPartAdd)    btnPartAdd.addEventListener('click', searchPartAndAdd);

    // Ricostruzione iniziale ricambi da Firestore
    rebuildPartsTable();

    // =======================
    // Manodopera
    // =======================

    function rebuildLabourTable() {
      if (!labourBody || !labourTotalEl) return;

      labourBody.innerHTML = '';
      let total = 0;

      labourModel.forEach((l, index) => {
        const tr = document.createElement('tr');

        const tdCode = document.createElement('td');
        tdCode.textContent = l.code || '';

        const tdDesc = document.createElement('td');
        tdDesc.textContent = l.description || '';

        const tdQty = document.createElement('td');
        const inputQty = document.createElement('input');
        inputQty.type = 'number';
        inputQty.step = '0.1';
        inputQty.min = '0';
        inputQty.value = l.quantity != null ? l.quantity : 0;
        inputQty.style.width = '60px';

        const editableQty = isQuantityEditableLabour(l.code);
        const editableTotal = isTotalEditableLabour(l.code);

        inputQty.disabled = !editableQty && !editableTotal; // se OL000, la qty NON è modificabile

        inputQty.addEventListener('change', () => {
          l.quantity = Number(inputQty.value) || 0;
          if (!editableTotal) {
            l.total = (l.quantity || 0) * (laborRateStd || 0);
          }
          rebuildLabourTable();
        });

        tdQty.appendChild(inputQty);

        const tdTotal = document.createElement('td');
        const inputTotal = document.createElement('input');
        inputTotal.type = 'number';
        inputTotal.step = '0.01';
        inputTotal.min = '0';
        inputTotal.value = l.total != null ? l.total : 0;
        inputTotal.style.width = '80px';

        inputTotal.disabled = !editableTotal; // solo OL000 modificabile sul totale

        inputTotal.addEventListener('change', () => {
          l.total = Number(inputTotal.value) || 0;
          if (editableTotal) {
            // Per OL000: ricalcolo quantità = totale / laborRate
            if (laborRateStd > 0) {
              l.quantity = l.total / laborRateStd;
              inputQty.value = l.quantity.toFixed(2);
            } else {
              l.quantity = 0;
              inputQty.value = '0';
            }
          }
          rebuildLabourTable();
        });

        tdTotal.appendChild(inputTotal);

        const tdActions = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn btn-danger btn-small';
        btnDel.textContent = 'Elimina';
        btnDel.addEventListener('click', () => {
          labourModel.splice(index, 1);
          rebuildLabourTable();
        });
        tdActions.appendChild(btnDel);

        tr.appendChild(tdCode);
        tr.appendChild(tdDesc);
        tr.appendChild(tdQty);
        tr.appendChild(tdTotal);
        tr.appendChild(tdActions);

        labourBody.appendChild(tr);

        total += l.total || 0;
      });

      labourTotalEl.textContent = formatEuro(total);
    }

    async function searchLabourAndAdd() {
      const code = (labourCodeInput.value || '').trim();
      if (!code) {
        alert('Inserisci un codice manodopera da cercare.');
        return;
      }

      try {
        const snap = await db
          .collection('FTLabourCodes')
          .where('codice_labour', '==', code)
          .limit(1)
          .get();

        if (snap.empty) {
          alert('Nessuna manodopera trovata per il codice inserito.');
          return;
        }

        const doc = snap.docs[0];
        const d = doc.data() || {};

        const labour = {
          code: d.codice_labour || d.code || doc.id,
          description: d.descrizione_tradotta || d.description || d.Descrizione || '',
          quantity: Number(d.quantita_standard || d.standard_qty || 0),
          total: 0
        };

        // default: totale = qty * laborRateStd (se già conosciuto)
        if (laborRateStd > 0) {
          labour.total = (labour.quantity || 0) * laborRateStd;
        }

        labourModel.push(labour);
        rebuildLabourTable();
        labourCodeInput.value = '';
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore ricerca manodopera:', e);
        alert('Errore durante la ricerca della manodopera: ' + e.message);
      }
    }

    if (btnLabourSearch) btnLabourSearch.addEventListener('click', searchLabourAndAdd);
    if (btnLabourAdd)    btnLabourAdd.addEventListener('click', searchLabourAndAdd);

    // Ricostruzione iniziale manodopera da Firestore
    rebuildLabourTable();

    // =======================
    // Carico Symptom / CCC iniziali
    // =======================
    loadSymptomsAndSelect();

    // =======================
    // Tariffa oraria dealer
    // =======================
    if (claimCardId) {
      getLaborRateStdForClaimCard(claimCardId).then(rate => {
        laborRateStd = rate || 0;
        console.log('[ftclaims-claimforms] LaborRateStd per claim', claimCardId, '=', laborRateStd);
        rebuildLabourTable();
      });
    }

    // =======================
    // Salvataggio completo
    // =======================
    btnSave.addEventListener('click', async () => {
      try {
        // Se Garanzia Ricambio: controllo fattura precedente
        if (isReplacementWarranty) {
          const hasInvoice = await checkPrevInvoiceExists(claimRef);
          if (!hasInvoice) {
            alert('Per un claim di tipo "Garanzia Ricambio" è obbligatorio allegare almeno una "Fattura riparazione precedente".');
            return;
          }
        }

        const selectedSymptomId = selSymptom.value || null;
        const selectedCccId     = selCcc.value || null;

        const newWarranty = {
          symptomId: selectedSymptomId,
          cccId: selectedCccId,
          causePartCode: (causaCode.value || '').trim() || null,
          causePartDescr: (causaDescr.value || '').trim() || null,
          comment: (commento.value || '').trim() || null,
          parts: partsModel,
          labour: labourModel
        };

        await claimRef.update({ warranty: newWarranty });
        alert('Dati garanzia salvati.');
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore salvataggio garanzia:', e);
        alert('Errore nel salvataggio dati garanzia: ' + e.message);
      }
    });
  }

  // ==========================
  // 3) Fattura riparazione precedente (Garanzia Ricambio)
  // ==========================

  async function loadPrevInvoiceList(claimRef, claimCode) {
    const listEl = document.getElementById('prev_invoice_list_' + claimCode);
    if (!listEl) return;

    listEl.textContent = 'Caricamento fatture...';

    try {
      const snap = await claimRef.collection('Attachments')
        .orderBy('uploadedAt', 'asc')
        .get();

      const invoices = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        if (d.category === 'prevRepairInvoice') {
          invoices.push({ id: doc.id, ...d });
        }
      });

      if (!invoices.length) {
        listEl.textContent = 'Nessuna fattura caricata per questo claim.';
        return;
      }

      listEl.innerHTML = '';
      invoices.forEach(att => {
        const row = document.createElement('div');
        row.className = 'attachment-row';
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '2px';

        const left = document.createElement('span');
        left.textContent = att.name || '(senza nome)';

        const right = document.createElement('span');

        const link = document.createElement('a');
        link.href = att.url;
        link.target = '_blank';
        link.textContent = 'Scarica';

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn btn-danger btn-small';
        btnDel.style.marginLeft = '6px';
        btnDel.textContent = 'Elimina';
        btnDel.addEventListener('click', async () => {
          if (!confirm('Vuoi eliminare questa fattura?')) return;
          try {
            const storage = getStorage();
            if (storage && att.path) {
              await storage.ref(att.path).delete().catch(() => {});
            }
            await claimRef.collection('Attachments').doc(att.id).delete();
            await loadPrevInvoiceList(claimRef, claimCode);
          } catch (err) {
            console.error('[ftclaims-claimforms] Errore eliminazione fattura:', err);
            alert('Errore durante l\'eliminazione della fattura: ' + err.message);
          }
        });

        right.appendChild(link);
        right.appendChild(btnDel);

        row.appendChild(left);
        row.appendChild(right);
        listEl.appendChild(row);
      });

    } catch (err) {
      console.error('[ftclaims-claimforms] Errore loadPrevInvoiceList:', err);
      listEl.textContent = 'Errore nel caricamento delle fatture: ' + err.message;
    }
  }

  function setupPrevInvoiceHandlers(claimRef, claimCode) {
    const input = document.getElementById('prev_invoice_file_' + claimCode);
    const btn   = document.getElementById('prev_invoice_upload_' + claimCode);

    if (!input || !btn) {
      console.warn('[ftclaims-claimforms] Controlli fattura precedente non trovati per claim', claimCode);
      return;
    }

    loadPrevInvoiceList(claimRef, claimCode);

    btn.addEventListener('click', async () => {
      const files = input.files;
      if (!files || !files.length) {
        alert('Seleziona un file da caricare come fattura precedente.');
        return;
      }

      const file = files[0]; // uno per volta
      try {
        await uploadPrevInvoice(claimRef, claimCode, file);
        input.value = '';
        await loadPrevInvoiceList(claimRef, claimCode);
      } catch (e) {
        console.error('[ftclaims-claimforms] Errore upload fattura:', e);
        alert('Errore nel caricamento della fattura: ' + e.message);
      }
    });
  }

  async function uploadPrevInvoice(claimRef, claimCode, file) {
    const storage = getStorage();
    const db = getDb();
    if (!storage || !db) throw new Error('Storage/Firestore non disponibili');

    const claimPath = claimRef.path; // "ClaimCards/<id>/Claims/<code>"
    const segments = claimPath.split('/');
    const claimCardId = segments[1]; // ClaimCards/<id>
    const basePath = 'ClaimCards/' + claimCardId + '/Claims/' + claimCode + '/Attachments/';

    const safeName = Date.now() + '_' + file.name.replace(/[^\w.\-]/g, '_');
    const fullPath = basePath + safeName;
    const ref = storage.ref(fullPath);

    await ref.put(file);
    const url = await ref.getDownloadURL();

    const user = firebase.auth().currentUser;
    let authorName = '';
    let authorDealer = '';

    try {
      if (user) {
        const userSnap = await db.collection('Users').doc(user.uid).get();
        if (userSnap.exists) {
          const u = userSnap.data() || {};
          authorName =
            u.fullName ||
            u.displayName ||
            u.name ||
            '';
          authorDealer =
            u.dealerId ||
            u.dealerID ||
            u.DealerID ||
            u.DealerId ||
            '';
        }
      }
    } catch (e) {
      console.warn('[ftclaims-claimforms] impossibile leggere dati utente per fattura:', e);
    }

    await claimRef.collection('Attachments').add({
      name: file.name,
      path: fullPath,
      url: url,
      category: 'prevRepairInvoice',
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      authorUid: user ? user.uid : null,
      authorName: authorName || null,
      authorDealerId: authorDealer || null
    });
  }

  async function checkPrevInvoiceExists(claimRef) {
    const snap = await claimRef.collection('Attachments')
      .where('category', '==', 'prevRepairInvoice')
      .limit(1)
      .get();
    return !snap.empty;
  }

})();
