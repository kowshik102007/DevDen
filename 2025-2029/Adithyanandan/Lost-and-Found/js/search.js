// ============================================================
// search.js — Search, filter, render item cards
// ============================================================
import { fetchPosts } from "./posts.js";
import { statusBadge, formatDate, categoryIcon, renderEmptyState } from "./ui.js";

let allItems = [];

// ── Item Card HTML ────────────────────────────────────────────
export function itemCard(item, type) {
  const placeholder =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title)}&background=0d1b2e&color=3b82f6&size=400`;
  const typeColor = type === "lost" ? "#f87171" : "#34d399";
  const typeLabel = type === "lost" ? "Lost" : "Found";
  // No "View Details" button for either lost or found item cards
  const viewBtn = "";
  return `
    <div class="glass-card rounded-2xl overflow-hidden flex flex-col group hover:border-blue-500/30 transition-all duration-300">
      <div class="relative h-44 overflow-hidden bg-[#0a1628]">
        <img
          src="${item.imageUrl || placeholder}"
          alt="${item.title}"
          class="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
          onerror="this.src='${placeholder}'"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-[#080f1d]/80 to-transparent"></div>
        <div class="absolute top-3 left-3">
          <span
            style="
              display:inline-block;
              padding:3px 10px;
              border-radius:999px;
              font-size:11px;
              font-weight:700;
              background:${type === "lost"
                ? "rgba(239,68,68,0.2)"
                : "rgba(16,185,129,0.2)"};
              border:1px solid ${type === "lost"
                ? "rgba(239,68,68,0.4)"
                : "rgba(16,185,129,0.4)"};
              color:${typeColor};
            "
          >
            ${typeLabel}
          </span>
        </div>
        <div class="absolute top-3 right-3">
          ${statusBadge(item.status)}
        </div>

        <div class="absolute bottom-3 left-3 text-xl">
          ${categoryIcon(item.category)}
        </div>
      </div>
      <div class="p-4 flex flex-col flex-1">
        <h3 class="text-white font-bold text-sm mb-1 line-clamp-1">
          ${item.title}
        </h3>

        <p class="text-slate-500 text-xs mb-2 flex-1 line-clamp-2">
          ${item.description || ""}
        </p>

        ${item.location ? `
          <p class="text-slate-600 text-xs mb-2 flex items-center gap-1">
            📍 ${item.location}
          </p>
        ` : ""}
        ${item.contact ? `
          <p class="text-slate-500 text-xs mb-2 flex items-center gap-1">
            📞 ${item.contact}
          </p>
        ` : ""}
        <div class="text-xs text-slate-600 mb-3">
          ${formatDate(item.createdAt)}
        </div>

        ${viewBtn}
      </div>
    </div>
  `;
}
// ── Render Skeletons ──────────────────────────────────────────
export function renderSkeletons(container, count = 8) {
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="glass-card rounded-2xl overflow-hidden animate-pulse">
      <div class="h-44 bg-white/5"></div>
      <div class="p-4 space-y-3">
        <div class="h-4 bg-white/5 rounded-full w-3/4"></div>
        <div class="h-3 bg-white/5 rounded-full"></div>
        <div class="h-3 bg-white/5 rounded-full w-1/2"></div>
        <div class="h-9 bg-white/5 rounded-xl mt-2"></div>
      </div>
    </div>
  `).join("");
}

// ── Init Search Page ──────────────────────────────────────────
export async function initSearch(type) {
  const grid       = document.getElementById("itemsGrid");
  const searchIn   = document.getElementById("searchInput");
  const catFilter  = document.getElementById("categoryFilter");
  const statFilter = document.getElementById("statusFilter");
  const sortSel    = document.getElementById("sortSelect");
  const countEl    = document.getElementById("resultCount");

  renderSkeletons(grid);

  try {
    allItems = await fetchPosts(type);
  } catch (e) {
    renderEmptyState(grid, "Failed to load items. Please check your Firebase config.");
    return;
  }

  function applyFilters() {
    const q    = (searchIn?.value || "").toLowerCase();
    const cat  = catFilter?.value  || "all";
    const stat = statFilter?.value || "all";
    const sort = sortSel?.value    || "newest";

    let filtered = allItems.filter(item => {
      const matchQ   = !q || [item.title, item.description, item.location,item.contact].some(f => (f || "").toLowerCase().includes(q));
      const matchCat  = cat  === "all" || item.category === cat;
      const matchStat = stat === "all" || item.status   === stat;
      return matchQ && matchCat && matchStat;
    });

    if (sort === "oldest") filtered.reverse();

    if (countEl) countEl.textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;

    if (!filtered.length) {
      renderEmptyState(grid, "No items match your search.");
      return;
    }
    grid.innerHTML = filtered.map(item => itemCard(item, type)).join("");
  }

  searchIn?.addEventListener("input",  applyFilters);
  catFilter?.addEventListener("change", applyFilters);
  statFilter?.addEventListener("change", applyFilters);
  sortSel?.addEventListener("change",   applyFilters);

  applyFilters();
}
