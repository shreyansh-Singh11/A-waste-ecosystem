/*
  ============================================================
  CIRCULASYNC / ECOTRACK 360 — GLOBAL APP SHELL (V2 ENHANCED)
  ============================================================
  Omnipresent top navigation, 8-portal persona switcher,
  evaluator speed-run tour, theme persistence & non-intrusive toast system.
  Injected safely across all portals without breaking page logic.
*/

(function () {
  // ── 1. THEME INITIALIZATION ──
  const storedTheme = localStorage.getItem("circulasync-theme") || localStorage.getItem("circulasync_theme") || "dark";
  const rootEl = document.documentElement;
  if (storedTheme === "light") {
    rootEl.classList.add("light");
    rootEl.classList.remove("dark");
    rootEl.setAttribute("data-theme", "light");
  } else {
    rootEl.classList.add("dark");
    rootEl.classList.remove("light");
    rootEl.setAttribute("data-theme", "dark");
  }

  // ── 2. GLOBAL SHELL MOUNT (ROBUST) ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGlobalShell);
  } else {
    initGlobalShell();
  }

  window.initGlobalShell = initGlobalShell;

  function initGlobalShell() {
    if (document.getElementById("circulasync-global-header")) return;

    // Detect active portal
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    const portals = [
      { key: "/", name: "Unified Hub", icon: "🌐", url: "/" },
      { key: "/user", name: "Citizen", icon: "👤", url: "/user" },
      { key: "/collector", name: "Recycler", icon: "🏭", url: "/collector" },
      { key: "/municipal", name: "Municipal", icon: "🚛", url: "/municipal" },
      { key: "/medical", name: "Biomedical", icon: "🏥", url: "/medical" },
      { key: "/producer", name: "Producer", icon: "🏷️", url: "/producer" },
      { key: "/government", name: "Gov Command", icon: "🏛️", url: "/government" },
    ];

    const currentTheme = (document.documentElement.classList.contains("light") || document.documentElement.getAttribute("data-theme") === "light") ? "light" : "dark";
    const themeIcon = currentTheme === "light" ? "☀️" : "🌙";
    const themeLabel = currentTheme === "light" ? "Light" : "Dark";

    // Header HTML
    const headerHtml = `
      <header id="circulasync-global-header" class="cs-global-header">
        <div class="cs-header-inner">
          
          <!-- Brand -->
          <div class="cs-brand-group">
            <button class="cs-mobile-menu-toggle" onclick="csToggleMobileMenu()" aria-label="Toggle Navigation">
              <span>☰</span>
            </button>
            <a href="/" class="cs-brand-wrap">
              <span class="cs-brand-icon">♻️</span>
              <div class="cs-brand-text">
                <div class="cs-brand-title">CirculaSync <span class="cs-badge-sih">SIH 2026</span></div>
                <div class="cs-brand-sub">Multi-Stream Circular Platform</div>
              </div>
            </a>
          </div>

          <!-- Desktop Navigation Links -->
          <nav class="cs-nav-links" id="csNavLinks">
            ${portals
              .map((p) => {
                const isActive = (p.key === "/" && path === "") || path === p.key;
                return `
                <a href="${p.url}" class="cs-nav-item ${isActive ? "active" : ""}">
                  <span class="cs-nav-icon">${p.icon}</span>
                  <span>${p.name}</span>
                </a>
              `;
              })
              .join("")}
          </nav>

          <!-- Top Actions -->
          <div class="cs-header-actions">
            <button onclick="csOpenSpeedRun()" class="cs-btn-speedrun" title="Guided 5-minute evaluator tour">
              <span class="cs-icon-bolt">⚡</span> <span class="cs-speedrun-text">Speed-Run</span>
            </button>
            <button onclick="csToggleTheme()" class="cs-btn-theme" id="cs-theme-btn" title="Theme: ${themeLabel} Mode (Click to switch)" aria-label="Toggle Theme">
              <span class="cs-theme-icon">${themeIcon}</span>
              <span class="cs-theme-label">${themeLabel}</span>
            </button>
          </div>
        </div>

        <!-- Mobile Drawer -->
        <div id="cs-mobile-drawer" class="cs-mobile-drawer">
          <div class="cs-mobile-drawer-header">
            <span>Switch Role Portal</span>
            <button onclick="csToggleMobileMenu()" class="cs-drawer-close">✕</button>
          </div>
          <div class="cs-mobile-grid">
            ${portals
              .map((p) => {
                const isActive = (p.key === "/" && path === "") || path === p.key;
                return `
                <a href="${p.url}" class="cs-mobile-item ${isActive ? "active" : ""}">
                  <span class="cs-m-icon">${p.icon}</span>
                  <div class="cs-m-name">${p.name}</div>
                </a>
              `;
              })
              .join("")}
          </div>
        </div>
      </header>

      <!-- Evaluator Speed-Run Modal Mount -->
      <div id="cs-speedrun-modal" class="cs-modal-backdrop" style="display:none;" onclick="if(event.target===this)csCloseSpeedRun()">
        <div class="cs-modal-box">
          <div class="cs-modal-header">
            <div class="cs-modal-title">⚡ 5-Minute Evaluator Speed-Run Tour</div>
            <button onclick="csCloseSpeedRun()" class="cs-modal-close">✕</button>
          </div>
          <div class="cs-modal-body">
            <p class="cs-modal-intro">Welcome Smart India Hackathon (SIH 2026) Jury! Jump directly into live deterministic workflows across all 8 roles without manual setup:</p>
            <a href="/demo" style="display:flex; align-items:center; justify-content:center; gap:8px; background:linear-gradient(135deg, #10b981, #059669); color:#fff; font-weight:700; padding:10px 16px; border-radius:8px; text-decoration:none; margin-bottom:12px; font-size:13px; box-shadow:0 2px 10px rgba(16,185,129,0.3);">🎬 Launch Interactive 5-Min Video &amp; Teleprompter Studio →</a>
            <div class="cs-speedrun-list">
              <a href="/user" class="cs-speedrun-row">
                <span class="cs-sr-step">1</span>
                <div class="cs-sr-info">
                  <strong>Citizen App:</strong> AI Triage Scan (Grade A/B/C) &amp; Instant Doorstep Pickup.
                </div>
                <span class="cs-sr-arrow">→</span>
              </a>
              <a href="/collector" class="cs-speedrun-row">
                <span class="cs-sr-step">2</span>
                <div class="cs-sr-info">
                  <strong>Recycler Hub:</strong> SSQI Conveyor Gate &amp; 5-Min Reverse English Auctions.
                </div>
                <span class="cs-sr-arrow">→</span>
              </a>
              <a href="/municipal" class="cs-speedrun-row">
                <span class="cs-sr-step">3</span>
                <div class="cs-sr-info">
                  <strong>Municipal SWM:</strong> Eulerian Snake Routing (Zero-Skipped Streets) &amp; Weighbridge Scale.
                </div>
                <span class="cs-sr-arrow">→</span>
              </a>
              <a href="/medical" class="cs-speedrun-row">
                <span class="cs-sr-step">4</span>
                <div class="cs-sr-info">
                  <strong>Healthcare BMW:</strong> 4-Color Segregation Bins &amp; Autoclave Destruction Certs.
                </div>
                <span class="cs-sr-arrow">→</span>
              </a>
              <a href="/producer" class="cs-speedrun-row">
                <span class="cs-sr-step">5</span>
                <div class="cs-sr-info">
                  <strong>Brand EPR Desk:</strong> Annual Deficit Quota &amp; Voluntary Carbon Credits (VCC).
                </div>
                <span class="cs-sr-arrow">→</span>
              </a>
              <a href="/government" class="cs-speedrun-row">
                <span class="cs-sr-step">6</span>
                <div class="cs-sr-info">
                  <strong>CPCB Command Hub:</strong> Swachh 4,200 Scorecard, Merkle Proofs &amp; HAZMAT Lock.
                </div>
                <span class="cs-sr-arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Live Floating Toast Container -->
      <div id="cs-toast-container" class="cs-toast-wrap"></div>
    `;

    // Inject styles for the global shell
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      .cs-global-header {
        position: sticky;
        top: 0;
        z-index: 9999;
        background: rgba(10, 15, 24, 0.88);
        backdrop-filter: blur(16px) saturate(180%);
        -webkit-backdrop-filter: blur(16px) saturate(180%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 8px 16px;
        font-family: var(--font-sans, system-ui, sans-serif);
      }
      html.light .cs-global-header {
        background: rgba(255, 255, 255, 0.92);
        border-bottom: 1px solid rgba(15, 23, 42, 0.09);
      }
      .cs-header-inner {
        max-width: 1440px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .cs-brand-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .cs-mobile-menu-toggle {
        display: none;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #cbd5e1;
        padding: 5px 9px;
        border-radius: 6px;
        font-size: 16px;
        cursor: pointer;
      }
      html.light .cs-mobile-menu-toggle {
        border-color: rgba(15, 23, 42, 0.15);
        color: #334155;
      }
      .cs-brand-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: inherit;
        flex-shrink: 0;
      }
      .cs-brand-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #10b981;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 1px 4px rgba(16, 185, 129, 0.35);
      }
      .cs-brand-title {
        font-size: 13.5px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      html.light .cs-brand-title { color: #0f172a; }
      .cs-badge-sih {
        font-size: 9.5px;
        font-family: var(--font-mono, monospace);
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.35);
        padding: 1px 6px;
        border-radius: 999px;
        font-weight: 600;
      }
      .cs-brand-sub {
        font-size: 10px;
        color: #94a3b8;
      }
      .cs-nav-links {
        display: flex;
        align-items: center;
        gap: 3px;
        overflow-x: auto;
        padding: 2px 0;
      }
      .cs-nav-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 10px;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
        color: #94a3b8;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      html.light .cs-nav-item { color: #64748b; }
      .cs-nav-item:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
      }
      html.light .cs-nav-item:hover {
        background: rgba(15, 23, 42, 0.06);
        color: #0f172a;
      }
      .cs-nav-item.active {
        background: rgba(16, 185, 129, 0.14);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      html.light .cs-nav-item.active {
        color: #047857;
      }
      .cs-nav-icon {
        font-size: 13px;
      }
      .cs-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .cs-btn-speedrun {
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
        padding: 6px 11px;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.15s ease;
      }
      .cs-btn-speedrun:hover {
        background: rgba(245, 158, 11, 0.22);
        color: #ffffff;
        border-color: #fbbf24;
      }
      .cs-btn-theme {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: #f8fafc;
        height: 32px;
        padding: 0 10px;
        border-radius: 7px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 600;
        font-family: var(--font-sans, system-ui, sans-serif);
        transition: all 0.15s ease;
      }
      html.light .cs-btn-theme, [data-theme="light"] .cs-btn-theme {
        background: rgba(15, 23, 42, 0.06);
        border-color: rgba(15, 23, 42, 0.14);
        color: #0f172a;
      }
      .cs-btn-theme:hover {
        border-color: #10b981;
      }
      .cs-theme-icon {
        font-size: 13px;
        line-height: 1;
      }
      .cs-theme-label {
        font-size: 11.5px;
        letter-spacing: 0.01em;
      }

      /* Mobile Drawer */
      .cs-mobile-drawer {
        display: none;
        flex-direction: column;
        gap: 12px;
        background: #111827;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding: 14px 16px;
        margin: 8px -16px -8px -16px;
      }
      html.light .cs-mobile-drawer {
        background: #ffffff;
        border-top: 1px solid rgba(15, 23, 42, 0.1);
      }
      .cs-mobile-drawer.open {
        display: flex;
      }
      .cs-mobile-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
      }
      .cs-drawer-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 16px;
        cursor: pointer;
      }
      .cs-mobile-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .cs-mobile-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        text-decoration: none;
        font-size: 12px;
        font-weight: 600;
      }
      html.light .cs-mobile-item {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #334155;
      }
      .cs-mobile-item.active {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border-color: #10b981;
      }

      /* Modal */
      .cs-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .cs-modal-box {
        background: #111827;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        max-width: 580px;
        width: 100%;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        overflow: hidden;
      }
      html.light .cs-modal-box {
        background: #ffffff;
        border-color: #cbd5e1;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.15);
      }
      .cs-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      html.light .cs-modal-header {
        border-bottom-color: #e2e8f0;
      }
      .cs-modal-title {
        font-size: 15px;
        font-weight: 700;
        color: #f8fafc;
      }
      html.light .cs-modal-title { color: #0f172a; }
      .cs-modal-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
      }
      .cs-modal-body {
        padding: 20px;
      }
      .cs-modal-intro {
        font-size: 12.5px;
        color: #94a3b8;
        margin-bottom: 14px;
        line-height: 1.5;
      }
      html.light .cs-modal-intro { color: #64748b; }
      .cs-speedrun-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .cs-speedrun-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        text-decoration: none;
        color: #cbd5e1;
        transition: all 0.15s ease;
      }
      html.light .cs-speedrun-row {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #334155;
      }
      .cs-speedrun-row:hover {
        background: rgba(16, 185, 129, 0.1);
        border-color: #10b981;
        transform: translateX(3px);
      }
      .cs-sr-step {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .cs-sr-info {
        flex: 1;
        font-size: 12.5px;
      }
      .cs-sr-arrow {
        color: #10b981;
        font-size: 15px;
      }

      /* Toasts (Fixed positioning avoiding card collisions) */
      .cs-toast-wrap {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .cs-toast-item {
        background: #111827;
        color: #f8fafc;
        border: 1px solid #10b981;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 12.5px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        pointer-events: auto;
        animation: csToastSlide 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      html.light .cs-toast-item {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
      }
      @keyframes csToastSlide {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (max-width: 900px) {
        .cs-nav-links { display: none; }
        .cs-mobile-menu-toggle { display: block; }
        .cs-toast-wrap { bottom: auto; top: 60px; right: 16px; left: 16px; }
      }
      @media (max-width: 600px) {
        .cs-brand-sub { display: none; }
        .cs-badge-sih { display: none; }
        .cs-speedrun-text { display: none; }
        .cs-theme-label { display: none; }
        .cs-btn-theme { padding: 0 6px; width: 32px; justify-content: center; }
        .cs-btn-speedrun { padding: 6px 8px; }
        .cs-header-inner { gap: 8px; }
      }
    `;

    document.head.appendChild(styleEl);

    // Insert header at very top of body
    const placeholder = document.createElement("div");
    placeholder.innerHTML = headerHtml;
    while (placeholder.firstChild) {
      document.body.insertBefore(placeholder.firstChild, document.body.firstChild);
    }
  }

  // ── 3. GLOBAL ACTIONS ──
  window.csToggleTheme = function () {
    const rootEl = document.documentElement;
    const isCurrentlyLight = rootEl.classList.contains("light") || rootEl.getAttribute("data-theme") === "light";
    const nextTheme = isCurrentlyLight ? "dark" : "light";
    if (nextTheme === "light") {
      rootEl.classList.remove("dark");
      rootEl.classList.add("light");
      rootEl.setAttribute("data-theme", "light");
    } else {
      rootEl.classList.remove("light");
      rootEl.classList.add("dark");
      rootEl.setAttribute("data-theme", "dark");
    }
    localStorage.setItem("circulasync-theme", nextTheme);
    localStorage.setItem("circulasync_theme", nextTheme);
    const btn = document.getElementById("cs-theme-btn");
    if (btn) {
      const nextIcon = nextTheme === "light" ? "☀️" : "🌙";
      const nextLabel = nextTheme === "light" ? "Light" : "Dark";
      btn.innerHTML = `<span class="cs-theme-icon">${nextIcon}</span><span class="cs-theme-label">${nextLabel}</span>`;
      btn.setAttribute("title", `Theme: ${nextLabel} Mode (Click to switch)`);
      btn.setAttribute("aria-label", `Switch to ${nextTheme === "light" ? "Dark" : "Light"} Mode`);
    }
    window.dispatchEvent(new CustomEvent("circulasync-theme-change", { detail: { theme: nextTheme } }));
  };

  window.csToggleMobileMenu = function () {
    const drawer = document.getElementById("cs-mobile-drawer");
    if (drawer) drawer.classList.toggle("open");
  };

  window.csOpenSpeedRun = function () {
    const m = document.getElementById("cs-speedrun-modal");
    if (m) m.style.display = "flex";
  };

  window.csCloseSpeedRun = function () {
    const m = document.getElementById("cs-speedrun-modal");
    if (m) m.style.display = "none";
  };

  window.csToast = function (msg, isError = false) {
    const container = document.getElementById("cs-toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "cs-toast-item";
    if (isError) toast.style.borderColor = "#f43f5e";
    toast.innerHTML = `<span>${isError ? "⚠️" : "✓"}</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.25s ease";
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  };
})();
