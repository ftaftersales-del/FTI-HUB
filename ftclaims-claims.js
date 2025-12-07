// ===============================
// ftclaims-claims.js
// Logica riutilizzabile per la TIPOLOGIA dei claims
// ===============================

function normalizeCardType(cardType) {
  return (cardType || '').toString().trim().toUpperCase();
}

/**
 * Inizializza i controlli per la tipologia claim in base
 * al tipo di ClaimCard:
 *
 *  - WARRANTY    -> combobox con: RSA, Garanzia, Garanzia Ricambio
 *  - MAINTENANCE -> tipologia fissa: Manutenzione
 *  - FSA         -> tipologia fissa: FSA
 *  - GOODWILL    -> tipologia fissa: Goodwill
 *
 * Accetta indifferentemente "Warranty" / "WARRANTY" ecc.
 */
function initClaimTypeControls(cardType, ids = {}) {
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

  // Reset di base
  container.style.display = "none";
  select.innerHTML = "";
  fixed.value = "";

  switch (type) {
    case "WARRANTY": {
      // Mostro la combobox
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

      break;
    }

    case "MAINTENANCE":
      fixed.value = "Manutenzione";
      break;

    case "FSA":
      fixed.value = "FSA";
      break;

    case "GOODWILL":
      fixed.value = "Goodwill";
      break;

    default:
      console.error("Tipo di ClaimCard non riconosciuto in initClaimTypeControls:", cardType);
  }
}

/**
 * Restituisce la tipologia di claim da salvare,
 * in base al tipo di ClaimCard.
 *
 * @param {string} cardType - Tipo di ClaimCard ("WARRANTY" | "MAINTENANCE" | "FSA" | "GOODWILL", anche in minuscolo/misto)
 * @param {object} ids - (opzionale) Override degli ID HTML
 * @returns {string|null} tipologia da salvare sul claim
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
    return select.value || null;
  } else {
    return fixed.value || null;
  }
}
