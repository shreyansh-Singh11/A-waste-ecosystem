/*
  ============================================================
  SMART E-WASTE — shared frontend helpers
  ============================================================
  Loaded via /assets/shared.js on every portal page, before that
  page's own <script>. Framework-free on purpose (every existing
  page is vanilla JS/fetch) — this only adds small, safe utilities;
  it never touches routing or API calls, so it can't break any
  existing page logic.
*/

(function () {
  try {
    const t = localStorage.getItem("circulasync-theme") || localStorage.getItem("circulasync_theme") || "dark";
    const root = document.documentElement;
    if (t === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
    }
  } catch (e) {}
})();

/** Human-readable date: "02 Sep 2026, 12:42 PM" instead of a raw ISO string. */
function dsFormatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timePart = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

function dsFormatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Maps a domain status string to one of the five badge tones. */
const DS_STATUS_TONE = {
  // success
  RECYCLED: "success", VERIFIED: "success", ACTIVE: "success", RESOLVED: "success",
  COLLECTED: "success", AVAILABLE: "success", OPERATIONAL: "success",
  // warning
  BOOKED: "warning", ASSIGNED: "warning", SCHEDULED: "warning", PENDING: "warning",
  PROCESSING: "warning", SENT_TO_RECYCLER: "warning", NEAR_CAPACITY: "warning",
  ACKNOWLEDGED: "warning", DEMO_MODE: "warning",
  // danger
  INACTIVE: "danger", FULL: "danger", OPEN: "danger", HIGH: "danger", CRITICAL: "danger",
  DEGRADED: "danger",
  // info
  REGISTERED: "info", RECEIVED: "info", SORTED: "info", MEDIUM: "info", REQUESTED: "info",
};

/** Returns badge HTML for a status/severity string, e.g. dsBadge("RECYCLED"). */
function dsBadge(status, label) {
  const tone = DS_STATUS_TONE[String(status).toUpperCase()] || "neutral";
  const text = (label || status || "—").toString().replace(/_/g, " ");
  return `<span class="badge badge-${tone}"><span class="dot"></span>${text}</span>`;
}

/** Skeleton loading rows/cards for a container while data is fetched. */
function dsSkeletonRows(n = 3) {
  return Array.from({ length: n }).map(() => `<div class="skeleton skeleton-row" style="width:${60 + Math.random() * 30}%"></div>`).join("");
}
function dsSkeletonCards(n = 4) {
  return Array.from({ length: n }).map(() => `<div class="skeleton skeleton-card"></div>`).join("");
}

/** Standard empty/error state block. actionHtml is optional (e.g. a button). */
function dsEmptyState({ icon = "🗂️", title, desc, actionHtml = "" } = {}) {
  return `<div class="state-block"><div class="state-icon">${icon}</div>
    <div class="state-title">${title || "Nothing here yet"}</div>
    ${desc ? `<div class="state-desc">${desc}</div>` : ""}
    ${actionHtml}</div>`;
}
function dsErrorState({ title = "Something went wrong.", desc = "Please try again in a moment.", retry } = {}) {
  const btn = retry ? `<button class="btn btn-secondary" onclick="${retry}">Try again</button>` : "";
  return `<div class="state-block state-error"><div class="state-icon">⚠️</div>
    <div class="state-title">${title}</div><div class="state-desc">${desc}</div>${btn}</div>`;
}

/**
 * Wires a notification bell button (#id) to a dropdown (#id + "Dropdown")
 * against GET /api/notifications/:recipientId. Safe no-op if the recipient
 * id isn't known yet (e.g. before a user enters their owner id).
 */
function dsInitNotificationBell({ buttonId, dropdownId, listId, dotId, getRecipientId, apiBase = "" }) {
  const btn = document.getElementById(buttonId);
  const dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown) return;

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains("open");
    if (isOpen) { dropdown.classList.remove("open"); return; }
    const recipientId = getRecipientId();
    const list = document.getElementById(listId);
    if (!recipientId) {
      list.innerHTML = `<div class="notif-empty">Enter your ID above to see notifications.</div>`;
      dropdown.classList.add("open");
      return;
    }
    list.innerHTML = dsSkeletonRows(3);
    dropdown.classList.add("open");
    try {
      const res = await fetch(`${apiBase}/api/notifications/${recipientId}`);
      const notifications = await res.json();
      if (!notifications.length) {
        list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
      } else {
        list.innerHTML = notifications.slice(0, 12).map((n) => `
          <div class="notif-item ${n.read ? "" : "unread"}">
            ${n.message}
            <span class="notif-time">${dsFormatDate(n.timestamp)}</span>
          </div>`).join("");
      }
      const dot = document.getElementById(dotId);
      if (dot) dot.style.display = notifications.some((n) => !n.read) ? "block" : "none";
    } catch (err) {
      list.innerHTML = dsErrorState({ desc: "Couldn't load notifications." });
    }
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) dropdown.classList.remove("open");
  });
}

/** Renders the (initially hidden) educational modal markup. Call once per page,
 *  anywhere in the DOM — e.g. `document.body.insertAdjacentHTML("beforeend", dsEducationModalHtml())`. */
function dsEducationModalHtml() {
  return `
    <div class="ds-modal-overlay" id="dsEducationOverlay" onclick="if(event.target===this) dsCloseEducationModal()">
      <div class="ds-modal" role="dialog" aria-modal="true" aria-labelledby="dsEducationTitle">
        <button class="ds-modal-close" aria-label="Close" onclick="dsCloseEducationModal()">✕</button>
        <div id="dsEducationBody"><div class="skeleton skeleton-card"></div></div>
      </div>
    </div>`;
}

/** Fetches /api/education/:category and shows it in the modal.
 *  deviceLabel is optional — shown as a subtitle if provided. */
async function dsShowEducationModal(category, deviceLabel = "", apiBase = "") {
  const overlay = document.getElementById("dsEducationOverlay");
  const body = document.getElementById("dsEducationBody");
  if (!overlay || !body) return;
  overlay.classList.add("open");
  body.innerHTML = `<div class="skeleton skeleton-card"></div>`;

  try {
    const res = await fetch(`${apiBase}/api/education/${encodeURIComponent(category || "default")}`);
    const c = await res.json();
    body.innerHTML = `
      <h2 id="dsEducationTitle" style="font:var(--text-h2);margin-bottom:var(--sp-1);">⚠️ ${c.category || category}</h2>
      ${deviceLabel ? `<p class="text-caption" style="margin-bottom:var(--sp-4);">${deviceLabel}</p>` : ""}
      <h3 style="font:var(--text-h3);margin-top:var(--sp-4);">Harmful components</h3>
      <ul style="margin:var(--sp-2) 0;padding-left:18px;font:var(--text-body);">
        ${(c.harmfulComponents || []).map((h) => `<li>${h}</li>`).join("")}
      </ul>
      <h3 style="font:var(--text-h3);margin-top:var(--sp-4);">Health effects if disposed incorrectly</h3>
      <p style="font:var(--text-body);">${c.healthEffects || ""}</p>
      <h3 style="font:var(--text-h3);margin-top:var(--sp-4);">Environmental effects</h3>
      <p style="font:var(--text-body);">${c.environmentalEffects || ""}</p>
      <div class="panel" style="background:var(--color-primary-50);border-color:var(--color-primary-100);margin-top:var(--sp-4);">
        <p style="font:var(--text-body);">✅ <strong>Proper disposal:</strong> ${c.properDisposalTip || ""}</p>
      </div>`;
  } catch (err) {
    body.innerHTML = dsErrorState({ title: "Couldn't load this information.", desc: "Please try again in a moment." });
  }
}

function dsCloseEducationModal() {
  const overlay = document.getElementById("dsEducationOverlay");
  if (overlay) overlay.classList.remove("open");
}


function dsNotificationBellHtml({ buttonId, dropdownId, listId, dotId }) {
  return `
    <div class="notif-bell">
      <button class="btn-icon bell-btn" id="${buttonId}" aria-label="Notifications" aria-haspopup="true">
        🔔<span class="bell-dot" id="${dotId}" style="display:none;"></span>
      </button>
      <div class="notif-dropdown" id="${dropdownId}">
        <div class="notif-header">Notifications</div>
        <div id="${listId}"><div class="notif-empty">Loading…</div></div>
      </div>
    </div>`;
}

// -------------------------------------------------------------
// Progressive Web App (PWA) Offline Service Worker Registration
// -------------------------------------------------------------
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      console.log("[CirculaSync PWA] Service Worker registered with scope:", reg.scope);
    }).catch((err) => {
      console.debug("[CirculaSync PWA] SW notice:", err.message);
    });
  });
}

// -------------------------------------------------------------
// Universal Client-Side Table Pagination & Search Enhancement
// -------------------------------------------------------------
/**
 * Automatically adds a search toolbar, row counter, and pagination controls to any table.
 * Preserves all row event listeners, formats, and DOM elements.
 * @param {string|HTMLTableElement} target - Table ID or element
 * @param {Object} [options]
 * @param {number} [options.pageSize=7] - Rows per page
 * @param {string} [options.placeholder="Search table..."] - Search box placeholder
 */
function dsEnhanceTable(target, options = {}) {
  const table = typeof target === "string" ? document.getElementById(target) : target;
  if (!table) return;

  const pageSize = options.pageSize || 7;
  const placeholder = options.placeholder || "Search records...";
  const tableId = table.id || `table_${Math.random().toString(36).substring(2, 8)}`;
  table.id = tableId;

  let wrap = table.closest(".table-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  }

  // Find or create search toolbar
  let toolbar = document.getElementById(`${tableId}_toolbar`);
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = `${tableId}_toolbar`;
    toolbar.className = "table-toolbar";
    toolbar.innerHTML = `
      <div class="table-search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="${tableId}_search" placeholder="${placeholder}" autocomplete="off" />
      </div>
      <div class="table-count-pill" id="${tableId}_count"></div>
    `;
    wrap.parentNode.insertBefore(toolbar, wrap);
  }

  // Find or create pagination bar
  let pagination = document.getElementById(`${tableId}_pagination`);
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = `${tableId}_pagination`;
    pagination.className = "table-pagination";
    pagination.innerHTML = `
      <div id="${tableId}_pageInfo">Page 1</div>
      <div class="pagination-controls">
        <button class="pagination-btn" id="${tableId}_prevBtn" type="button">← Prev</button>
        <button class="pagination-btn" id="${tableId}_nextBtn" type="button">Next →</button>
      </div>
    `;
    wrap.parentNode.insertBefore(pagination, wrap.nextSibling);
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  
  // If empty or loading row
  const firstRowText = rows[0]?.textContent?.trim() || "";
  const isPlaceholder = rows.length <= 1 && (
    firstRowText.includes("Loading") ||
    firstRowText.includes("No ") ||
    firstRowText.includes("not found")
  );

  if (isPlaceholder || rows.length === 0) {
    toolbar.style.display = "none";
    pagination.style.display = "none";
    return;
  }

  toolbar.style.display = "flex";
  pagination.style.display = "flex";

  let currentPage = 1;
  let filteredRows = [...rows];

  function updateView() {
    const searchInput = document.getElementById(`${tableId}_search`);
    const query = (searchInput?.value || "").toLowerCase().trim();

    if (query) {
      filteredRows = rows.filter(r => (r.textContent || "").toLowerCase().includes(query));
    } else {
      filteredRows = [...rows];
    }

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;

    rows.forEach(r => { r.style.display = "none"; });
    filteredRows.slice(startIdx, endIdx).forEach(r => { r.style.display = ""; });

    const countEl = document.getElementById(`${tableId}_count`);
    if (countEl) {
      if (total === 0) {
        countEl.textContent = "0 matches";
      } else {
        const start = startIdx + 1;
        const end = Math.min(endIdx, total);
        countEl.textContent = `${start}–${end} of ${total}`;
      }
    }

    const pageInfo = document.getElementById(`${tableId}_pageInfo`);
    if (pageInfo) {
      pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${total} total)`;
    }

    const prevBtn = document.getElementById(`${tableId}_prevBtn`);
    const nextBtn = document.getElementById(`${tableId}_nextBtn`);
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    if (total <= pageSize && !query) {
      pagination.style.display = "none";
    } else {
      pagination.style.display = "flex";
    }
  }

  const searchInput = document.getElementById(`${tableId}_search`);
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", () => {
      currentPage = 1;
      updateView();
    });
  }

  const prevBtn = document.getElementById(`${tableId}_prevBtn`);
  if (prevBtn && !prevBtn.dataset.bound) {
    prevBtn.dataset.bound = "true";
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        updateView();
      }
    });
  }

  const nextBtn = document.getElementById(`${tableId}_nextBtn`);
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = "true";
    nextBtn.addEventListener("click", () => {
      const totalPages = Math.ceil(filteredRows.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        updateView();
      }
    });
  }

  updateView();
}

/**
 * Paginates any list of cards (e.g. lots, route steps, orders)
 * @param {string|HTMLElement} target - Container ID or element
 * @param {Object} [options]
 * @param {number} [options.pageSize=5] - Items per page
 */
function dsEnhanceList(target, options = {}) {
  const container = typeof target === "string" ? document.getElementById(target) : target;
  if (!container) return;

  const pageSize = options.pageSize || 5;
  const listId = container.id || `list_${Math.random().toString(36).substring(2, 8)}`;
  container.id = listId;

  const children = Array.from(container.children);
  if (children.length <= pageSize) {
    const existingPaging = document.getElementById(`${listId}_pagination`);
    if (existingPaging) existingPaging.style.display = "none";
    return;
  }

  container.classList.add("scroll-capped-list");

  let pagination = document.getElementById(`${listId}_pagination`);
  if (!pagination) {
    pagination = document.createElement("div");
    pagination.id = `${listId}_pagination`;
    pagination.className = "table-pagination mt-2";
    pagination.innerHTML = `
      <div id="${listId}_pageInfo">Page 1</div>
      <div class="pagination-controls">
        <button class="pagination-btn" id="${listId}_prevBtn" type="button">← Prev</button>
        <button class="pagination-btn" id="${listId}_nextBtn" type="button">Next →</button>
      </div>
    `;
    container.parentNode.insertBefore(pagination, container.nextSibling);
  }
  pagination.style.display = "flex";

  let currentPage = 1;
  const total = children.length;
  const totalPages = Math.ceil(total / pageSize);

  function renderListPage() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    children.forEach((c, idx) => {
      c.style.display = (idx >= start && idx < end) ? "" : "none";
    });

    const info = document.getElementById(`${listId}_pageInfo`);
    if (info) info.textContent = `Page ${currentPage} of ${totalPages} (${total} items)`;

    const prev = document.getElementById(`${listId}_prevBtn`);
    const next = document.getElementById(`${listId}_nextBtn`);
    if (prev) prev.disabled = currentPage <= 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  const prev = document.getElementById(`${listId}_prevBtn`);
  if (prev && !prev.dataset.bound) {
    prev.dataset.bound = "true";
    prev.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderListPage();
      }
    });
  }

  const next = document.getElementById(`${listId}_nextBtn`);
  if (next && !next.dataset.bound) {
    next.dataset.bound = "true";
    next.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderListPage();
      }
    });
  }

  renderListPage();
}

// Ensure CirculaSync Global App Shell is mounted across all portals
(function () {
  if (!document.getElementById("circulasync-global-shell-script")) {
    const s = document.createElement("script");
    s.id = "circulasync-global-shell-script";
    s.src = "/assets/global-shell.js";
    s.onload = function () {
      if (typeof window.initGlobalShell === "function") window.initGlobalShell();
    };
    document.head.appendChild(s);
  } else if (typeof window.initGlobalShell === "function") {
    window.initGlobalShell();
  }
})();


