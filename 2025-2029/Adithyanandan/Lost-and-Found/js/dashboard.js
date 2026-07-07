// ============================================================
// dashboard.js — User dashboard: My Lost & Found Items
// ============================================================
import { fetchPosts, deletePost, updatePostStatus } from "./posts.js";
import { requireAuth }                              from "./auth.js";
import { showConfirm, statusBadge, formatDate, categoryIcon, renderEmptyState } from "./ui.js";

let currentUser = null;
let activeTab   = "lost";
let userPosts   = { lost: [], found: [] };

export async function initDashboard() {
  currentUser = await requireAuth();
  updateUserInfo();
  await loadBothTabs();
  bindTabs();
  renderTab(activeTab);
}

function updateUserInfo() {
  const nameEl   = document.getElementById("userName");
  const emailEl  = document.getElementById("userEmail");
  const avatarEl = document.getElementById("userAvatar");
  if (nameEl)   nameEl.textContent  = currentUser.displayName || "User";
  if (emailEl)  emailEl.textContent = currentUser.email;
  if (avatarEl) avatarEl.textContent = (currentUser.displayName || "U")[0].toUpperCase();
}

async function loadBothTabs() {
  const [lost, found] = await Promise.all([
    fetchPosts("lost"),
    fetchPosts("found"),
  ]);
  userPosts.lost  = lost;
  userPosts.found = found;

  const lostCount  = document.getElementById("lostCount");
  const foundCount = document.getElementById("foundCount");
  if (lostCount)  lostCount.textContent  = lost.length;
  if (foundCount) foundCount.textContent = found.length;

  updateStats();
}

function updateStats() {
  const all   = [...userPosts.lost, ...userPosts.found];
  const open  = all.filter(i => i.status === "open").length;
  const reun  = all.filter(i => i.status === "reunited").length;

  document.getElementById("statTotal"   )?.textContent && (document.getElementById("statTotal").textContent    = all.length);
  document.getElementById("statOpen"    )?.textContent && (document.getElementById("statOpen").textContent     = open);
  document.getElementById("statReunited")?.textContent && (document.getElementById("statReunited").textContent = reun);
}

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach(b => {
        b.classList.toggle("tab-active", b === btn);
      });
      renderTab(activeTab);
    });
  });
}

function renderTab(type) {
  const grid = document.getElementById("dashGrid");
  if (!grid) return;
  const items = userPosts[type];

  if (!items.length) {
    renderEmptyState(grid, `No ${type} items have been posted yet.`);
    return;
  }

  grid.innerHTML = items.map(item => dashCard(item, type)).join("");
  attachImageFallbacks(grid);
  attachCardActions();
}

function dashCard(item, type) {
  const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=0d1b2e&color=3b82f6&size=400`;
  const isOwner = currentUser && item.userId === currentUser.uid;
  const actions = isOwner ? `
        <div class="flex gap-2">
          <a href="post.html?type=${type}&id=${item.id}&edit=1"
            class="flex-1 py-2 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-semibold
                   hover:bg-blue-500/10 transition-all text-center">
            Edit
          </a>
          <button data-delete="${item.id}" data-delete-type="${type}" data-delete-path="${item.imagePath || ""}"
            class="flex-1 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-semibold
                   hover:bg-red-500/10 transition-all">
            Delete
          </button>
        </div>
      ` : `
        <div class="text-xs text-slate-600">Posted by another user</div>
      `;
  return `
    <div class="glass-card rounded-2xl overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all duration-300">
      <div class="relative h-40 overflow-hidden bg-[#0a1628]">
        <img src="${item.imageUrl || placeholder}"
             alt="${item.title}"
             class="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
             data-fallback="${placeholder}"/>
        <div class="absolute inset-0 bg-gradient-to-t from-[#080f1d]/80 to-transparent"></div>
        <div class="absolute top-3 right-3">${statusBadge(item.status)}</div>
        <div class="absolute bottom-3 left-3 text-xl">${categoryIcon(item.category)}</div>
      </div>
      <div class="p-4 flex flex-col flex-1">
        <h3 class="text-white font-bold text-sm mb-1 line-clamp-1">${item.title}</h3>
        <p class="text-slate-500 text-xs mb-3 flex-1 line-clamp-2">${item.description || ""}</p>
        <div class="text-xs text-slate-600 mb-4">${formatDate(item.createdAt)}</div>
        ${isOwner ? `
        <!-- Status selector -->
        <select data-status-id="${item.id}" data-status-type="${type}"
          class="w-full mb-3 bg-white/5 border border-white/10 text-slate-300 text-xs rounded-xl px-3 py-2
                 focus:outline-none focus:border-blue-500/50 cursor-pointer">
          <option value="open"     ${item.status==="open"     ? "selected" : ""}>Open</option>
          <option value="claimed"  ${item.status==="claimed"  ? "selected" : ""}>Claimed</option>
          <option value="reunited" ${item.status==="reunited" ? "selected" : ""}>Reunited</option>
        </select>
        ` : ""}

        ${actions}
      </div>
    </div>
  `;
}

function attachImageFallbacks(grid) {
  grid.querySelectorAll("img[data-fallback]").forEach(img => {
    img.addEventListener("error", () => {
      const fallback = img.dataset.fallback;
      if (fallback && img.src !== fallback) img.src = fallback;
    });
  });
}

function attachCardActions() {
  const grid = document.getElementById("dashGrid");

  // Status change
  grid.querySelectorAll("[data-status-id]").forEach(sel => {
    sel.addEventListener("change", async () => {
      await updatePostStatus(sel.dataset.statusType, sel.dataset.statusId, sel.value);
      const item = userPosts[sel.dataset.statusType].find(i => i.id === sel.dataset.statusId);
      if (item) item.status = sel.value;
    });
  });

  // Delete
  grid.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      showConfirm("Delete Post", "This action cannot be undone. Are you sure?", async () => {
        const ok = await deletePost(btn.dataset.deleteType, btn.dataset.delete, btn.dataset.deletePath);
        if (ok) {
          userPosts[btn.dataset.deleteType] = userPosts[btn.dataset.deleteType].filter(i => i.id !== btn.dataset.delete);
          renderTab(activeTab);
          updateStats();
        }
      });
    });
  });
}
