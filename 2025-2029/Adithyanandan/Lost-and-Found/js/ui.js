// ============================================================
// ui.js — Shared UI helpers: toast, spinner, badges, etc.
// ============================================================

// ── Toast Notifications ───────────────────────────────────────
let toastTimeout = null;
export function showToast(message, type = "info") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      display: flex; align-items: center; gap: 10px;
      padding: 14px 20px; border-radius: 14px; font-size: 14px; font-weight: 500;
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      transition: all 0.3s ease; transform: translateY(100px); opacity: 0;
      border: 1px solid; max-width: 360px; font-family: 'Outfit', sans-serif;
    `;
    document.body.appendChild(toast);
  }

  const colors = {
    success: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#34d399", icon: "✓" },
    error:   { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.3)",  text: "#f87171", icon: "✕" },
    info:    { bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.3)", text: "#60a5fa", icon: "ℹ" },
  };
  const c = colors[type] || colors.info;

  toast.style.background   = c.bg;
  toast.style.borderColor  = c.border;
  toast.style.color        = "#f0f6ff";
  toast.innerHTML = `<span style="color:${c.text};font-size:16px">${c.icon}</span><span>${message}</span>`;

  requestAnimationFrame(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity   = "1";
  });

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.transform = "translateY(100px)";
    toast.style.opacity   = "0";
  }, 3500);
}

// ── Global Spinner ────────────────────────────────────────────
export function showSpinner() {
  const s = document.getElementById("globalSpinner");
  if (s) s.style.display = "flex";
}
export function hideSpinner() {
  const s = document.getElementById("globalSpinner");
  if (s) s.style.display = "none";
}

// ── Confirm Dialog ────────────────────────────────────────────
export function showConfirm(title, message, onConfirm) {
  const existing = document.getElementById("confirmModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "confirmModal";
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(6,13,26,0.85);backdrop-filter:blur(8px);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:rgba(13,27,46,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px;max-width:360px;width:100%;font-family:'Outfit',sans-serif;">
        <h3 style="color:#f0f6ff;font-size:18px;font-weight:700;margin-bottom:8px;">${title}</h3>
        <p style="color:#64748b;font-size:14px;margin-bottom:24px;line-height:1.6;">${message}</p>
        <div style="display:flex;gap:12px;">
          <button id="confirmCancel" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#94a3b8;font-size:14px;font-weight:600;cursor:pointer;font-family:'Outfit',sans-serif;">Cancel</button>
          <button id="confirmOk" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:'Outfit',sans-serif;">Delete</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#confirmCancel").onclick = () => modal.remove();
  modal.querySelector("#confirmOk").onclick = () => { modal.remove(); onConfirm(); };
}

// ── Status Badge ──────────────────────────────────────────────
export function statusBadge(status) {
  const map = {
    open:     { label: "Open",     bg: "rgba(59,130,246,0.2)",   border: "rgba(59,130,246,0.4)",   color: "#60a5fa" },
    claimed:  { label: "Claimed",  bg: "rgba(234,179,8,0.2)",    border: "rgba(234,179,8,0.4)",    color: "#facc15" },
    reunited: { label: "Reunited", bg: "rgba(16,185,129,0.2)",   border: "rgba(16,185,129,0.4)",   color: "#34d399" },
  };
  const s = map[status] || map.open;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;background:${s.bg};border:1px solid ${s.border};color:${s.color}">${s.label}</span>`;
}

// ── Format Date ───────────────────────────────────────────────
export function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Category Icon ─────────────────────────────────────────────
export function categoryIcon(cat) {
  const map = {
    electronics: "💻", clothing: "👕", jewelry: "💍", documents: "📄",
    bags: "👜", keys: "🔑", wallet: "👛", pet: "🐾", other: "📦"
  };
  return map[cat] || "📦";
}

// ── Empty State ───────────────────────────────────────────────
export function renderEmptyState(container, message) {
  container.innerHTML = `
    <div class="col-span-full text-center py-20">
      <div class="text-5xl mb-4">🔍</div>
      <p class="text-slate-500 text-sm">${message}</p>
    </div>
  `;
}
