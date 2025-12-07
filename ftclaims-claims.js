// ===============================
// ftclaims-claims.js
// Logica riutilizzabile per la TIPOLGIA dei claims
// ===============================

/**
 * Inizializza i controlli per la tipologia claim in base
 * al tipo di ClaimCard:
 *
 *  - Warranty   -> combobox con: RSA, Garanzia, Garanzia Ricambio
 *  - Maintenance -> tipologia fissa: Manutenzione
 *  - FSA         -> tipologia fissa: FSA
 *  - Goodwill    -> tipologia fissa: Goodwill
 *
 * @param {string} cardType - Tipo di claim card ("Warranty" | "Maintenance" | "FSA" | "Goodwill")
 * @param {object} ids - (opzionale) Override degli ID HTML
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

  // Reset di base
  container.style.display = "none";
  select.innerHTML = "";
  fixed.value = "";

  switch (cardType) {
    case "Warranty": {
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

    case "Maintenance":
      fixed.value = "Manutenzione";
      break;

    case "FSA":
      fixed.value = "FSA";
      break;

    case "Goodwill":
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
 * @param {string} cardType - Tipo di ClaimCard ("Warranty" | "Maintenance" | "FSA" | "Goodwill")
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

  if (cardType === "Warranty") {
    return select.value || null;
  } else {
    return fixed.value || null;
  }
}
