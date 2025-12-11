/* ===============================
   Allegati generici + Note per claim
   + Dati generali (Ticket / Sinistro)
=============================== */

function addAttachmentsAndNotesSection(container, ctx) {
  if (typeof firebase === "undefined" ||
      !firebase.firestore || !firebase.storage) {
    return;
  }

  const db = firebase.firestore();
  const storage = firebase.storage();

  // ---------- DATI GENERALI CLAIM (TICKET / SINISTRO) ----------
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

  const claimDocRef = db
    .collection("ClaimCards")
    .doc(ctx.claimCardId)
    .collection("Claims")
    .doc(ctx.claimCode);

  let isDistributor = false;

  // Carico user info per capire se è distributore (dealer FT001)
  getCurrentUserInfo().then(function (info) {
    if (info && info.dealerId === "FT001") {
      isDistributor = true;
    } else {
      // se non è distributore, sinistro solo lettura
      if (sinistroInput) sinistroInput.disabled = true;
    }
  });

  // Precarico i valori di ticket / sinistro dal documento claim
  claimDocRef.get().then(function (snap) {
    if (!snap.exists) return;
    const d = snap.data() || {};
    if (ticketInput && d.ticket != null) {
      ticketInput.value = d.ticket;
    }
    if (sinistroInput && d.sinistro != null) {
      sinistroInput.value = d.sinistro;
    }
  }).catch(function (err) {
    console.warn("Errore lettura dati generali claim:", err);
  });

  if (saveGeneralBtn) {
    saveGeneralBtn.addEventListener("click", async function () {
      const ticketVal   = ticketInput ? ticketInput.value.trim()   : "";
      const sinistroVal = sinistroInput ? sinistroInput.value.trim() : "";

      const updateData = {
        ticket: ticketVal || null
      };

      if (isDistributor) {
        updateData.sinistro = sinistroVal || null;
      }

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
        if (!confirm('Vuoi eliminare l\'allegato "' + (item.name || "") + '"?')) {
          return;
        }
        try {
          if (item.path) {
            try {
              await storage.ref(item.path).delete();
            } catch (e) {
              console.warn("Errore cancellazione file Storage:", e);
            }
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
        items.push({
          id: doc.id,
          name: d.name || "",
          path: d.path || "",
          url: d.url || ""
        });
      });
      renderAttachmentsList(items);
    } catch (err) {
      console.error(err);
      attListDiv.textContent = "Errore nel caricamento degli allegati.";
    }
  }

  if (attUploadBtn) {
    attUploadBtn.addEventListener("click", async function () {
      const files = attFileInput.files;
      if (!files || !files.length) {
        alert("Seleziona almeno un file.");
        return;
      }

      attUploadBtn.disabled = true;
      try {
        const basePath =
          "ClaimCards/" + ctx.claimCardId + "/Claims/" + ctx.claimCode + "/Attachments/";
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
  }

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
      if (!author && d.authorDealerId) {
        author = d.authorDealerId;
      }

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

      header.textContent = author
        ? author + (when ? " (" + when + ")" : "")
        : (when || "");

      const body = document.createElement("div");
      body.textContent = d.text || "";

      line.appendChild(header);
      line.appendChild(body);
      notesListDiv.appendChild(line);
    });

    notesListDiv.scrollTop = notesListDiv.scrollHeight;
  }

  notesRef.orderBy("createdAt", "asc").onSnapshot(
    function (snap) {
      renderNotesSnapshot(snap);
    },
    function (err) {
      console.error("Errore onSnapshot Note:", err);
    }
  );

  if (noteSendBtn) {
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
}
