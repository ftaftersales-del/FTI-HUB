// ===============================
// ftclaims-claimforms.js
// Dettagli claim + Allegati + Note
// + SERVICE CONTRACT (Maintenance templates)
// ===============================

function normalizeClaimType(ct) {
  return (ct || "").toString().trim().toUpperCase();
}

/**
 * Entry point:
 * claimType: "RSA", "GARANZIA", "GARANZIA RICAMBIO", "SERVICE CONTRACT", ...
 * container: div interno
 * claimData: dati Firestore claim
 * ctx: { claimCardId, claimCode }
 */
function renderClaimDetails(claimType, container, claimData, ctx) {
  const type = normalizeClaimType(claimType);

  container.innerHTML = "";

  if (type === "RSA") {
    renderRSADetails(container, claimData, ctx);
    return;
  }

  if (type === "GARANZIA") {
    renderGaranziaDetails(container, claimData, ctx);
    return;
  }

  if (type === "GARANZIA RICAMBIO") {
    renderGaranziaRicambioDetails(container, claimData, ctx);
    return;
  }

  if (type === "SERVICE CONTRACT" || type === "MANUTENZIONE") {
    renderServiceContractDetails(container, claimData, ctx);
    return;
  }

  // fallback
  const info = document.createElement("div");
  info.className = "small-text";
  info.textContent = 'Per la tipologia "' + type + '" non sono ancora previsti campi aggiuntivi.';
  container.appendChild(info);

  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
}

/* ============================================================
   SERVICE CONTRACT (Maintenance)
============================================================ */

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
      Seleziona il pacchetto manutenzione. Le righe (ricambi/manodopera) vengono precompilate dal template in Firestore.
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

  // -------- helpers --------

  function escapeHtml(s) {
    return (s || "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function toBool(v) {
    return v === true || v === "true" || v === "TRUE" || v === 1 || v === "1" || v === "SI" || v === "YES";
  }

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
    // ricavo le famiglie leggendo un po’ di docId (470_..., 510_...)
    const snap = await db.collection("Maintenance").limit(200).get();
    const famSet = new Set();

    snap.forEach(doc => {
      const id = doc.id || "";
      if (id === "_meta") return;
      const m = id.match(/^(\d+)_/);
      if (m && m[1]) famSet.add(m[1]);
    });

    const fams = Array.from(famSet).sort((a, b) => Number(a) - Number(b));
    return fams.length ? fams : ["470"]; // fallback
  }

  async function loadMenuOptions() {
    const metaSnap = await db.collection("Maintenance").doc("_meta").get();
    const d = metaSnap.exists ? (metaSnap.data() || {}) : {};
    const menuOptions = Array.isArray(d.menuOptions) ? d.menuOptions : [];
    // ritorno array {key, label}
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
    return (familySel && familySel.value) ? familySel.value : null;
  }

  function currentTemplateId() {
    return (packageSel && packageSel.value) ? packageSel.value : null; // es: 470_1s
  }

  async function loadTemplateAndRender() {
    const templateId = currentTemplateId();
    if (!templateId) {
      labourWrap.innerHTML = "";
      partsWrap.innerHTML = "";
      hint.textContent = "Seleziona un pacchetto per visualizzare righe ricambi e manodopera.";
      return;
    }

    const voithEnabled = !!voithChk.checked;

    const snap = await db.collection("Maintenance").doc(templateId).get();
    if (!snap.exists) {
      labourWrap.innerHTML = "<div>Template non trovato: " + escapeHtml(templateId) + "</div>";
      partsWrap.innerHTML = "";
      return;
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

    // salvo in memoria per “save”
    return {
      templateId,
      family: t.family || (templateId.split("_")[0] || null),
      key: t.key || (templateId.split("_")[1] || null),
      label: t.label || templateId,
      voithEnabled,
      items: filtered
    };
  }

  // -------- init UI --------

  (async function init() {
    // prefill checkbox voith
    if (sc.voithEnabled != null) voithChk.checked = !!sc.voithEnabled;

    const [fams, menu] = await Promise.all([loadFamilies(), loadMenuOptions()]);

    // famiglia: prefill se già salvata
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
        value: fam + "_" + m.key,     // value = docId
        label: m.label               // label = testo umano
      }));
      setSelectOptions(packageSel, opts, "-- Seleziona pacchetto --");

      // se c’è già un templateId salvato, ripristino selezione
      if (sc.templateId && String(sc.templateId).startsWith(fam + "_")) {
        packageSel.value = String(sc.templateId);
      }
    }

    repopulatePackageSelect();

    // quando cambia fam: ricarico pacchetti
    familySel.addEventListener("change", async function () {
      repopulatePackageSelect();
      await loadTemplateAndRender();
    });

    // quando cambia pacchetto o voith: render
    packageSel.addEventListener("change", loadTemplateAndRender);
    voithChk.addEventListener("change", loadTemplateAndRender);

    // render iniziale se già selezionato
    await loadTemplateAndRender();
  })();

  // -------- save --------

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

      // NB: qui salvo sia intestazione sia righe filtrate
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

  // Allegati + Note, ma SENZA Ticket/Sinistro per Service Contract
  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: true });
}

/* ============================================================
   RSA / GARANZIA / GARANZIA RICAMBIO
   (qui sotto lasciamo il tuo codice com’è)
============================================================ */

// ----- RSA (tuo codice invariato) -----
function isWeekendOrItalianHoliday(dateStr) { /* ... identico al tuo ... */ 
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return false;

  const day = d.getDay();
  if (day === 0 || day === 6) return true;

  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const dayOfMonth = d.getDate().toString().padStart(2, "0");
  const md = month + "-" + dayOfMonth;

  const holidays = ["01-01","01-06","04-25","05-01","06-02","08-15","11-01","12-08","12-25","12-26"];
  return holidays.includes(md);
}

function renderRSADetails(container, claimData, ctx) {
  // <<< INCOLLA QUI il tuo renderRSADetails IDENTICO >>>
  // (non lo ri-incollo tutto per non esplodere: è quello che hai già)
  // IMPORTANTE: alla fine lascia addAttachmentsAndNotesSection(container, ctx, {hideGeneral:false});
  // --- INIZIO ---
  // ... (il tuo codice RSA)
  // --- FINE ---
  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
}

// ----- GARANZIA / GARANZIA RICAMBIO (tuo codice invariato) -----
function renderGaranziaDetailsInternal(container, garData, ctx, options) {
  // <<< INCOLLA QUI il tuo renderGaranziaDetailsInternal IDENTICO >>>
  // e alla fine lascia addAttachmentsAndNotesSection(container, ctx, {hideGeneral:false});
  addAttachmentsAndNotesSection(container, ctx, { hideGeneral: false });
}
function renderGaranziaDetails(container, claimData, ctx) {
  renderGaranziaDetailsInternal(container, claimData.garanzia || {}, ctx, { isRicambio: false });
}
function renderGaranziaRicambioDetails(container, claimData, ctx) {
  renderGaranziaDetailsInternal(container, claimData.garanziaRicambio || {}, ctx, { isRicambio: true });
}

/* ============================================================
   Allegati + Note + (opzionale) Dati generali Ticket/Sinistro
============================================================ */

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

  // ---------- DATI GENERALI (Ticket/Sinistro) ----------
  // Per Service Contract NON li mostriamo.
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
        <div class="small-text">Campo modificabile solo dal distributore (dealer FT001).</div>
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

    if (saveGeneralBtn) {
      saveGeneralBtn.addEventListener("click", async function () {
        const ticketVal   = ticketInput ? ticketInput.value.trim() : "";
        const sinistroVal = sinistroInput ? sinistroInput.value.trim() : "";

        const updateData = { ticket: ticketVal || null };
        if (isDistributor) updateData.sinistro = sinistroVal || null;

        try {
          await claimDocRef.update(updateData);
          alert("Dati generali claim salvati.");
        } catch (err) {
          alert("Errore nel salvataggio dei dati generali claim: " + err.message);
        }
      });
    }
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
          path, url,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          authorUid: userInfo.uid || null,
          authorName: userInfo.name || null,
          authorDealerId: userInfo.dealerId || null
        });
      }

      attFileInput.value = "";
      loadAttachments();
    } catch (err) {
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
      alert("Errore nell'invio della nota: " + err.message);
    } finally {
      noteSendBtn.disabled = false;
    }
  });
}

/* ============================================================
   getCurrentUserInfo (tuo identico)
============================================================ */

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
          dealerId = d.dealerId || d.DealerID || d.dealerID || null;
          if (!name) name = d.fullName || d.name || d.displayName || null;
        }
      } catch (err) {}

      return { uid: user.uid, name: name, dealerId: dealerId };
    })();
  }

  return _ftclaimsUserInfoPromise;
}
