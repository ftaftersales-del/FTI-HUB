// ===============================
// FT TOPBAR (GLOBAL INJECTION) v2
// - Brand + titolo pagina
// - Slot user info centrale
// - API: window.FTTopbar.setMeta(text)
// - Compat: window.FTSetUserInfo(text)
// - Event: "ft:setMeta" {detail:{text}}
// ===============================
(function () {
  const body = document.body;
  if (!body) return;

  // evita doppioni
  if (document.querySelector(".ft-topbar")) return;

  body.classList.add("has-topbar");

  const pageTitle =
    (document.documentElement.getAttribute("data-ft-title") || "").trim() ||
    (document.title || "").trim() ||
    "Pagina";

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

  body.insertBefore(bar, body.firstChild);

  // nascondi Home se già su FTHUBAS
  const path = (location.pathname || "").toLowerCase();
  if (path.endsWith("/fthubas.html")) {
    const homeBtn = bar.querySelector(".ft-home-btn");
    if (homeBtn) homeBtn.style.display = "none";
  }

  function setMeta(text) {
    const el = document.getElementById("ftUserInfo");
    if (!el) return;
    el.textContent = (text || "").toString();
  }

  // API preferita
  window.FTTopbar = window.FTTopbar || {};
  window.FTTopbar.setMeta = setMeta;

  // Compat con la tua API precedente
  window.FTSetUserInfo = setMeta;

  // Event bridge (per chi dispatcha prima che la topbar sia pronta)
  window.addEventListener("ft:setMeta", (ev) => {
    try {
      const txt = ev && ev.detail ? ev.detail.text : "";
      setMeta(txt);
    } catch (e) {}
  });

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
