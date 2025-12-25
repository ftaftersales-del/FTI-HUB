// ===============================
// FT TOPBAR (GLOBAL INJECTION) v2
// - Inject topbar + spacer
// - Uniform home link to FTHUBAS
// - Safe title extraction
// ===============================

(function () {
  "use strict";

  // -----------------------------
  // Config
  // -----------------------------
  const HOME_HREF = "/FTI-HUB/FTHUBAS.html";
  const BRAND_TEXT = "FTI-HUB";
  const DEFAULT_TITLE = "Pagina";

  // -----------------------------
  // Boot
  // -----------------------------
  const body = document.body;
  if (!body) return;

  // Ensure body classes (keep existing, add missing)
  if (!body.classList.contains("ft-page")) body.classList.add("ft-page");

  // NOTE: con lo spacer non serve padding-top.
  // Manteniamo "has-topbar" solo come marker (se ti serve per debug),
  // ma NON dipendiamo da quella classe per lo spacing.
  if (!body.classList.contains("has-topbar")) body.classList.add("has-topbar");

  // Avoid duplicates
  if (document.querySelector(".ft-topbar")) return;

  // Title: data-ft-title > <title> > fallback
  const pageTitle = getPageTitle();

  // Build topbar
  const bar = document.createElement("div");
  bar.className = "ft-topbar";
  bar.setAttribute("role", "navigation");

  bar.innerHTML = `
    <div class="ft-topbar__inner">
      <div class="ft-topbar__left">
        <div class="ft-topbar__brand">${escapeHtml(BRAND_TEXT)}</div>
        <div class="ft-topbar__subtitle">${escapeHtml(pageTitle)}</div>
      </div>
      <a href="${HOME_HREF}" class="ft-home-btn" aria-label="Torna alla Home">🏠 Home</a>
    </div>
  `.trim();

  // Insert bar at top of body (safe position)
  const firstElement = firstMeaningfulNode(body);
  if (firstElement) body.insertBefore(bar, firstElement);
  else body.appendChild(bar);

  // Insert spacer right after bar (prevents content from being covered)
  if (!document.querySelector(".ft-topbar-spacer")) {
    const spacer = document.createElement("div");
    spacer.className = "ft-topbar-spacer";
    bar.insertAdjacentElement("afterend", spacer);
  }

  // Hide Home if already on FTHUBAS
  if (isOnHubas()) {
    const homeBtn = bar.querySelector(".ft-home-btn");
    if (homeBtn) homeBtn.style.display = "none";
  }

  // -----------------------------
  // Helpers
  // -----------------------------

  function getPageTitle() {
    const attr = (document.documentElement.getAttribute("data-ft-title") || "").trim();
    if (attr) return attr;

    const t = (document.title || "").trim();
    if (t) return t;

    return DEFAULT_TITLE;
  }

  function isOnHubas() {
    const path = (location.pathname || "").toLowerCase();
    return path.endsWith("/fthubas.html");
  }

  // Returns first node worth inserting before:
  // - skips empty text nodes and comments
  function firstMeaningfulNode(parent) {
    const nodes = parent.childNodes;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.nodeType === Node.ELEMENT_NODE) return n;
      if (n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "") return n;
      // skip comments and empty text
    }
    return null;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
