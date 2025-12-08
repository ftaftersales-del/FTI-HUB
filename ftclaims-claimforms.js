async function loadCCCForSymptom(symptomId, selectedCCCId) {
  if (!cccSelect) return;
  cccSelect.innerHTML = "";

  const optEmpty = document.createElement("option");
  optEmpty.value = "";
  optEmpty.textContent = "Seleziona...";
  cccSelect.appendChild(optEmpty);

  if (!symptomId) return;

  try {
    console.log("[Garanzia] Carico CCC_Codes per Symptom:", symptomId);

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

    // Ordino per 'order' se presente
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

    console.log("[Garanzia] Caricati", docs.length, "CCC_Codes");
  } catch (err) {
    console.error("Errore caricamento CCC Codes:", err);
    alert("Errore nel caricamento dei CCC Codes: " + err.message);
  }
}
