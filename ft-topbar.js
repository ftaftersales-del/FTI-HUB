// ===============================
// FT TOPBAR (GLOBAL INJECTION)
// ===============================
(function () {
  // 1) assicura classi body
  const body = document.body;
  if (!body) return;

  // Mantieni ft-page se già presente, aggiungi has-topbar
  if (!body.classList.contains("has-topbar")) body.classList.add("has-topbar");

  // 2) evita doppioni
  if (document.querySelector(".ft-topbar")) return;

  // 3) titolo pagina: usa <title> oppure data-ft-title se presente
  const pageTitle =
    (document.documentElement.getAttribute("data-ft-title") || "").trim() ||
    (document.title || "").trim() ||
    "Pagina";

  // 4) costruisci topbar
  const bar = document.createElement("div");
  bar.className = "ft-topbar";
  bar.innerHTML = `
    <div class="ft-topbar__inner">
      <div class="ft-topbar__left">
        <div class="ft-topbar__brand">FTI-HUB</div>
        <div class="ft-topbar__subtitle">${escapeHtml(pageTitle)}</div>
      </div>
      <a href="/FTI-HUB/FTHUBAS.html" class="ft-home-btn">🏠 Home</a>
    </div>
  `;

  // 5) inserisci subito dopo body start
  body.insertBefore(bar, body.firstChild);

  // 6) opzionale: nascondi home se sei già su FTHUBAS
  const path = (location.pathname || "").toLowerCase();
  if (path.endsWith("/fthubas.html")) {
    const homeBtn = bar.querySelector(".ft-home-btn");
    if (homeBtn) homeBtn.style.display = "none";
  }

  // Util
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
