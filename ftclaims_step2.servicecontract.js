/* ===============================
   ftclaims_step2.servicecontract.js
   Espone:
     window.FTSTEP2_renderServiceContractDetails({ ... })
   =============================== */

(function(){

  // ---------- Utils storico ----------
  function normalizeOrderDateForHistory(orderDateValue) {
    if (!orderDateValue) return null;

    if (orderDateValue && typeof orderDateValue.toDate === "function") {
      const d = orderDateValue.toDate();
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0,10);
    }

    if (orderDateValue instanceof Date) {
      if (isNaN(orderDateValue.getTime())) return null;
      return orderDateValue.toISOString().slice(0,10);
    }

    if (typeof orderDateValue === "string") {
      const s = orderDateValue.trim();
      if (!s) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toISOString().slice(0,10);
    }

    if (typeof orderDateValue === "number") {
      const d = new Date(orderDateValue);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0,10);
    }

    try {
      const d = new Date(orderDateValue);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0,10);
    } catch {
      return null;
    }
  }

  async function writeMaintenanceHistoryFresh(db, claimCardId, sc, claimCode) {
    const ccSnap = await db.collection("ClaimCards").doc(claimCardId).get();
    if (!ccSnap.exists) return;

    const cc = ccSnap.data() || {};
    const vin = cc?.vehicle?.vin ? String(cc.vehicle.vin) : "";
    if (!vin) return;

    const orderDateIso = normalizeOrderDateForHistory(cc.orderDate ?? null);
    if (!orderDateIso) return;

    const record = {
      vin: vin,
      orderDate: orderDateIso,

      km: (cc.km != null) ? cc.km : null,
      engineHours: (cc.engineHours != null) ? cc.engineHours : null,

      label_it: sc && sc.label_it ? String(sc.label_it) : "",
      family: sc && sc.family ? String(sc.family) : "",
      key: sc && sc.key ? String(sc.key) : "",
      voith: sc && (sc.voith === true) ? true : false,

      claimCardId: String(claimCardId),
      claimCode: claimCode ? String(claimCode) : null,
      openDealer: cc.openDealer || null,

      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("MaintenanceHistory")
      .doc(vin)
      .collection("Records")
      .add(record);
  }

  async function existsSameServiceContractOnVinGlobal(db, vin, fam, key, claimCardId, claimCode) {
    if (!vin) return false;

    const ref = db.collection("MaintenanceHistory").doc(vin).collection("Records");
    const snap = await ref.orderBy("orderDate", "desc").limit(300).get();
    if (snap.empty) return false;

    let foundOther = false;

    snap.forEach(doc => {
      const r = doc.data() || {};
      const rFam = String(r.family || "");
      const rKey = String(r.key || "");
      if (rFam !== String(fam) || rKey !== String(key)) return;

      const sameCard = String(r.claimCardId || "") === String(claimCardId || "");
      const sameCode = String(r.claimCode || "") === String(claimCode || "");
      if (!(sameCard && sameCode)) foundOther = true;
    });

    return foundOther;
  }

  // ---------- Maintenance DB ----------
  async function loadMaintenanceFamilies(db) {
    const snap = await db.collection("Maintenance").limit(300).get();
    const families = new Set();
    snap.forEach(doc => {
      const id = doc.id || "";
      if (id === "_meta") return;
      const parts = id.split("_");
      if (parts.length >= 2) families.add(parts[0]);
    });
    return Array.from(families).sort();
  }

  async function loadMaintenanceMenuOptions(db) {
    const metaSnap = await db.collection("Maintenance").doc("_meta").get();
    if (!metaSnap.exists) return [];

    const d = metaSnap.data() || {};
    const arr = Array.isArray(d.menuOptions) ? d.menuOptions : [];

    return arr
      .filter(x => x && x.key)
      .map(x => {
        const label =
          (x.label_it != null && String(x.label_it).trim() !== "")
            ? String(x.label_it)
            : (x.label && x.label.it != null ? String(x.label.it) : String(x.key));

        return { key: String(x.key), label_it: label };
      });
  }

  async function loadMaintenanceTemplate(db, docId) {
    const snap = await db.collection("Maintenance").doc(docId).get();
    if (!snap.exists) return null;
    return snap.data() || null;
  }

  function canSeeItem(item, isDistributor) {
    const vis = item && item.visibility ? item.visibility : null;
    if (!vis) return true;
    if (isDistributor) return vis.distributor !== false;
    return vis.dealer !== false;
  }

  function isVoithOnly(item) {
    const c = item && item.conditions ? item.conditions : null;
    return !!(c && c.voithOnly === true);
  }

  async function existsSameServiceContractInSameCard(db, claimCardId, currentClaimCode, fam, key) {
    const snap = await db.collection("ClaimCards").doc(claimCardId).collection("Claims")
      .where("claimType", "==", "SERVICE CONTRACT")
      .get();

    let found = false;
    snap.forEach(doc => {
      if (doc.id === currentClaimCode) return;
      const d = doc.data() || {};
      const sc = d.serviceContract || {};
      if (sc.family === fam && sc.key === key) found = true;
    });
    return found;
  }

  // ===========================================================================================
  // PUBLIC RENDERER
  // ===========================================================================================
  window.FTSTEP2_renderServiceContractDetails = function(params){
    const {
      container, claimDoc, ctx, isDistributor,
      db, storage, claimCard, currentUser, banner
    } = params;

    const prefix = "sc_" + ctx.claimCode + "_";

    // markup
    container.innerHTML = `
      <div class="ftsc">

        <div class="ftsc-head">
          <div>
            <div class="ftsc-title">Dati Service Contract</div>
            <div class="ftsc-sub">Seleziona il pacchetto di manutenzione. Le righe (ricambi/manodopera) vengono caricate dal template.</div>
          </div>
          <div class="ftsc-actions">
            <button class="btn btn-primary btn-small" id="${prefix}save" type="button">Salva manutenzione</button>
          </div>
        </div>

        <div class="ftsc-grid">
          <div>
            <label>Famiglia</label>
            <select id="${prefix}family"></select>
          </div>
          <div>
            <label>Tipo manutenzione</label>
            <select id="${prefix}type"></select>
          </div>
        </div>

        <div class="ftsc-voith">
          <label style="display:flex; align-items:center; gap:8px; font-weight:normal;">
            <input type="checkbox" id="${prefix}voith">
            <span><strong>Veicolo con rallentatore VOITH</strong> (Intarder/Retarder)</span>
          </label>
          <div class="muted">Se attivo, verranno incluse le righe previste per VOITH (se presenti nel pacchetto).</div>
        </div>

        <div class="hr"></div>

        <div class="ftsc-block">
          <div class="ftsc-block-title">Righe precompilate</div>
          <div class="muted">Ricambi e manodopera provenienti dal template selezionato (con prezzi e totali).</div>

          <div class="ftsc-tablewrap">
            <div class="ftsc-tabletitle">Manodopera</div>
            <table class="ftsc-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Ore</th>
                  <th>€/h</th>
                  <th>Totale</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody id="${prefix}labourBody">
                <tr><td colspan="6" class="muted">Nessuna riga.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="ftsc-tablewrap">
            <div class="ftsc-tabletitle">Ricambi</div>
            <table class="ftsc-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Descrizione</th>
                  <th>Q.tà</th>
                  <th>€ unit</th>
                  <th>Totale</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody id="${prefix}partsBody">
                <tr><td colspan="6" class="muted">Nessuna riga.</td></tr>
              </tbody>
            </table>
          </div>

          <div class="mutedBox ftsc-totals">
            <div><strong>Totale manodopera:</strong> <span id="${prefix}totLab">€ 0,00</span></div>
            <div><strong>Totale ricambi:</strong> <span id="${prefix}totParts">€ 0,00</span></div>
            <div><strong>Totale generale:</strong> <span id="${prefix}totAll">€ 0,00</span></div>
          </div>
          <div class="muted" style="margin-top:6px;">
            Inserisci prezzi unitari (€/h per manodopera, € unit per ricambi). I totali si aggiornano in automatico.
          </div>
        </div>

        <div class="hr"></div>

        <div class="ftsc-block">
          <div class="ftsc-block-title">Allegati</div>
          <div class="muted">Allegati generici relativi a questo claim.</div>

          <div class="ftsc-attach">
            <input type="file" id="${prefix}file" multiple>
            <button class="btn btn-small" id="${prefix}upload" type="button">Carica</button>
          </div>

          <div id="${prefix}attList" class="muted" style="margin-top:10px;">Nessun allegato presente.</div>
        </div>

        <div class="hr"></div>

        <div class="ftsc-block">
          <div class="ftsc-block-title">Note</div>
          <div id="${prefix}notesList" class="notesBox">Nessuna nota.</div>

          <div class="ftsc-notesend">
            <textarea id="${prefix}noteText" rows="2" placeholder="Scrivi una nota..."></textarea>
            <button class="btn btn-primary" id="${prefix}sendNote" type="button">Invia</button>
          </div>
        </div>

      </div>
    `;

    // refs
    const familySel = container.querySelector("#" + prefix + "family");
    const typeSel   = container.querySelector("#" + prefix + "type");
    const voithChk  = container.querySelector("#" + prefix + "voith");
    const saveBtn   = container.querySelector("#" + prefix + "save");

    const labourBody = container.querySelector("#" + prefix + "labourBody");
    const partsBody  = container.querySelector("#" + prefix + "partsBody");

    const fileInp  = container.querySelector("#" + prefix + "file");
    const upBtn    = container.querySelector("#" + prefix + "upload");
    const attList  = container.querySelector("#" + prefix + "attList");

    const notesList = container.querySelector("#" + prefix + "notesList");
    const noteText  = container.querySelector("#" + prefix + "noteText");
    const sendNote  = container.querySelector("#" + prefix + "sendNote");

    const claimRef = db.collection("ClaimCards").doc(ctx.claimCardId).collection("Claims").doc(ctx.claimCode);

    let menuOptions = [];
    let families = [];
    let currentTemplate = null;

    function toNum(v) {
      if (v == null) return null;
      const s = String(v).replace(",", ".").replace(/[^\d.\-]/g, "");
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    }

    function fmtEUR(n) {
      const x = (n == null || isNaN(n)) ? 0 : Number(n);
      try {
        return x.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
      } catch {
        return "€ " + x.toFixed(2);
      }
    }

    function pickUnitPrice(it) {
      return (
        toNum(it.unitPrice) ??
        toNum(it.unit_price) ??
        toNum(it.price) ??
        toNum(it.unitCost) ??
        toNum(it.cost) ??
        null
      );
    }

    function getSavedLines() {
      const saved = (claimDoc && claimDoc.serviceContractLines) ? claimDoc.serviceContractLines : {};
      return {
        labour: Array.isArray(saved.labour) ? saved.labour : [],
        parts: Array.isArray(saved.parts) ? saved.parts : []
      };
    }

    function findSavedLine(savedArr, code, desc) {
      const c = String(code || "").trim().toUpperCase();
      const d = String(desc || "").trim().toUpperCase();
      return savedArr.find(x =>
        String(x.code || "").trim().toUpperCase() === c &&
        String(x.description || "").trim().toUpperCase() === d
      ) || null;
    }

    function computeTotalsFromDom() {
      let labourTot = 0;
      let partsTot = 0;

      container.querySelectorAll("tr[data-kind='LABOUR']").forEach(tr => {
        const t = toNum(tr.dataset.rowTot);
        if (t != null) labourTot += t;
      });

      container.querySelectorAll("tr[data-kind='PART']").forEach(tr => {
        const t = toNum(tr.dataset.rowTot);
        if (t != null) partsTot += t;
      });

      const grand = labourTot + partsTot;

      const elLab = container.querySelector("#" + prefix + "totLab");
      const elPar = container.querySelector("#" + prefix + "totParts");
      const elAll = container.querySelector("#" + prefix + "totAll");

      if (elLab) elLab.textContent = fmtEUR(labourTot);
      if (elPar) elPar.textContent = fmtEUR(partsTot);
      if (elAll) elAll.textContent = fmtEUR(grand);

      return { labourTot, partsTot, grand };
    }

    function clearBodies() {
      labourBody.innerHTML = `<tr><td colspan="6" class="muted">Nessuna riga.</td></tr>`;
      partsBody.innerHTML  = `<tr><td colspan="6" class="muted">Nessuna riga.</td></tr>`;

      const elLab = container.querySelector("#" + prefix + "totLab");
      const elPar = container.querySelector("#" + prefix + "totParts");
      const elAll = container.querySelector("#" + prefix + "totAll");
      if (elLab) elLab.textContent = "€ 0,00";
      if (elPar) elPar.textContent = "€ 0,00";
      if (elAll) elAll.textContent = "€ 0,00";
    }

    function renderTemplateItems() {
      clearBodies();
      if (!currentTemplate || !Array.isArray(currentTemplate.items)) return;

      const saved = getSavedLines();
      const voithOn = !!voithChk.checked;

      const items = currentTemplate.items
        .filter(it => canSeeItem(it, isDistributor))
        .filter(it => voithOn ? true : !isVoithOnly(it));

      const lab = items.filter(it => String(it.kind || "").toUpperCase() === "LABOUR");
      const par = items.filter(it => String(it.kind || "").toUpperCase() === "PART");

      function makeMoneyInput(value) {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.step = "0.01";
        inp.min = "0";
        inp.className = "ftsc-inp";
        inp.value = (value != null && !isNaN(value)) ? String(value) : "";
        inp.setAttribute("data-field","unit");
        return inp;
      }

      function makeQtyInput(value) {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.step = "0.01";
        inp.min = "0";
        inp.className = "ftsc-inp";
        inp.value = (value != null && !isNaN(value)) ? String(value) : "";
        inp.setAttribute("data-field","qty");
        return inp;
      }

      function setRowTotal(tr, total) {
        tr.dataset.rowTot = (total == null || isNaN(total)) ? "0" : String(total);
        const tdTot = tr.querySelector("[data-cell='rowTotal']");
        if (tdTot) tdTot.textContent = fmtEUR(total);
      }

      function recalcRow(tr) {
        const qty = toNum(tr.querySelector("input[data-field='qty']")?.value) ?? 0;
        const unit = toNum(tr.querySelector("input[data-field='unit']")?.value) ?? 0;
        const tot = qty * unit;
        setRowTotal(tr, tot);
        computeTotalsFromDom();
      }

      const defaultLaborRate =
        (currentUser && currentUser.laborRateStd != null)
          ? currentUser.laborRateStd
          : (window.LABOR_RATE_STD != null ? window.LABOR_RATE_STD : null);

      if (lab.length) {
        labourBody.innerHTML = "";
        lab.forEach(it => {
          const code = safeStr(it.code || "");
          const desc = safeStr(it.description || "");
          const qty0 = toNum(it.qty != null ? it.qty : null);

          const savedLine = findSavedLine(saved.labour, code, desc);
          const qtyInit = toNum(savedLine?.qty) ?? qty0;

          let unitInit = toNum(savedLine?.unitPrice);
          if (unitInit == null) unitInit = pickUnitPrice(it);
          if (unitInit == null) unitInit = defaultLaborRate;

          const tr = document.createElement("tr");
          tr.dataset.kind = "LABOUR";

          const qtyInp = makeQtyInput(qtyInit);
          const unitInp = makeMoneyInput(unitInit);

          tr.innerHTML = `
            <td>${code}</td>
            <td>${desc}</td>
            <td></td>
            <td></td>
            <td data-cell="rowTotal">${fmtEUR(0)}</td>
            <td>${safeStr(it.note || "")}</td>
          `;
          tr.children[2].appendChild(qtyInp);
          tr.children[3].appendChild(unitInp);

          qtyInp.addEventListener("input", () => recalcRow(tr));
          unitInp.addEventListener("input", () => recalcRow(tr));

          labourBody.appendChild(tr);
          recalcRow(tr);
        });
      }

      if (par.length) {
        partsBody.innerHTML = "";
        par.forEach(it => {
          const code = safeStr(it.code || "");
          const desc = safeStr(it.description || "");
          const qty0 = toNum(it.qty != null ? it.qty : null);

          const savedLine = findSavedLine(saved.parts, code, desc);
          const qtyInit = toNum(savedLine?.qty) ?? qty0;

          let unitInit = toNum(savedLine?.unitPrice);
          if (unitInit == null) unitInit = pickUnitPrice(it);

          const tr = document.createElement("tr");
          tr.dataset.kind = "PART";

          const qtyInp = makeQtyInput(qtyInit);
          const unitInp = makeMoneyInput(unitInit);

          tr.innerHTML = `
            <td>${code}</td>
            <td>${desc}</td>
            <td></td>
            <td></td>
            <td data-cell="rowTotal">${fmtEUR(0)}</td>
            <td>${safeStr(it.note || "")}</td>
          `;
          tr.children[2].appendChild(qtyInp);
          tr.children[3].appendChild(unitInp);

          qtyInp.addEventListener("input", () => recalcRow(tr));
          unitInp.addEventListener("input", () => recalcRow(tr));

          partsBody.appendChild(tr);
          recalcRow(tr);
        });
      }

      computeTotalsFromDom();
    }

    async function refreshTemplate() {
      const fam = familySel.value;
      const key = typeSel.value;
      if (!fam || !key) {
        currentTemplate = null;
        clearBodies();
        return;
      }
      const docId = fam + "_" + key;
      currentTemplate = await loadMaintenanceTemplate(db, docId);
      renderTemplateItems();
    }

    function fillTypeOptions(selectedKey) {
      typeSel.innerHTML = "";
      const o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = "-- Seleziona --";
      o0.disabled = true;
      o0.selected = true;
      typeSel.appendChild(o0);

      menuOptions.forEach(m => {
        const o = document.createElement("option");
        o.value = m.key;
        o.textContent = (m.label_it && String(m.label_it).trim() !== "") ? m.label_it : m.key;
        typeSel.appendChild(o);
      });

      if (selectedKey) typeSel.value = selectedKey;
    }

    function fillFamilies(selectedFamily) {
      familySel.innerHTML = "";
      families.forEach(f => {
        const o = document.createElement("option");
        o.value = f;
        o.textContent = f;
        familySel.appendChild(o);
      });
      if (selectedFamily) familySel.value = selectedFamily;
    }

    familySel.addEventListener("change", refreshTemplate);
    typeSel.addEventListener("change", refreshTemplate);
    voithChk.addEventListener("change", renderTemplateItems);

    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        const fam = familySel.value;
        const key = typeSel.value;
        if (!fam || !key) {
          alert("Seleziona famiglia e tipo manutenzione.");
          return;
        }

        const vin = (claimCard && claimCard.vehicle && claimCard.vehicle.vin)
          ? String(claimCard.vehicle.vin)
          : null;

        const dupSameCard = await existsSameServiceContractInSameCard(db, ctx.claimCardId, ctx.claimCode, fam, key);
        if (dupSameCard) {
          alert("ATTENZIONE: esiste già una manutenzione identica (stessa famiglia + stesso tipo) in questa pratica.");
          return;
        }

        let dupVin = false;
        try {
          dupVin = await existsSameServiceContractOnVinGlobal(db, vin, fam, key, ctx.claimCardId, ctx.claimCode);
        } catch (err) {
          console.warn("Check dup VIN fallito (non bloccante):", err?.code, err?.message || err);
          banner && banner("warn", "⚠ Impossibile verificare doppioni su VIN (controllo non bloccante).");
        }

        if (dupVin) {
          alert("ATTENZIONE: questa manutenzione risulta già reclamata in passato su questo VIN.");
          return;
        }

        const labelObj = menuOptions.find(x => x.key === key);
        const labelIt = (labelObj && labelObj.label_it) ? labelObj.label_it : key;

        const docId = fam + "_" + key;
        const scObj = {
          family: fam,
          key: key,
          label_it: labelIt,
          templateDocId: docId,
          voith: !!voithChk.checked,
          savedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        function collectLines(kind) {
          const out = [];
          container.querySelectorAll("tr[data-kind='" + kind + "']").forEach(tr => {
            const tds = tr.querySelectorAll("td");
            const code = (tds[0]?.textContent || "").trim();
            const description = (tds[1]?.textContent || "").trim();
            const qty = toNum(tr.querySelector("input[data-field='qty']")?.value);
            const unitPrice = toNum(tr.querySelector("input[data-field='unit']")?.value);
            const rowTotal = toNum(tr.dataset.rowTot);

            out.push({
              code,
              description,
              qty: (qty == null ? null : qty),
              unitPrice: (unitPrice == null ? null : unitPrice),
              rowTotal: (rowTotal == null ? null : rowTotal)
            });
          });
          return out;
        }

        const totals = computeTotalsFromDom();
        const linesObj = {
          labour: collectLines("LABOUR"),
          parts: collectLines("PART"),
          totals: {
            labour: totals.labourTot,
            parts: totals.partsTot,
            grand: totals.grand
          }
        };

        const payload = {
          vin: vin || null,
          claimType: "SERVICE CONTRACT",
          serviceContract: scObj,
          serviceContractLines: linesObj,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        saveBtn.disabled = true;
        await claimRef.set(payload, { merge: true });

        try {
          await writeMaintenanceHistoryFresh(db, ctx.claimCardId, scObj, ctx.claimCode);
        } catch (eHist) {
          console.warn("MaintenanceHistory non scritto (non bloccante):", eHist?.code, eHist?.message || eHist);
          banner && banner("warn", "Manutenzione salvata. ⚠ Storico VIN non aggiornato (non bloccante).");
          return;
        }

        banner && banner("success", "Manutenzione salvata.");
      } catch (e2) {
        console.error("[SAVE MAINT] error:", e2);
        banner && banner("error", "Errore salvataggio manutenzione: " + (e2.message || e2));
      } finally {
        saveBtn.disabled = false;
      }
    });

    // --- Allegati ---
    const attRefBase = claimRef.collection("Attachments");

    async function loadAttachments() {
      try {
        const snap = await attRefBase.orderBy("createdAt", "asc").get();
        const items = [];
        snap.forEach(doc => {
          const d = doc.data() || {};
          items.push({ id: doc.id, name: d.name || "", path: d.path || "", url: d.url || "" });
        });

        if (!items.length) {
          attList.textContent = "Nessun allegato presente.";
          return;
        }

        const ul = document.createElement("ul");
        ul.style.listStyleType = "none";
        ul.style.paddingLeft = "0";

        items.forEach(it => {
          const li = document.createElement("li");
          li.style.marginBottom = "8px";
          li.style.display = "flex";
          li.style.alignItems = "center";
          li.style.gap = "10px";
          li.style.flexWrap = "wrap";

          const a = document.createElement("a");
          a.href = it.url || "#";
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = it.name || it.path || "file";

          const del = document.createElement("button");
          del.className = "btn btn-danger btn-small";
          del.type = "button";
          del.textContent = "Elimina";

          del.addEventListener("click", async () => {
            if (!confirm("Vuoi eliminare l'allegato?")) return;
            try {
              if (it.path) {
                try { await storage.ref(it.path).delete(); } catch(e){}
              }
              await attRefBase.doc(it.id).delete();
              loadAttachments();
            } catch(e) {
              alert("Errore eliminazione allegato: " + (e.message || e));
            }
          });

          li.appendChild(a);
          li.appendChild(del);
          ul.appendChild(li);
        });

        attList.innerHTML = "";
        attList.appendChild(ul);
      } catch(e) {
        console.error(e);
        attList.textContent = "Errore nel caricamento allegati.";
      }
    }

    upBtn.addEventListener("click", async () => {
      const files = fileInp.files;
      if (!files || !files.length) { alert("Seleziona almeno un file."); return; }

      upBtn.disabled = true;
      try {
        const basePath = "ClaimCards/" + ctx.claimCardId + "/Claims/" + ctx.claimCode + "/Attachments/";
        for (let i=0;i<files.length;i++) {
          const f = files[i];
          const path = basePath + Date.now() + "_" + i + "_" + f.name;
          const ref = storage.ref(path);

          await ref.put(f);
          const url = await ref.getDownloadURL();

          await attRefBase.add({
            name: f.name,
            path,
            url,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            authorUid: currentUser.uid || null,
            authorName: currentUser.name || null,
            authorDealerId: currentUser.dealerId || null
          });
        }
        fileInp.value = "";
        loadAttachments();
      } catch(e) {
        console.error(e);
        alert("Errore upload allegati: " + (e.message || e));
      } finally {
        upBtn.disabled = false;
      }
    });

    loadAttachments();

    // --- Note ---
    const notesRef = claimRef.collection("Notes");

    function renderNotes(snap) {
      if (snap.empty) {
        notesList.textContent = "Nessuna nota.";
        return;
      }
      notesList.innerHTML = "";
      snap.forEach(doc => {
        const d = doc.data() || {};
        const wrap = document.createElement("div");
        wrap.className = "noteLine";

        const h = document.createElement("div");
        h.className = "noteHeader";

        let when = "";
        if (d.createdAt && d.createdAt.toDate) {
          const t = d.createdAt.toDate();
          const dd = String(t.getDate()).padStart(2,"0");
          const mm = String(t.getMonth()+1).padStart(2,"0");
          const yyyy = t.getFullYear();
          const hh = String(t.getHours()).padStart(2,"0");
          const mi = String(t.getMinutes()).padStart(2,"0");
          when = dd + "/" + mm + "/" + yyyy + " " + hh + ":" + mi;
        }

        const author = d.authorName || d.authorDealerId || "";
        h.textContent = author ? (author + (when ? " ("+when+")" : "")) : (when || "");

        const b = document.createElement("div");
        b.textContent = d.text || "";

        wrap.appendChild(h);
        wrap.appendChild(b);
        notesList.appendChild(wrap);
      });
      notesList.scrollTop = notesList.scrollHeight;
    }

    notesRef.orderBy("createdAt","asc").onSnapshot(renderNotes, (e)=>console.error(e));

    sendNote.addEventListener("click", async () => {
      const txt = (noteText.value || "").trim();
      if (!txt) return;

      sendNote.disabled = true;
      try {
        await notesRef.add({
          text: txt,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          authorUid: currentUser.uid || null,
          authorName: currentUser.name || null,
          authorDealerId: currentUser.dealerId || null
        });
        noteText.value = "";
      } catch(e) {
        console.error(e);
        alert("Errore invio nota: " + (e.message || e));
      } finally {
        sendNote.disabled = false;
      }
    });

    // init
    (async function init() {
      menuOptions = await loadMaintenanceMenuOptions(db);
      families = await loadMaintenanceFamilies(db);
      if (!families.length) families = ["470"];

      const sc = (claimDoc.serviceContract || {});
      const savedFamily = sc.family || families[0];
      const savedKey = sc.key || null;

      fillFamilies(savedFamily);
      fillTypeOptions(savedKey);

      if (sc.voith === true) voithChk.checked = true;
      await refreshTemplate();
    })();
  };

})();
