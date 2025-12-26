// ===============================
// FT TOPBAR (GLOBAL INJECTION) v3
// - Ford Blue topbar (inline injected CSS)
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

  // -------------------------------
  // Config / helpers
  // -------------------------------
  const pageTitle =
    (document.documentElement.getAttribute("data-ft-title") || "").trim() ||
    (document.title || "").trim() ||
    "Pagina";

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Calcola un base path robusto:
  // - se stai su /FTI-HUB/qualcosa -> usa /FTI-HUB
  // - altrimenti usa root
  function getHubBasePath() {
    const p = (location.pathname || "").replace(/\\/g, "/");
    const idx = p.toLowerCase().indexOf("/fti-hub/");
    if (idx >= 0) return p.slice(0, idx + "/fti-hub".length);
    return "";
  }

  const HUB_BASE = getHubBasePath();
  const HOME_HREF = (HUB_BASE || "") + "/FTHUBAS.html";

  // -------------------------------
  // Inject CSS (Ford Blue)
  // -------------------------------
  const style = document.createElement("style");
  style.setAttribute("data-ft-topbar-style", "1");
  style.textContent = `
    :root{
      --ft-ford-blue:#003478;
      --ft-ford-blue2:#002f6c;
      --ft-ford-blue-dark:#002a5c;
      --ft-topbar-h:58px;
    }

    body.has-topbar{
      padding-top: var(--ft-topbar-h);
    }

    .ft-topbar{
      position: fixed;
      left: 0;
      right: 0;
      top: 0;
      z-index: 1000;
      height: var(--ft-topbar-h);
      display: flex;
      align-items: center;
      background: linear-gradient(180deg, var(--ft-ford-blue) 0%, var(--ft-ford-blue2) 100%);
      color: #fff;
      border-bottom: 1px solid rgba(255,255,255,.14);
      box-shadow: 0 6px 18px rgba(0,0,0,.18);
    }

    .ft-topbar__inner{
      width: 100%;
      max-width: 1320px;
      margin: 0 auto;
      padding: 0 18px;
      display: grid;
      grid-template-columns: 1fr minmax(180px, 1fr) auto;
      align-items: center;
      gap: 12px;
    }

    .ft-topbar__left{
      display: flex;
      align-items: baseline;
      gap: 10px;
      min-width: 0;
    }

    .ft-topbar__brand{
      font-weight: 800;
      letter-spacing: .6px;
      font-size: 14px;
      text-transform: uppercase;
      opacity: .98;
      white-space: nowrap;
    }

    .ft-topbar__subtitle{
      font-weight: 600;
      font-size: 13px;
      opacity: .92;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 520px;
    }

    .ft-topbar__center{
      display: flex;
      justify-content: center;
      min-width: 0;
    }

    .ft-topbar__userinfo{
      font-size: 12.5px;
      opacity: .92;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 560px;
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.10);
      border-radius: 999px;
    }

    .ft-topbar__right{
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
    }

    .ft-home-btn{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.24);
      background: rgba(255,255,255,.12);
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      line-height: 1;
      user-select: none;
      transition: transform .12s ease, background .12s ease, border-color .12s ease;
    }

    .ft-home-btn:hover{
      background: rgba(255,255,255,.20);
      border-color: rgba(255,255,255,.34);
      transform: translateY(-1px);
    }

    .ft-home-btn:active{
      transform: translateY(0px);
    }

    .ft-home-btn:focus-visible{
      outline: 2px solid rgba(255,255,255,.85);
      outline-offset: 2px;
    }

    /* responsive */
    @media (max-width: 920px){
      .ft-topbar__inner{
        grid-template-columns: 1fr auto;
      }
      .ft-topbar__center{
        display: none;
      }
      .ft-topbar__subtitle{
        max-width: 360px;
      }
    }

    @media (max-width: 520px){
      .ft-topbar__subtitle{
        display: none;
      }
    }
  `;
  document.head.appendChild(style);

  // -------------------------------
  // Build DOM
  // -------------------------------
  const bar = document.createElement("div");
  bar.className = "ft-topbar";
  bar.innerHTML = `
    <div class="ft-topbar__inner">
      <div class="ft-topbar__left" title="${escapeHtml(pageTitle)}">
        <div class="ft-topbar__brand">FTI-HUB</div>
        <div class="ft-topbar__subtitle">${escapeHtml(pageTitle)}</div>
      </div>

      <div class="ft-topbar__center">
        <div class="ft-topbar__userinfo" id="ftUserInfo"></div>
      </div>

      <div class="ft-topbar__right">
        <a href="${HOME_HREF}" class="ft-home-btn" aria-label="Torna alla Home">
          <span aria-hidden="true">🏠</span>
          <span>Home</span>
        </a>
      </div>
    </div>
  `;

  body.insertBefore(bar, body.firstChild);

  // nascondi Home se già su FTHUBAS
  const path = (location.pathname || "").toLowerCase().replace(/\\/g, "/");
  if (path.endsWith("/fthubas.html")) {
    const homeBtn = bar.querySelector(".ft-home-btn");
    if (homeBtn) homeBtn.style.display = "none";
  }

  // -------------------------------
  // API + compat + event bridge
  // -------------------------------
  function setMeta(text) {
    const el = document.getElementById("ftUserInfo");
    if (!el) return;
    el.textContent = (text || "").toString();
    // se è vuoto, rendilo meno "presente"
    el.style.visibility = el.textContent.trim() ? "visible" : "hidden";
  }

  // API preferita
  window.FTTopbar = window.FTTopbar || {};
  window.FTTopbar.setMeta = setMeta;

  // Compat con API precedente
  window.FTSetUserInfo = setMeta;

  // Event bridge
  window.addEventListener("ft:setMeta", (ev) => {
    try {
      const txt = ev && ev.detail ? ev.detail.text : "";
      setMeta(txt);
    } catch (_) {}
  });

  // default: nascondi se non impostato
  setMeta("");
})();
