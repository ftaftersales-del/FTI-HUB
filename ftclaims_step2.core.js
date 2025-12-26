/* ===============================
   ftclaims_step2.core.js
   - Boot + ClaimCard + Claims list
   - Dipendenze: firebase compat, ftclaims-claimforms.js
   - Usa ftclaims_step2.servicecontract.js per SERVICE CONTRACT
   =============================== */

(function () {

  // ---------- UI helpers ----------
  function banner(type, msg) {
    const b = document.getElementById("banner");
    if (!b) return;

    b.style.display = "block";
    b.className = "section";

    if (type === "success") {
      b.style.borderColor = "var(--ok-bd)";
      b.style.background = "rgba(233,255,240,.60)";
      b.style.color = "var(--ok-tx)";
    } else if (type === "warn") {
      b.style.borderColor = "var(--warn-bd)";
      b.style.background = "rgba(255,247,237,.65)";
      b.style.color = "var(--warn-tx)";
    } else if (type === "error") {
      b.style.borderColor = "var(--err-bd)";
      b.style.background = "rgba(255,241,242,.65)";
      b.style.color = "var(--err-tx)";
    } else {
      b.style.borderColor = "var(--border)";
      b.style.background = "var(--surface-3)";
      b.style.color = "var(--text)";
    }

    b.innerHTML = msg || "";
  }

  function pad3(n) { return String(n).padStart(3, "0"); }
  function safeStr(v) { return (v == null) ? "" : String(v); }
  function normalizeType(t) { return (t || "").toString().trim().toUpperCase(); }

  function fmtDateISO(iso) {
    if (!iso) return "";
    try {
      if (typeof iso === "string" && iso.length >= 10 && iso.includes("-")) return iso.slice(0,10);
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().slice(0,10);
    } catch { return ""; }
  }

  function parseDateLoose(v) {
    try {
      if (!v) return null;
      if (typeof v === "string") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      if (typeof v === "number") {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      }
      if (v && typeof v.toDate === "function") {
        const d = v.toDate();
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    } catch { return null; }
  }

  function diffMonths(a, b) {
    if (!a || !b) return null;
    const ay = a.getFullYear(), am = a.getMonth();
    const by = b.getFullYear(), bm = b.getMonth();
    return (by - ay) * 12 + (bm - am);
  }

  function mapOptionKeyToLabel(key) {
    const k = normalizeType(key).replace(/\s+/g, "");
    if (k === "BATTERIE") return "Batterie";
    if (k === "FUSIBILI/LAMPADINE" || k === "FUSIBILI_LAMPADINE" || k === "FUSIBILILAMPADINE") return "Fusibili / Lampadine";
    if (k === "PARTIDIUSURA" || k === "PARTIUSURA" || k === "PARTI_DI_USURA") return "Parti di Usura";
    if (k === "PULIZIAFAP/DPF" || k === "PULIZIAFAPDPF" || k === "PULIZIA_FAP_DPF") return "Pulizia FAP/DPF";
    if (k === "RABBOCCOOLIO" || k === "RABBOCCO_OLIO") return "Rabbocco Olio";
    if (k === "TERGICRISTALLO" || k === "TERGICRISTALLI") return "Tergicristallo";
    if (k === "UPTIMESERVICE" || k === "UPTIME_SERVICE") return "Uptime Service";
    return key;
  }

  function normalizeOptionKey(key) {
    return (key || "").toString().trim();
  }

  function getServiceOptionsFromMaintenanceContract(sc) {
    const out = [];
    if (!sc) return out;
    const raw = sc.options;
    if (!raw) return out;

    if (typeof raw === "string") {
      const s = raw.trim();
      if (!s) return out;

      if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
        try {
          const parsed = JSON.parse(s);
          return getServiceOptionsFromMaintenanceContract({ options: parsed });
        } catch (e) {}
      }

      s.split(/[,;\n]/g).map(x => x.trim()).filter(Boolean).forEach(x => out.push(x));
      return Array.from(new Set(out));
    }

    if (Array.isArray(raw)) {
      raw.map(x => (x == null ? "" : String(x).trim())).filter(Boolean).forEach(x => out.push(x));
      return Array.from(new Set(out));
    }

    if (typeof raw === "object") {
      Object.keys(raw).forEach(k => {
        const v = raw[k];
        if (v === true || v === "true" || v === 1 || v === "1" || v === "YES" || v === "Yes") out.push(k);
      });
      return Array.from(new Set(out));
    }

    return out;
  }

  // ---------- Firebase ----------
  if (typeof firebase === "undefined") {
    banner("error", "Errore: Firebase non caricato.");
    return;
  }

  const auth = window.auth || firebase.auth();
  const db = window.db || firebase.firestore();
  const storage = firebase.storage();
  window.auth = auth;
  window.db = db;

  // ---------- getUserInfo (LaborRateStd) ----------
  async function getUserInfo(db, auth) {
    const u = auth.currentUser;
    if (!u) return { uid:null, name:null, dealerId:null, laborRateStd:null };

    let name = u.displayName || u.email || u.uid;
    let dealerId = null;
    let laborRateStd = null;

    try {
      const snap = await db.collection("Users").doc(u.uid).get();
      if (snap.exists) {
        const d = snap.data() || {};
        dealerId = d.dealerId || d.DealerID || d.dealerID || d.DealerId || null;
        name = d.displayName || d.fullName || d.name || name;
      }
    } catch(e) {}

    if (dealerId) {
      try {
        const dSnap = await db.collection("dealers").doc(String(dealerId)).get();
        if (dSnap.exists) {
          const dd = dSnap.data() || {};
          const raw = dd.LaborRateStd;
          if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
            const s = String(raw).replace(",", ".").replace(/[^\d.\-]/g, "");
            const n = parseFloat(s);
            laborRateStd = isNaN(n) ? null : n;
          }
        }
      } catch(e) {}
    }

    return { uid: u.uid, name, dealerId, laborRateStd };
  }

  // ---------- DOM refs ----------
  const ui = {
    code: document.getElementById("ui_code"),
    type: document.getElementById("ui_type"),
    openDate: document.getElementById("ui_openDate"),
    orderDate: document.getElementById("ui_orderDate"),
    openUser: document.getElementById("ui_openUser"),
    openDealer: document.getElementById("ui_openDealer"),
    status: document.getElementById("ui_status"),

    vin: document.getElementById("ui_vin"),
    customer: document.getElementById("ui_customer"),
    plate: document.getElementById("ui_plate"),
    regDate: document.getElementById("ui_regDate"),

    covType: document.getElementById("ui_covType"),
    covStart: document.getElementById("ui_covStart"),
    covEnd: document.getElementById("ui_covEnd"),
    covNotes: document.getElementById("ui_covNotes"),

    scStart: document.getElementById("ui_scStart"),
    scEnd: document.getElementById("ui_scEnd"),
    scOptions: document.getElementById("ui_scOptions"),

    km: document.getElementById("ui_km"),
    hours: document.getElementById("ui_hours"),
  };

  const btnHome = document.getElementById("btnHome");
  const btnSaveCard = document.getElementById("btnSaveCard");
  const btnCancelCard = document.getElementById("btnCancelCard");

  const newClaimType = document.getElementById("newClaimType");
  const btnCreateClaim = document.getElementById("btnCreateClaim");
  const btnDoCreateClaim = document.getElementById("btnDoCreateClaim");
  const claimsList = document.getElementById("claimsList");

  // ---------- State ----------
  let claimId = null;
  let claimCard = null;
  let currentUser = null;

  // ---------- Navigation ----------
  btnHome?.addEventListener("click", () => window.location.href = "FTHUBAS.html");

  // ---------- Load claimId from sessionStorage ----------
  function resolveClaimId() {
    const direct = sessionStorage.getItem("ftclaims_claimCode");
    if (direct) return direct;

    const s = sessionStorage.getItem("currentClaimStep1");
    if (s) {
      try {
        const obj = JSON.parse(s);
        if (obj && obj.claimId) return obj.claimId;
      } catch (e) {}
    }
    return null;
  }

  // ---------- Create claim types ----------
  function allowedClaimTypesByCardType(cardType) {
    const ct = normalizeType(cardType);

    if (ct === "SERVICE CONTRACT") {
      const out = [
        { value: "__SC_MANUTENZIONE__", label: "Manutenzione" },
        { value: "__SC_TRAINO__", label: "Traino" }
      ];

      const sc = (claimCard && claimCard.maintenanceContract) ? claimCard.maintenanceContract : {};
      const opts = getServiceOptionsFromMaintenanceContract(sc);

      opts.forEach(k => {
        const key = normalizeOptionKey(k);
        if (!key) return;
        out.push({ value: "__SC_OPTION__|" + key, label: "Opzioni - " + mapOptionKeyToLabel(key) });
      });

      return out;
    }

    if (ct === "WARRANTY") {
      return [
        { value: "GARANZIA", label: "Garanzia" },
        { value: "GARANZIA RICAMBIO", label: "Garanzia Ricambio" },
        { value: "RSA", label: "RSA" }
      ];
    }

    if (ct === "FSA") {
      return [
        { value: "FSA", label: "FSA" },
        { value: "RSA", label: "RSA" },
        { value: "GOODWILL", label: "Goodwill" }
      ];
    }

    if (ct === "GOODWILL") {
      return [
        { value: "GOODWILL", label: "Goodwill" },
        { value: "RSA", label: "RSA" }
      ];
    }

    if (ct === "PDI") {
      return [{ value: "PDI", label: "PDI" }];
    }

    return [
      { value: "RSA", label: "RSA" },
      { value: "GARANZIA", label: "Garanzia" }
    ];
  }

  function fillCreateClaimOptions(cardType) {
    const allowed = allowedClaimTypesByCardType(cardType);

    newClaimType.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "-- Seleziona tipologia claim --";
    opt0.disabled = true;
    opt0.selected = true;
    newClaimType.appendChild(opt0);

    allowed.forEach(x => {
      const o = document.createElement("option");
      o.value = x.value;
      o.textContent = x.label;
      newClaimType.appendChild(o);
    });
  }

  // ---------- ClaimCard CRUD ----------
  async function loadClaimCard() {
    const snap = await db.collection("ClaimCards").doc(claimId).get();
    if (!snap.exists) throw new Error("ClaimCard non trovata: " + claimId);
    claimCard = snap.data() || {};
    return claimCard;
  }

  function renderClaimCard() {
    ui.code.value = claimCard.code || claimId || "";
    ui.type.value = claimCard.type || "";
    ui.openDate.value = fmtDateISO(claimCard.openDate);
    ui.orderDate.value = fmtDateISO(claimCard.orderDate);
    ui.openUser.value = claimCard.openUser || "";
    ui.openDealer.value = claimCard.openDealer || "";
    ui.status.value = claimCard.status || "Aperta";

    const v = claimCard.vehicle || {};
    ui.vin.value = v.vin || "";
    ui.customer.value = v.customer || "";
    ui.plate.value = v.registrationPlate || "";
    ui.regDate.value = fmtDateISO(v.registrationDate);

    const cov = claimCard.coverage || {};
    ui.covType.value = cov.type || "";
    ui.covStart.value = fmtDateISO(cov.startDate);
    ui.covEnd.value = fmtDateISO(cov.endDate);
    ui.covNotes.value = cov.notes || "";

    const sc = claimCard.maintenanceContract || {};
    ui.scStart.value = fmtDateISO(sc.startDate);
    ui.scEnd.value = fmtDateISO(sc.endDate);
    ui.scOptions.value = sc.options || "";

    ui.km.value = (claimCard.km != null) ? claimCard.km : "";
    ui.hours.value = (claimCard.engineHours != null) ? claimCard.engineHours : "";

    fillCreateClaimOptions(claimCard.type);
  }

  btnSaveCard?.addEventListener("click", async () => {
    if (!claimId) return;
    try {
      btnSaveCard.disabled = true;

      const updateObj = {
        status: ui.status.value || "Aperta",
        km: ui.km.value === "" ? null : parseInt(ui.km.value, 10),
        engineHours: ui.hours.value === "" ? null : parseInt(ui.hours.value, 10),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("ClaimCards").doc(claimId).update(updateObj);
      banner("success", "Modifiche salvate.");
    } catch (e) {
      console.error(e);
      banner("error", "Errore salvataggio: " + (e.message || e));
    } finally {
      btnSaveCard.disabled = false;
    }
  });

  btnCancelCard?.addEventListener("click", async () => {
    if (!claimId) return;
    if (!confirm("Vuoi cancellare la richiesta? (Stato = Cancellata)")) return;

    try {
      btnCancelCard.disabled = true;
      await db.collection("ClaimCards").doc(claimId).update({
        status: "Cancellata",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      banner("success", "Richiesta impostata su Cancellata.");
      ui.status.value = "Cancellata";
    } catch (e) {
      console.error(e);
      banner("error", "Errore cancellazione: " + (e.message || e));
    } finally {
      btnCancelCard.disabled = false;
    }
  });

  // ---------- Claims list ----------
  async function getNextRepairCode() {
    const snap = await db.collection("ClaimCards").doc(claimId).collection("Claims")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    let maxIdx = 0;
    snap.forEach(doc => {
      const d = doc.data() || {};
      const ri = (typeof d.repairIndex === "number") ? d.repairIndex : null;
      if (ri != null && ri > maxIdx) maxIdx = ri;
      if (ri == null && doc.id && /^R\d{3}$/.test(doc.id)) {
        const n = parseInt(doc.id.slice(1), 10);
        if (!isNaN(n) && n > maxIdx) maxIdx = n;
      }
    });

    const next = maxIdx + 1;
    return { repairIndex: next, repairCode: "R" + pad3(next) };
  }

  function getFullLineStartDateForTowBlock() {
    const cov = claimCard && claimCard.coverage ? claimCard.coverage : {};
    const v = claimCard && claimCard.vehicle ? claimCard.vehicle : {};
    return parseDateLoose(cov.startDate) || parseDateLoose(v.registrationDate) || null;
  }

  async function createClaim() {
    const t = newClaimType.value;
    if (!t) { alert("Seleziona una tipologia claim."); return; }

    const cardType = normalizeType(claimCard && claimCard.type);

    let realClaimType = t;
    let serviceOptionPayload = null;

    if (cardType === "SERVICE CONTRACT") {
      if (t === "__SC_MANUTENZIONE__") {
        realClaimType = "SERVICE CONTRACT";
      } else if (t === "__SC_TRAINO__") {
        const start = getFullLineStartDateForTowBlock();
        const now = new Date();
        const months = diffMonths(start, now);

        if (!start) {
          alert("Impossibile verificare i 24 mesi (manca data Full Line start).");
          return;
        }
        if (months != null && months < 24) {
          alert("Nei primi 24 mesi dall’immatricolazione (Full Line start) il traino va aperto come normale claim card WARRANTY. Creazione inibita.");
          return;
        }
        realClaimType = "RSA";
      } else if (t.startsWith("__SC_OPTION__|")) {
        realClaimType = "SERVICE OPTION";
        const key = t.split("|")[1] || "";
        serviceOptionPayload = { key: key, label: mapOptionKeyToLabel(key) };
      } else {
        alert("Tipologia non valida per Service Contract.");
        return;
      }
    }

    const { repairIndex, repairCode } = await getNextRepairCode();
    const vin = (claimCard && claimCard.vehicle && claimCard.vehicle.vin) ? String(claimCard.vehicle.vin) : null;

    const docData = {
      claimType: realClaimType,
      repairIndex,
      status: "Aperto",
      vin: vin || null,
      claimCardType: claimCard.type || null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByUid: currentUser.uid || null,
      createdByName: currentUser.name || null,
      createdByDealerId: currentUser.dealerId || null
    };

    if (serviceOptionPayload) docData.serviceOption = serviceOptionPayload;

    await db.collection("ClaimCards").doc(claimId).collection("Claims").doc(repairCode).set(docData);
    banner("success", `Riparazione ${repairCode} (${docData.claimType}) creata.`);
  }

  btnCreateClaim?.addEventListener("click", () => {
    document.getElementById("createBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  btnDoCreateClaim?.addEventListener("click", async () => {
    try {
      btnDoCreateClaim.disabled = true;
      await createClaim();
    } catch (e) {
      console.error(e);
      banner("error", "Errore creazione claim: " + (e.message || e));
    } finally {
      btnDoCreateClaim.disabled = false;
    }
  });

  function toggleClaimBody(bodyEl, btnEl) {
    const isHidden = bodyEl.style.display === "none";
    bodyEl.style.display = isHidden ? "block" : "none";
    btnEl.textContent = isHidden ? "Nascondi dettagli" : "Mostra dettagli";
  }

  // ---------- Render a single claim item ----------
  function renderClaimItem(repairCode, claimData) {
    const wrapper = document.createElement("div");
    wrapper.className = "claimItem";

    const title = `Riparazione ${repairCode} (${claimData.claimType || "?"})`;
    const status = claimData.status || "Aperto";

    const top = document.createElement("div");
    top.className = "claimItemTop";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="claimTitle">${title}</div>
      <div class="claimMeta">Stato: ${status}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "row";

    const btnToggle = document.createElement("button");
    btnToggle.className = "btn btn-small";
    btnToggle.type = "button";
    btnToggle.textContent = "Nascondi dettagli";

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn-danger btn-small";
    btnDelete.type = "button";
    btnDelete.textContent = "Elimina riparazione";

    actions.appendChild(btnToggle);
    actions.appendChild(btnDelete);

    top.appendChild(left);
    top.appendChild(actions);

    const body = document.createElement("div");
    body.className = "claimBody";

    const inner = document.createElement("div");
    inner.className = "rightTopBox";
    body.appendChild(inner);

    wrapper.appendChild(top);
    wrapper.appendChild(body);

    btnToggle.addEventListener("click", () => toggleClaimBody(body, btnToggle));

    btnDelete.addEventListener("click", async () => {
      if (!confirm(`Vuoi eliminare ${repairCode}?`)) return;
      try {
        await db.collection("ClaimCards").doc(claimId).collection("Claims").doc(repairCode).delete();
        banner("success", "Riparazione eliminata.");
      } catch(e) {
        console.error(e);
        banner("error", "Errore eliminazione: " + (e.message || e));
      }
    });

    const ct = normalizeType(claimData.claimType);
    const ctx = { claimCardId: claimId, claimCode: repairCode };
    const isDistributor = (currentUser && String(currentUser.dealerId) === "FT001");

    // SERVICE CONTRACT: renderer esterno
    if (ct === "SERVICE CONTRACT" && typeof window.FTSTEP2_renderServiceContractDetails === "function") {
      window.FTSTEP2_renderServiceContractDetails({
        container: inner,
        claimDoc: claimData,
        ctx,
        isDistributor,
        db,
        storage,
        claimCard,
        currentUser,
        banner
      });
    } else {
      // altri renderer: ftclaims-claimforms.js
      if (typeof window.renderClaimDetails === "function") {
        window.renderClaimDetails(claimData.claimType, inner, claimData, ctx);
      } else {
        inner.innerHTML = `<div class="muted">Renderer non disponibile per questa tipologia.</div>`;
      }
    }

    return wrapper;
  }

  // ---------- Listen claims ----------
  function listenClaims() {
    const ref = db.collection("ClaimCards").doc(claimId).collection("Claims").orderBy("repairIndex", "asc");
    ref.onSnapshot((snap) => {
      claimsList.innerHTML = "";
      if (snap.empty) {
        claimsList.innerHTML = `<div class="mutedBox">Nessun claim presente. Usa “Crea claim”.</div>`;
        return;
      }
      snap.forEach(doc => {
        claimsList.appendChild(renderClaimItem(doc.id, doc.data() || {}));
      });
    }, (e) => {
      console.error(e);
      banner("error", "Errore caricamento claims: " + (e.message || e));
    });
  }

  // ---------- Boot ----------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      banner("error", "Utente non autenticato. Reindirizzamento…");
      setTimeout(() => window.location.href = "index.html", 1200);
      return;
    }

    try {
      claimId = resolveClaimId();
      if (!claimId) {
        banner("error", "Nessuna claim card in sessione (manca ftclaims_claimCode). Torna allo STEP1.");
        return;
      }

      currentUser = await getUserInfo(db, auth);

      // userinfo topbar
      const uEl = document.getElementById("topbarUserInfo");
      if (uEl) {
        const dealer = currentUser?.dealerId ? String(currentUser.dealerId) : "";
        const name = currentUser?.name ? String(currentUser.name) : "";
        uEl.textContent = (name || dealer) ? `${name}${dealer ? " • " + dealer : ""}` : "";
      }

      // tariffa globale (serve anche a ftclaims-claimforms.js)
      window.LABOR_RATE_STD = (currentUser && currentUser.laborRateStd != null) ? currentUser.laborRateStd : null;

      await loadClaimCard();
      renderClaimCard();

      listenClaims();
      banner("success", "Pratica caricata correttamente.");
    } catch (e) {
      console.error(e);
      banner("error", "Errore caricamento pratica: " + (e.message || e));
    }
  });

})();
