// ===============================
// FT TOPBAR (GLOBAL INJECTION) v2
// - Titolo pagina da <html data-ft-title> o <title>
// - Bottone Home (sparisce su FTHUBAS)
// - Riga meta (Utente • Dealer • Ruolo) impostabile dalle pagine
//   tramite window.FTTopbar.setMeta("...") oppure evento "ft:setMeta"
// ===============================
(function () {
  const body = document.body;
  if (!body) return;

  // evita doppioni
  if (document.querySelector(".ft-topbar")) return;

  // assicura spacer per non coprire contenuti
  body.classList.add("has-topbar");

  // titolo pagina
  const pageTitle =
    (document.documentElement.getAttribute("data-ft-title") || "").trim() ||
    (document.title || "").trim() ||
    "Pagina";

  // costruisci topbar
  const bar = document.createElement("div");
  bar.className = "ft-topbar";
  bar.innerHTML = `
    <div class="ft-topbar__inner">
      <div class="ft-topbar__left">
        <div class="ft-topbar__brand">FTI-HUB</div>
        <div class="ft-topbar__subtitle">${escapeHtml(pageTitle)}</div>
        <div class="ft-topbar__meta" id="ftTopbarMeta" style="display:none;"></div>
      </div>

      <a href="/FTI-HUB/FTHUBAS.html" class="ft-home-btn" id="ftHomeBtn">🏠 Home</a>
    </div>
  `;

  body.insertBefore(bar, body.firstChild);

  // nascondi Home se sei già su FTHUBAS
  const path = (location.pathname || "").toLowerCase();
  if (path.endsWith("/fthubas.html")) {
    const homeBtn = document.getElementById("ftHomeBtn");
    if (homeBtn) homeBtn.style.display = "none";
  }

  // API globale
  window.FTTopbar = window.FTTopbar || {};

  window.FTTopbar.setMeta = function (text) {
    const el = document.getElementById("ftTopbarMeta");
    if (!el) return;

    const t = (text || "").toString().trim();
    if (!t) {
      el.textContent = "";
      el.style.display = "none";
      return;
    }

    el.textContent = t;
    el.style.display = "block";
  };

  window.FTTopbar.setTitle = function (title) {
    const sub = bar.querySelector(".ft-topbar__subtitle");
    if (!sub) return;
    sub.textContent = (title || "").toString().trim() || "Pagina";
  };

  // supporto via evento (utile se vuoi standardizzare)
  window.addEventListener("ft:setMeta", (ev) => {
    try {
      const text = ev && ev.detail && typeof ev.detail.text !== "undefined" ? ev.detail.text : "";
      window.FTTopbar.setMeta(text);
    } catch (_) {}
  });

  // util
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
