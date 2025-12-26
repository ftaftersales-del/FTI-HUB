// ===============================
// FT TOPBAR (GLOBAL INJECTION) v4
// Fix:
// - CSS Ford Blue sempre applicato (anche se la topbar è già in HTML)
// - Niente doppioni: se .ft-topbar esiste, la tematizza soltanto
// - setMeta aggancia #topbar-userline (FTHUBAS) o #ftUserInfo (inject)
// - Colori/leggibilità blindati contro ftstyle con !important
// ===============================
(function () {
  const body = document.body;
  if (!body) return;

  // ---------- helpers ----------
  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const pageTitle =
    (document.documentElement.getAttribute("data-ft-title") || "").trim() ||
    (document.title || "").trim() ||
    "Pagina";

  function getHubBasePath() {
    const p = (location.pathname || "").replace(/\\/g, "/");
    const low = p.toLowerCase();
    const idx = low.indexOf("/fti-hub/");
    if (idx >= 0) return p.slice(0, idx + "/fti-hub".length);
    return "";
  }

  const HUB_BASE = getHubBasePath();
  const HOME_HREF = (HUB_BASE || "") + "/FTHUBAS.html";

  // ---------- ensure CSS injected ALWAYS ----------
  (function ensureStyle() {
    if (document.querySelector('style[data-ft-topbar-style="1"]')) return;

    const style = document.createElement("style");
    style.setAttribute("data-ft-topbar-style", "1");
    style.textContent = `
      :root{
        --ft-ford-blue:#003478;
        --ft-ford-blue2:#002f6c;
        --ft-topbar-h:58px;
      }

      body.has-topbar{ padding-top: var(--ft-topbar-h) !important; }

      /* Tema Ford Blue applicabile sia a topbar injectata che a topbar già presente */
      .ft-topbar.ft-topbar--ford{
        position: fixed;
        left:0; right:0; top:0;
        z-index:9999;
        height: var(--ft-topbar-h);
        display:flex;
        align-items:center;
        background: linear-gradient(180deg, var(--ft-ford-blue) 0%, var(--ft-ford-blue2) 100%) !important;
        border-bottom: 1px solid rgba(255,255,255,.14);
        box-shadow: 0 6px 18px rgba(0,0,0,.18);
        color:#fff !important;
      }

      .ft-topbar.ft-topbar--ford,
      .ft-topbar.ft-topbar--ford *{
        color:#fff !important;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__inner{
        width: 100%;
        max-width: 1320px;
        margin: 0 auto;
        padding: 0 18px;
        display: grid;
        grid-template-columns: 1fr minmax(180px, 1fr) auto;
        align-items: center;
        gap: 12px;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__left{
        display:flex;
        align-items:baseline;
        gap:10px;
        min-width:0;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__brand{
        font-weight:800;
        letter-spacing:.6px;
        font-size:14px;
        text-transform:uppercase;
        white-space:nowrap;
        opacity:.98;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__subtitle{
        font-weight:600;
        font-size:13px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        max-width:520px;
        opacity:.88;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__center{
        display:flex;
        justify-content:center;
        min-width:0;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__userinfo{
        font-size:12.5px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        max-width:560px;
        padding:6px 10px;
        border:1px solid rgba(255,255,255,.18) !important;
        background: rgba(255,255,255,.10) !important;
        border-radius:999px;
        opacity:.92;
      }

      .ft-topbar.ft-topbar--ford .ft-topbar__right{
        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:10px;
      }

      /* Bottoni nella topbar: anche .btn di ftstyle vengono “ri-tematizzati” */
      .ft-topbar.ft-topbar--ford .btn,
      .ft-topbar.ft-topbar--ford button,
      .ft-topbar.ft-topbar--ford a{
        color:#fff !important;
      }

      .ft-topbar.ft-topbar--ford .btn,
      .ft-topbar.ft-topbar--ford button{
        background: rgba(255,255,255,.12) !important;
        border: 1px solid rgba(255,255,255,.24) !important;
      }

      .ft-topbar.ft-topbar--ford .btn:hover,
      .ft-topbar.ft-topbar--ford button:hover{
        background: rgba(255,255,255,.20) !important;
        border-color: rgba(255,255,255,.34) !important;
      }

      .ft-topbar.ft-topbar--ford .ft-home-btn{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.24) !important;
        background: rgba(255,255,255,.12) !important;
        text-decoration:none;
        font-weight:800;
        font-size:13px;
        line-height:1;
        user-select:none;
        transition: transform .12s ease, background .12s ease, border-color .12s ease;
      }
      .ft-topbar.ft-topbar--ford .ft-home-btn:hover{
        background: rgba(255,255,255,.20) !important;
        border-color: rgba(255,255,255,.34) !important;
        transform: translateY(-1px);
      }

      @media (max-width:920px){
        .ft-topbar.ft-topbar--ford .ft-topbar__inner{ grid-template-columns: 1fr auto; }
        .ft-topbar.ft-topbar--ford .ft-topbar__center{ display:none; }
        .ft-topbar.ft-topbar--ford .ft-topbar__subtitle{ max-width:360px; }
      }
      @media (max-width:520px){
        .ft-topbar.ft-topbar--ford .ft-topbar__subtitle{ display:none; }
      }
    `;
    document.head.appendChild(style);
  })();

  // ---------- ensure body flag ----------
  body.classList.add("has-topbar");

  // ---------- find or create topbar ----------
  let bar = document.querySelector(".ft-topbar");

  // se NON esiste, la creiamo noi (pagine tipo FTCIRCAS)
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "ft-topbar ft-topbar--ford";
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
            <span aria-hidden="true">🏠</span><span>Home</span>
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
  } else {
    // se ESISTE (FTHUBAS), NON duplicare: applica solo tema Ford
    bar.classList.add("ft-topbar--ford");
  }

  // ---------- meta binding ----------
  // FTHUBAS usa #topbar-userline, le pagine injectate usano #ftUserInfo
  function resolveMetaEl() {
    return (
      document.getElementById("topbar-userline") ||
      document.getElementById("ftUserInfo") ||
      document.getElementById("ftUserInfoLegacy") ||
      null
    );
  }

  function setMeta(text) {
    const el = resolveMetaEl();
    if (!el) return;
    el.textContent = (text || "").toString();
    // se è un badge "pill", gestisci visibilità quando vuoto
    if (el.classList.contains("ft-topbar__userinfo")) {
      el.style.visibility = el.textContent.trim() ? "visible" : "hidden";
    }
  }

  window.FTTopbar = window.FTTopbar || {};
  window.FTTopbar.setMeta = setMeta;
  window.FTSetUserInfo = setMeta;

  window.addEventListener("ft:setMeta", (ev) => {
    try {
      const txt = ev && ev.detail ? ev.detail.text : "";
      setMeta(txt);
    } catch (_) {}
  });
})();
