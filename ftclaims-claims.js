// ===============================
// ftclaims-claims.js
// Logica riutilizzabile per la TIPOLOGIA dei claims
// ===============================

/**
 * Normalizza il tipo di ClaimCard in MAIUSCOLO senza spazi.
 * Es: "Warranty" → "WARRANTY"
 */
function normalizeCardType(cardType) {
  const normalized = (cardType || '').toString().trim().toUpperCase();
  console.log('[ftclaims-claims] normalizeCardType:', cardType, '=>', normalized);
  return normalized;
}

/**
 * Inizializza i controlli per la tipologia claim in base
 * al tipo di ClaimCard:
 *
 *  - WARRANTY / FULL LINE / DRIVE LINE -> combobox con: (vuoto), RSA, Garanzia, Garanzia Ricambio
 *  - MAINTENANCE                       -> tipologia fissa: Manutenzione
 *  - FSA                               -> tipologia fissa: FSA
 *  - GOODWILL                          -> tipologia fissa: Goodwill
 *
 *  ids.containerId  = id del contenitore del select (combo tipi claim)
 *  ids.selectId     = id del <select> per la tipologia claim
 *  ids.fixedId      = id dell'<input> (o hidden) per la tipologia fissa
 */
function initClaimTypeControls(cardType, ids = {}) {
  console.log('[ftclaims-claims] initClaimTypeControls chiamata con:', cardType);

  const containerId = ids.containerId || 'claimTypeContainer';
  const selectId    = ids.selectId    || 'claimType';
  const fixedId     = ids.fixedId     || 'fixedClaimType';

  const container = document.getElementById(containerId);
  const select    = document.getElementById(selectId);
  const fixed     = document.getElementById(fixedId);

  if (!container || !select || !fixed) {
    console.error('[ftclaims-claims] initClaimTypeControls: elementi HTML mancanti.', {
      containerId,
      selectId,
      fixedId
    });
    return;
  }

  const type = normalizeCardType(cardType);
  console.log('[ftclaims-claims] tipo normalizzato:', type);

  // Reset di base
  container.style.display = 'none';
  select.innerHTML = '';
  fixed.value = '';

  // Utility per aggiungere l'opzione "Seleziona..."
  function addPlaceholderOption(sel) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Seleziona...';
    sel.appendChild(opt);
  }

  // Trattiamo WARRANTY, FULL LINE e DRIVE LINE allo stesso modo
  if (type === 'WARRANTY' || type === 'FULL LINE' || type === 'DRIVE LINE') {
    container.style.display = 'block';

    // Opzione placeholder
    addPlaceholderOption(select);

    const warrantyOptions = [
      'RSA',
      'Garanzia',
      'Garanzia Ricambio'
    ];

    warrantyOptions.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });

    console.log('[ftclaims-claims] opzioni WARRANTY/FL/DL impostate:', warrantyOptions);

  } else if (type === 'MAINTENANCE') {
    fixed.value = 'Manutenzione';
    console.log('[ftclaims-claims] tipo fisso: Manutenzione');

  } else if (type === 'FSA') {
    fixed.value = 'FSA';
    console.log('[ftclaims-claims] tipo fisso: FSA');

  } else if (type === 'GOODWILL') {
    fixed.value = 'Goodwill';
    console.log('[ftclaims-claims] tipo fisso: Goodwill');

  } else {
    console.error(
      '[ftclaims-claims] Tipo di ClaimCard non riconosciuto in initClaimTypeControls:',
      cardType,
      '=> normalizzato:',
      type
    );
  }
}

/**
 * Restituisce la tipologia di claim da salvare,
 * in base al tipo di ClaimCard.
 *
 * Per WARRANTY / FULL LINE / DRIVE LINE:
 *   -> usa il valore selezionato nella combobox (può essere null se non selezionato)
 *
 * Per MAINTENANCE / FSA / GOODWILL:
 *   -> usa il valore nel campo "fixedClaimType"
 */
function getCurrentClaimType(cardType, ids = {}) {
  const containerId = ids.containerId || 'claimTypeContainer';
  const selectId    = ids.selectId    || 'claimType';
  const fixedId     = ids.fixedId     || 'fixedClaimType';

  const container = document.getElementById(containerId);
  const select    = document.getElementById(selectId);
  const fixed     = document.getElementById(fixedId);

  if (!container || !select || !fixed) {
    console.error('[ftclaims-claims] getCurrentClaimType: elementi HTML mancanti.', {
      containerId,
      selectId,
      fixedId
    });
    return null;
  }

  const type = normalizeCardType(cardType);

  if (type === 'WARRANTY' || type === 'FULL LINE' || type === 'DRIVE LINE') {
    console.log('[ftclaims-claims] getCurrentClaimType (WARRANTY/FL/DL):', select.value);
    return select.value || null;
  } else {
    console.log('[ftclaims-claims] getCurrentClaimType (fisso):', fixed.value);
    return fixed.value || null;
  }
}
