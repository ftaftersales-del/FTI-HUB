// ===============================
// FT TOPBAR (GLOBAL INJECTION)
// + Slot user info aggiornabile
//   - window.__ftUserInfo (pending)
//   - window.FTSetUserInfo(text)
//   - event: "ft:userinfo"
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

  // setter interno (DOM)
  function applyUserInfo(text) {
    const el = document.getElementById("ftUserInfo");
    if (!el) return;
    el.textContent = (text || "").toString();
  }

  // API globale robusta:
  // - salva sempre pending su window.__ftUserInfo
  // - se la barra è pronta, scrive anche nel DOM
  window.FTSetUserInfo = function (text) {
    window.__ftUserInfo = (text || "").toString();
    applyUserInfo(window.__ftUserInfo);
  };

  // 1) se la pagina ha già impostato pending prima del load della topbar
  if (typeof window.__ftUserInfo === "string" && window.__ftUserInfo.trim()) {
    applyUserInfo(window.__ftUserInfo);
  }

  // 2) ascolta eventi (fallback utile se vuoi usarli)
  window.addEventListener("ft:userinfo", function (ev) {
    try {
      const txt = ev && ev.detail && typeof ev.detail.text === "string" ? ev.detail.text : "";
      if (txt) window.FTSetUserInfo(txt);
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
