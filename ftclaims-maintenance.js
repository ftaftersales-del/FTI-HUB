/* ============================================================
   ftclaims-maintenance.js
   - Attiva solo su ClaimCard di tipo MANUTENZIONE/MAINTENANCE
   - Intercetta addRepair() e deleteRepair() senza rompere altro
   - Enforce:
     * stesso tipo manutenzione non ripetibile nel claim card
     * stesso tipo manutenzione non selezionabile se già eseguito in passato (MaintenanceRegistry)
     * family (470/510) e voith scelti una volta e poi bloccati sul ClaimCard
   ============================================================ */

(function () {
  if (typeof firebase === "undefined" || !firebase.firestore) return;

  const db = firebase.firestore();

  // ---------- helpers tipo ----------
  function normalizeCardType(v) {
    const s = (v || "").toString().trim().toUpperCase();
    if (s === "MANUTENZIONE") return "MAINTENANCE";
    return s;
  }
  function isMaintenanceCardType(v) {
    return normalizeCardType(v) === "MAINTENANCE";
  }

  // ---------- user / dealer ----------
  async function getCurrentUserInfoSafe() {
    // Se esiste già la tua helper globale in claimforms, usala.
    if (typeof window.getCurrentUserInfo === "function") {
      return await window.getCurrentUserInfo();
    }

    // fallback minimale
    const u = (firebase.auth && firebase.auth().currentUser) ? firebase.auth().currentUser : null;
    if (!u) return null;

    const userSnap = await db.collection("Users").doc(u.uid).get();
    const ud = userSnap.exists ? (userSnap.data() || {}) : {};
    const dealerId = ud.dealerId || ud.DealerID || ud.DealerId || null;

    let isDistributor = false;
    if (dealerId) {
      const dSnap = await db.collection("dealers").doc(dealerId).get();
      const dd = dSnap.exists ? (dSnap.data() || {}) : {};
      isDistributor = !!dd.isDistributor;
    }

    return { uid: u.uid, email: u.email, dealerId, isDistributor };
  }

  // ---------- Maintenance templates ----------
  async function loadMaintenanceMeta() {
    // atteso: collezione "Maintenance", doc "_meta" con menuOptions
    const metaSnap = await db.collection("Maintenance").doc("_meta").get();
    if (!metaSnap.exists) {
      throw new Error('Doc "Maintenance/_meta" non trovato (menu manutenzioni).');
    }
    const d = metaSnap.data() || {};
    const menuOptions = Array.isArray(d.menuOptions) ? d.menuOptions : [];
    return { menuOptions };
  }

  function labelToCode(label) {
    // es: "1° Manutenzione Smart" => "1s"
    //     "2° Manutenzione Meccanica" => "2m"
    const s = (label || "").toString().trim();
    const n = parseInt(s, 10);
    const upper = s.toUpperCase();
    let variant = null;
    if (upper.includes("SMART")) variant = "s";
    if (upper.includes("MECCANICA")) variant = "m";
    if (!n || !variant) return null;
    return String(n) + variant;
  }

  // ---------- Registry ----------
  const REGISTRY_COLLECTION = "MaintenanceRegistry";

  function registryDocId(vin, maintCode) {
    // scegliamo formato VIN__1s per essere safe con VIN che contiene "_" ecc.
    return `${vin}__${maintCode}`;
  }

  async function isMaintenanceAlreadyDoneInPast(vin, maintCode) {
    const id = registryDocId(vin, maintCode);
    const snap = await db.collection(REGISTRY_COLLECTION).doc(id).get();
    return snap.exists;
  }

  async function getUsedMaintCodesInThisClaimCard(cardId) {
    const snap = await db.collection("ClaimCards").doc(cardId).collection("Claims").get();
    const used = new Set();
    snap.forEach(doc => {
      const d = doc.data() || {};
      if ((d.claimType || "").toString().toUpperCase() !== "MANUTENZIONE") return;
      const mc = d.maintenance || {};
      if (mc.code) used.add(String(mc.code));
    });
    return used;
  }

  // ---------- UI modal (injected) ----------
  function ensureModal() {
    let modal = document.getElementById("maintModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "maintModal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(0,0,0,0.45)";
    modal.style.display = "none";
    modal.style.zIndex = "9999";

    modal.innerHTML = `
      <div style="max-width:520px;margin:8vh auto;background:#fff;border-radius:10px;padding:14px 16px;font-family:Arial;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h3 style="margin:0;font-size:16px;">Nuovo claim Manutenzione</h3>
          <button id="maintClose" style="border:0;background:transparent;font-size:18px;cursor:pointer;">✕</button>
        </div>

        <div style="margin-top:10px;font-size:13px;color:#333;" id="maintInfo"></div>

        <div style="margin-top:10px;">
          <label style="font-size:12px;">Famiglia differenziale (470/510) <span style="color:#777;">(solo prima volta)</span></label>
          <select id="maintFamily" style="width:100%;padding:8px;margin-top:4px;">
            <option value="">Seleziona.</option>
            <option value="470">470</option>
            <option value="510">510</option>
          </select>
        </div>

        <div style="margin-top:10px;">
          <label style="font-size:12px;">Voith (Intarder/Retarder) <span style="color:#777;">(solo prima volta)</span></label>
          <div style="margin-top:4px;">
            <label style="font-size:13px;">
              <input type="checkbox" id="maintVoith"> Veicolo con Voith
            </label>
          </div>
        </div>

        <div style="margin-top:10px;">
          <label style="font-size:12px;">Tipo manutenzione</label>
          <select id="maintType" style="width:100%;padding:8px;margin-top:4px;"></select>
          <div style="margin-top:6px;font-size:12px;color:#666;" id="maintHint"></div>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button id="maintCancel" class="btn btn-secondary" type="button">Annulla</button>
          <button id="maintOk" class="btn btn-primary" type="button">Crea</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // close handlers
    const close = () => (modal.style.display = "none");
    modal.querySelector("#maintClose").addEventListener("click", close);
    modal.querySelector("#maintCancel").addEventListener("click", close);

    return modal;
  }

  async function openMaintenanceDialog(cardId) {
    const modal = ensureModal();

    const infoEl = modal.querySelector("#maintInfo");
    const familySel = modal.querySelector("#maintFamily");
    const voithChk = modal.querySelector("#maintVoith");
    const typeSel = modal.querySelector("#maintType");
    const hintEl = modal.querySelector("#maintHint");
    const okBtn = modal.querySelector("#maintOk");

    infoEl.textContent = "Caricamento opzioni…";
    hintEl.textContent = "";
    typeSel.innerHTML = `<option value="">Caricamento…</option>`;

    // load claimcard
    const cardSnap = await db.collection("ClaimCards").doc(cardId).get();
    if (!cardSnap.exists) throw new Error("ClaimCard non trovato.");
    const cardData = cardSnap.data() || {};
    const vin = ((cardData.vehicle && cardData.vehicle.vin) || cardData.vin || "").toString().toUpperCase();
    if (!vin) throw new Error("VIN non presente nella ClaimCard.");

    // locked fields (first time)
    const lockedFamily = cardData.maintenanceFamily || null;
    const lockedVoith = (typeof cardData.maintenanceVoith === "boolean") ? cardData.maintenanceVoith : null;

    // preload meta options
    const meta = await loadMaintenanceMeta();
    const menuOptions = meta.menuOptions;

    // used in this claim card
    const usedHere = await getUsedMaintCodesInThisClaimCard(cardId);

    // build select options, disabling already used or already done in past
    typeSel.innerHTML = `<option value="">Seleziona.</option>`;

    // compute past-done map (small N => ok to check one by one)
    const pastDone = {};
    for (const label of menuOptions) {
      const code = labelToCode(label);
      if (!code) continue;
      pastDone[code] = await isMaintenanceAlreadyDoneInPast(vin, code);
    }

    for (const label of menuOptions) {
      const code = labelToCode(label);
      if (!code) continue;

      const opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;

      const alreadyInCard = usedHere.has(code);
      const alreadyDone = !!pastDone[code];

      if (alreadyInCard || alreadyDone) {
        opt.disabled = true;
        opt.textContent = label + (alreadyInCard ? " (già nel claim card)" : " (già eseguita in passato)");
      }

      typeSel.appendChild(opt);
    }

    // lock family/voith if already set
    if (lockedFamily) {
      familySel.value = lockedFamily;
      familySel.disabled = true;
    } else {
      familySel.value = "";
      familySel.disabled = false;
    }

    if (lockedVoith !== null) {
      voithChk.checked = lockedVoith;
      voithChk.disabled = true;
    } else {
      voithChk.checked = false;
      voithChk.disabled = false;
    }

    infoEl.innerHTML = `<strong>VIN:</strong> ${vin}`;

    // selection hint
    typeSel.addEventListener("change", () => {
      const label = typeSel.value;
      if (!label) {
        hintEl.textContent = "";
        return;
      }
      const code = labelToCode(label);
      hintEl.textContent = code ? `Codice: ${code}` : "";
    });

    // promise on OK
    modal.style.display = "block";

    return await new Promise((resolve, reject) => {
      const handler = async () => {
        try {
          okBtn.removeEventListener("click", handler);

          const family = familySel.value || lockedFamily;
          const voith = (lockedVoith !== null) ? lockedVoith : !!voithChk.checked;
          const label = typeSel.value;

          if (!family) throw new Error("Seleziona la famiglia (470/510).");
          if (!label) throw new Error("Seleziona un tipo manutenzione.");

          const maintCode = labelToCode(label);
          if (!maintCode) throw new Error("Impossibile interpretare il tipo manutenzione selezionato.");

          // safety re-check (race)
          if (usedHere.has(maintCode)) {
            throw new Error("Questa manutenzione è già presente nel claim card.");
          }
          if (await isMaintenanceAlreadyDoneInPast(vin, maintCode)) {
            throw new Error("Questa manutenzione risulta già eseguita in passato per questo VIN.");
          }

          modal.style.display = "none";
          resolve({ vin, family, voith, maintCode, label });
        } catch (e) {
          alert(e.message || e);
          okBtn.addEventListener("click", handler);
        }
      };

      okBtn.addEventListener("click", handler);
    });
  }

  // ---------- Create maintenance claim (transaction) ----------
  async function createMaintenanceClaim(cardId, selection, currentClaimCardType) {
    const { vin, family, voith, maintCode, label } = selection;

    const cardRef = db.collection("ClaimCards").doc(cardId);

    // load template
    const templateId = `${family}_${maintCode}`;
    const tplSnap = await db.collection("Maintenance").doc(templateId).get();
    if (!tplSnap.exists) {
      throw new Error(`Template manutenzione non trovato: Maintenance/${templateId}`);
    }
    const tpl = tplSnap.data() || {};
    const items = Array.isArray(tpl.items) ? tpl.items : [];

    // transaction: allocate code, lock family/voith if first time, create claim, create registry
    const newCode = await db.runTransaction(async (tx) => {
      const snap = await tx.get(cardRef);
      if (!snap.exists) throw new Error("Pratica non trovata.");

      const cardData = snap.data() || {};
      const lockedFamily = cardData.maintenanceFamily || null;
      const lockedVoith = (typeof cardData.maintenanceVoith === "boolean") ? cardData.maintenanceVoith : null;

      // enforce lock consistency
      if (lockedFamily && lockedFamily !== family) {
        throw new Error(`Famiglia già bloccata a ${lockedFamily}.`);
      }
      if (lockedVoith !== null && lockedVoith !== voith) {
        throw new Error("Voith già bloccato con valore diverso.");
      }

      // allocate progressive claim code (same as standard)
      const lastNum = cardData.lastClaimNumber || 0;
      const nextNum = lastNum + 1;
      const code = String(nextNum).padStart(3, "0");
      tx.update(cardRef, { lastClaimNumber: nextNum });

      // check again: not already in this card (within tx by reading claims not feasible)
      // -> we rely on UI + registry hard lock, plus unique within card is handled by UI

      // create claim doc
      const claimRef = cardRef.collection("Claims").doc(code);

      const claimData = {
        code: code,
        claimType: "Manutenzione",
        status: "Aperto",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        maintenance: {
          family: family,
          voith: voith,
          code: maintCode,
          label: label,
          templateId: templateId,
          // righe già “pronte”: ricambi + manodopera (incluse FO) -> FO verrà solo nascosta in UI al dealer
          items: items
        }
      };

      tx.set(claimRef, claimData);

      // lock family/voith on card if first time
      const cardUpdates = {};
      if (!lockedFamily) cardUpdates.maintenanceFamily = family;
      if (lockedVoith === null) cardUpdates.maintenanceVoith = voith;
      if (Object.keys(cardUpdates).length) tx.update(cardRef, cardUpdates);

      // registry
      const regRef = db.collection(REGISTRY_COLLECTION).doc(registryDocId(vin, maintCode));
      tx.set(regRef, {
        vin: vin,
        maintenanceCode: maintCode,
        maintenanceLabel: label,
        family: family,
        voith: voith,
        claimCardId: cardId,
        claimCode: code,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return code;
    });

    return newCode;
  }

  // ---------- Release maintenance when deleting a claim ----------
  async function releaseMaintenanceIfNeeded(cardId, claimCode) {
    const claimRef = db.collection("ClaimCards").doc(cardId).collection("Claims").doc(claimCode);
    const snap = await claimRef.get();
    if (!snap.exists) return;

    const d = snap.data() || {};
    if ((d.claimType || "").toString().toUpperCase() !== "MANUTENZIONE") return;

    const cardSnap = await db.collection("ClaimCards").doc(cardId).get();
    const cardData = cardSnap.exists ? (cardSnap.data() || {}) : {};
    const vin = ((cardData.vehicle && cardData.vehicle.vin) || cardData.vin || "").toString().toUpperCase();

    const mc = d.maintenance || {};
    const maintCode = mc.code ? String(mc.code) : null;
    if (!vin || !maintCode) return;

    // delete registry record
    await db.collection(REGISTRY_COLLECTION).doc(registryDocId(vin, maintCode)).delete();
  }

  // ---------- Hook existing STEP2 functions (no HTML rewrite) ----------
  function hookStep2() {
    // these vars/functions exist in FTCLAIMS_STEP2.html script
    if (typeof window.addRepair !== "function") return;

    const originalAddRepair = window.addRepair;
    const originalDeleteRepair = window.deleteRepair;

    // wrap addRepair
    window.addRepair = async function () {
      try {
        if (!isMaintenanceCardType(window.currentClaimCardType)) {
          return await originalAddRepair.apply(this, arguments);
        }

        // claim card maintenance: use dialog + template creation
        if (!window.currentClaimId) {
          if (typeof window.showMessage === "function") {
            window.showMessage("Impossibile aggiungere: nessuna pratica caricata.", "error");
          }
          return;
        }

        // blocchi stato come standard
        if (window.currentClaimStatus === "Conclusa" || window.currentClaimStatus === "Cancellata") {
          if (typeof window.showMessage === "function") {
            window.showMessage(
              "La pratica è " + String(window.currentClaimStatus).toLowerCase() + ": non è possibile aggiungere nuovi claim.",
              "error"
            );
          }
          return;
        }

        const btn = document.getElementById("btnAddRepair");
        if (btn) btn.disabled = true;

        const selection = await openMaintenanceDialog(window.currentClaimId);
        const newCode = await createMaintenanceClaim(window.currentClaimId, selection, window.currentClaimCardType);

        if (typeof window.showMessage === "function") {
          window.showMessage(
            "Riparazione " + newCode + " (Manutenzione: " + selection.maintCode + ") creata.",
            "success"
          );
        }
        if (typeof window.loadClaims === "function") await window.loadClaims();
      } catch (err) {
        console.error(err);
        if (typeof window.showMessage === "function") {
          window.showMessage("Errore nella creazione manutenzione: " + err.message, "error");
        } else {
          alert(err.message);
        }
      } finally {
        const btn = document.getElementById("btnAddRepair");
        if (btn) btn.disabled = false;
      }
    };

    // wrap deleteRepair (libera manutenzione)
    if (typeof originalDeleteRepair === "function") {
      window.deleteRepair = async function (code) {
        try {
          if (isMaintenanceCardType(window.currentClaimCardType) && window.currentClaimId && code) {
            // release BEFORE delete (we need maintenance.code)
            await releaseMaintenanceIfNeeded(window.currentClaimId, code);
          }
        } catch (e) {
          console.warn("Release manutenzione fallito (proseguo comunque):", e);
        }
        return await originalDeleteRepair.apply(this, arguments);
      };
    }
  }

  // hook after load
  window.addEventListener("load", () => {
    // aspetta un tick per sicurezza
    setTimeout(hookStep2, 0);
  });
})();
