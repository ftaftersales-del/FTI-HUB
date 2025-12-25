// ===============================
// FT TOPBAR (GLOBAL INJECTION)
// + Slot user info aggiornabile: window.FTSetUserInfo(...)
// ===============================
(function () {
  const body = document.body;
  if (!body) return;

  // evita doppioni
  if (document.querySelector(".ft-topbar")) return;

  // classi globali
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
      </div>

      <div class="ft-topbar__center">
        <div class="ft-topbar__userinfo" id="ftUserInfo"></div>
      </div>

      <div class="ft-topbar__right">
        <a href="/FTI-HUB/FTHUBAS.html" class="ft-home-btn">🏠 Home</a>
      </div>
    </div>
  `;

  // inserisci in cima al body
  body.insertBefore(bar, body.firstChild);

  // nascondi home se sei già su FTHUBAS
  const path = (location.pathname || "").toLowerCase();
  if (path.endsWith("/fthubas.html")) {
    const homeBtn = bar.querySelector(".ft-home-btn");
    if (homeBtn) homeBtn.style.display = "none";
  }

  // API globale per impostare la user line in topbar
  window.FTSetUserInfo = function (text) {
    const el = document.getElementById("ftUserInfo");
    if (!el) return;
    el.textContent = (text || "").toString();
  };

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
