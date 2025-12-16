const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.getVinMaintenanceHistory = functions.https.onCall(async (data, context) => {
  // Auth obbligatoria
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Devi essere autenticato.");
  }

  const vinRaw = data && data.vin ? String(data.vin) : "";
  const vin = vinRaw.trim().toUpperCase();

  if (!vin || vin.length < 10) {
    throw new functions.https.HttpsError("invalid-argument", "VIN non valido.");
  }

  const db = admin.firestore();

  // 1) ClaimCards per VIN
  const cardsSnap = await db.collection("ClaimCards")
    .where("vehicle.vin", "==", vin)
    .get();

  const validCards = [];
  cardsSnap.forEach(doc => {
    const d = doc.data() || {};
    // ESCLUDI SOLO Cancellata
    if ((d.status || "") !== "Cancellata") {
      validCards.push({ id: doc.id, data: d });
    }
  });

  // 2) Per ogni card: Claims claimType == SERVICE CONTRACT (qualsiasi stato)
  const rows = [];

  for (const card of validCards) {
    const claimsSnap = await db.collection("ClaimCards").doc(card.id)
      .collection("Claims")
      .where("claimType", "==", "SERVICE CONTRACT")
      .get();

    claimsSnap.forEach(c => {
      const cd = c.data() || {};
      const sc = cd.serviceContract || {};

      rows.push({
        vin,

        claimCardId: card.id,
        claimCardCode: card.data.code || card.id,
        orderDate: card.data.orderDate || null,
        km: (typeof card.data.km === "number") ? card.data.km : (card.data.km ?? null),
        engineHours: (typeof card.data.engineHours === "number") ? card.data.engineHours : (card.data.engineHours ?? null),

        claimCode: c.id,
        claimStatus: cd.status || null,

        // tipo manutenzione: 1S / 1M / ecc
        maintenanceKey: sc.key || null,
        maintenanceLabel: sc.label_it || null,

        // per righe: passiamo serviceContract così la pagina può fare fallback template se serve
        serviceContract: {
          family: sc.family || null,
          key: sc.key || null,
          label_it: sc.label_it || null,
          templateDocId: sc.templateDocId || null,
          voith: sc.voith === true,
          // opzionale: se in futuro salvi righe dealer-side in sc.labourDealer/sc.partsDealer
          labourDealer: Array.isArray(sc.labourDealer) ? sc.labourDealer : null,
          partsDealer: Array.isArray(sc.partsDealer) ? sc.partsDealer : null
        }
      });
    });
  }

  // Ordina: più recente prima
  rows.sort((a, b) => {
    const da = a.orderDate ? String(a.orderDate) : "";
    const dbb = b.orderDate ? String(b.orderDate) : "";
    return da < dbb ? 1 : (da > dbb ? -1 : 0);
  });

  return {
    vin,
    cardsCount: validCards.length,
    rows
  };
});
