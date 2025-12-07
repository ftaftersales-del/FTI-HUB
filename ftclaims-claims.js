// ===============================
// ftclaims-claims.js
// Logica riutilizzabile per la TIPOLOGIA dei claims
// ===============================

function normalizeCardType(cardType) {
  const normalized = (cardType || '').toString().trim().toUpperCase();
  console.log('[ftclaims-claims] normalizeCardType:', cardType, '=>', normalized);
  return normalized;
}

/**
 * Inizializza i controlli per la tipologia claim in base
 * al tipo di ClaimCard:
 *
 *  - WARRANTY    -> combobox con: RSA, Garanzia, Garanzia Ricambio
 *  - MAINTENANCE -> tipologia fissa: Manutenzione
 *  - FSA         -> tipologia fissa: FSA
 *  - GOODWILL    -> tipologia fissa: Goodwill
 */
function initClaimTypeControls(cardType, ids = {}) {
  console.log('[ftclaims-claims] initClaimTypeControls chiamata con:', cardType);

  const containerId = ids.containerId || "claimTypeContainer";
  const selectId = ids.selectId || "claimType";
  const fixedId = ids.fixedId || "fixedClaimType";

  const container = document.getElementById(containerId);
  const select = document.getElementById(selectId);
  const fixed = document.getElementById(fixedId);

  if (!container || !select || !fixed) {
    console.error("initClaimTypeControls: elementi HTML mancanti.", {
      containerId,
      selectId,
      fixedId
    });
    return;
  }

  const type = normalizeCardType(cardType);
  console.log('[ftclaims-claims] tipo normalizzato:', type);

  // Reset di base
  container.style.display = "none";
  select.innerHTML = "";
  fixed.value = "";

  switch (type) {
    case "WARRANTY": {
      container.style.display = "block";

      const warrantyOptions = [
        "RSA",
        "Garanzia",
        "Garanzia Ricambio"
      ];

      warrantyOptions.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      });

      console.log('[ftclaims-claims] opzioni WARRANTY impostate');
      break;
    }

    case "MAINTENANCE":
      fixed.value = "Manutenzione";
      console.log('[ftclaims-claims] tipo fisso: Manutenzione');
      break;

    case "FSA":
      fixed.value = "FSA";
      console.log('[ftclaims-claims] tipo fisso: FSA');
      break;

    case "GOODWILL":
      fixed.value = "Goodwill";
      console.log('[ftclaims-claims] tipo fisso: Goodwill');
      break;

    default:
      console.error("Tipo di ClaimCard non riconosciuto in initClaimTypeControls:", cardType, '=> normalizzato:', type);
  }
}

/**
 * Restituisce la tipologia di claim da salvare,
 * in base al tipo di ClaimCard.
 */
function getCurrentClaimType(cardType, ids = {}) {
  const containerId = ids.containerId || "claimTypeContainer";
  const selectId = ids.selectId || "claimType";
  const fixedId = ids.fixedId || "fixedClaimType";

  const container = document.getElementById(containerId);
  const select = document.getElementById(selectId);
  const fixed = document.getElementById(fixedId);

  if (!container || !select || !fixed) {
    console.error("getCurrentClaimType: elementi HTML mancanti.", {
      containerId,
      selectId,
      fixedId
    });
    return null;
  }

  const type = normalizeCardType(cardType);

  if (type === "WARRANTY") {
    console.log('[ftclaims-claims] getCurrentClaimType (WARRANTY):', select.value);
    return select.value || null;
  } else {
    console.log('[ftclaims-claims] getCurrentClaimType (fisso):', fixed.value);
    return fixed.value || null;
  }
}
