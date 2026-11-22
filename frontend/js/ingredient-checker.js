/* ==========================================================================
   VeganSaathi — ingredient-checker.js
   ============================================================================
   Interactive controller for the Indian Dietary Ingredient Compass.
   Provides real-time search across English & Marathi terms, category filtering,
   and visual badges for animal-derived, caution, and safe ingredients.
   ========================================================================== */

import { INGREDIENT_CATEGORIES, INGREDIENT_ITEMS } from "./ingredient-checker-data.js";

let activeCategory = "all";
let activeSearchQuery = "";
let activeStatusFilter = "all";

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStatusBadge(status) {
  switch (status) {
    case "non-vegan":
      return '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 fs-xs fw-semibold">🔴 Non-Vegan / Animal-Derived (प्राणीजन्य)</span>';
    case "caution":
      return '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 fs-xs fw-semibold">🟡 Caution / Check Prep (सावधगिरी - तपासा)</span>';
    case "vegan-safe":
      return '<span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fs-xs fw-semibold">🟢 100% Plant-Based Safe (पूर्ण वनस्पतीजन्य)</span>';
    default:
      return '<span class="badge bg-secondary-subtle text-secondary px-2 py-1 fs-xs">Check With Chef</span>';
  }
}

function filterIngredients() {
  const query = activeSearchQuery.trim().toLowerCase();

  return INGREDIENT_ITEMS.filter(function (item) {
    if (activeCategory !== "all" && item.category !== activeCategory) {
      return false;
    }
    if (activeStatusFilter !== "all" && item.status !== activeStatusFilter) {
      return false;
    }
    if (query) {
      const matchName = item.name.toLowerCase().includes(query);
      const matchMarathi = (item.marathiName || "").toLowerCase().includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      const matchHidden = (item.hiddenIn || "").toLowerCase().includes(query);
      const matchAlt = (item.alternative || "").toLowerCase().includes(query);
      if (!matchName && !matchMarathi && !matchDesc && !matchHidden && !matchAlt) {
        return false;
      }
    }
    return true;
  });
}

function renderCategoryPills() {
  const container = document.getElementById("categoryPills");
  if (!container) return;

  container.innerHTML = INGREDIENT_CATEGORIES.map(function (cat) {
    const isActive = cat.id === activeCategory ? "active btn-vs-primary text-white" : "btn-outline-secondary bg-white";
    return (
      '<button type="button" class="btn btn-sm vs-cat-pill ' + isActive + ' px-3 py-1.5 rounded-pill shadow-xs" data-category="' + cat.id + '">' +
      '<span class="me-1">' + cat.icon + '</span> ' + escapeHtml(cat.label) +
      '</button>'
    );
  }).join("");

  container.querySelectorAll(".vs-cat-pill").forEach(function (btn) {
    btn.addEventListener("click", function () {
      activeCategory = btn.getAttribute("data-category");
      renderCategoryPills();
      renderIngredients();
    });
  });
}

function renderIngredients() {
  const container = document.getElementById("ingredientGrid");
  const countEl = document.getElementById("matchCount");
  if (!container) return;

  const filtered = filterIngredients();
  if (countEl) {
    countEl.textContent = filtered.length + " item" + (filtered.length === 1 ? "" : "s") + " found";
  }

  if (filtered.length === 0) {
    container.innerHTML = (
      '<div class="col-12 py-5 text-center">' +
      '<div class="display-6 mb-2">🔍</div>' +
      '<h5 class="fw-bold text-dark">No matching ingredients found</h5>' +
      '<p class="text-muted-vs" style="max-width:420px; margin:0 auto;">Try searching with simpler terms like "ghee", "vark", "dahi", or check our spelling.</p>' +
      '<button class="btn btn-vs-outline btn-sm mt-3" id="resetIngSearch">Reset All Filters</button>' +
      '</div>'
    );
    const resetBtn = document.getElementById("resetIngSearch");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        activeCategory = "all";
        activeStatusFilter = "all";
        activeSearchQuery = "";
        const input = document.getElementById("ingredientSearchInput");
        if (input) input.value = "";
        renderCategoryPills();
        renderIngredients();
      });
    }
    return;
  }

  container.innerHTML = filtered.map(function (item) {
    return (
      '<div class="col-md-6 col-lg-4 d-flex">' +
      '<div class="card vs-ingredient-card border rounded-4 w-100 shadow-sm p-4 d-flex flex-column justify-content-between">' +
      '<div>' +
      '<div class="d-flex justify-content-between align-items-start gap-2 mb-2">' +
      '<h5 class="fw-bold mb-0 text-dark" style="font-size:1.05rem;">' + escapeHtml(item.name) + '</h5>' +
      '</div>' +
      '<div class="mb-3">' + getStatusBadge(item.status) + '</div>' +
      '<p class="text-muted-vs small mb-3" style="line-height:1.55;">' + escapeHtml(item.description) + '</p>' +
      (item.hiddenIn ? (
        '<div class="p-2.5 rounded-3 bg-light border mb-3" style="font-size:0.8rem;">' +
        '<strong class="text-dark d-block mb-1">👀 Often Hidden In:</strong>' +
        '<span class="text-muted-vs">' + escapeHtml(item.hiddenIn) + '</span>' +
        '</div>'
      ) : '') +
      '</div>' +
      '<div class="pt-2 border-top">' +
      '<div class="mb-2" style="font-size:0.8rem;">' +
      '<strong class="text-success d-block mb-0.5">🌱 Ethical Alternative:</strong>' +
      '<span class="text-dark">' + escapeHtml(item.alternative) + '</span>' +
      '</div>' +
      '<button type="button" class="btn btn-sm btn-outline-success w-100 py-1 vs-ask-chef-btn" data-id="' + item.id + '" style="font-size:0.78rem;">' +
      '🗣️ What to ask the Chef &rarr;' +
      '</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }).join("");

  // Wire modal triggers for "What to ask the Chef"
  container.querySelectorAll(".vs-ask-chef-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = btn.getAttribute("data-id");
      const item = INGREDIENT_ITEMS.find(function (i) { return i.id === id; });
      if (item) showChefAdviceModal(item);
    });
  });
}

function showChefAdviceModal(item) {
  let modalEl = document.getElementById("chefAdviceModal");
  if (!modalEl) {
    const div = document.createElement("div");
    div.id = "chefAdviceModal";
    div.className = "modal fade";
    div.tabIndex = -1;
    div.setAttribute("aria-hidden", "true");
    div.innerHTML = (
      '<div class="modal-dialog modal-dialog-centered">' +
      '<div class="modal-content border-0 rounded-4 shadow-lg">' +
      '<div class="modal-header border-0 pb-0">' +
      '<h5 class="modal-title fw-bold" id="chefAdviceTitle">What to Ask the Chef</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
      '</div>' +
      '<div class="modal-body p-4" id="chefAdviceBody"></div>' +
      '<div class="modal-footer border-0 pt-0">' +
      '<button type="button" class="btn btn-vs-outline btn-sm px-3" data-bs-dismiss="modal">Close</button>' +
      '<button type="button" class="btn btn-vs-primary btn-sm px-3" id="copyChefAdviceBtn">📋 Copy Marathi Text</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
    document.body.appendChild(div);
    modalEl = div;
  }

  const titleEl = document.getElementById("chefAdviceTitle");
  const bodyEl = document.getElementById("chefAdviceBody");
  const copyBtn = document.getElementById("copyChefAdviceBtn");

  if (titleEl) titleEl.textContent = "How to Order: " + item.name;
  if (bodyEl) {
    bodyEl.innerHTML = (
      '<div class="mb-3">' +
      getStatusBadge(item.status) +
      '</div>' +
      '<div class="mb-3 p-3 rounded-3 bg-light border">' +
      '<label class="form-label fw-bold text-success small mb-1">मराठी संवाद (Say this in Marathi):</label>' +
      '<p class="fs-6 fw-semibold text-dark mb-0 p-2 bg-white rounded border" id="marathiAdviceText">"' + escapeHtml(item.chefAdviceMr) + '"</p>' +
      '</div>' +
      '<div class="mb-2 p-3 rounded-3 bg-light border">' +
      '<label class="form-label fw-bold text-dark small mb-1">English Guidance:</label>' +
      '<p class="small text-muted-vs mb-0">"' + escapeHtml(item.chefAdviceEn) + '"</p>' +
      '</div>'
    );
  }

  if (copyBtn) {
    copyBtn.onclick = function () {
      navigator.clipboard.writeText(item.chefAdviceMr).then(function () {
        copyBtn.textContent = "✓ Copied to Clipboard!";
        setTimeout(function () {
          copyBtn.textContent = "📋 Copy Marathi Text";
        }, 2000);
      }).catch(function () {
        copyBtn.textContent = "Copied!";
      });
    };
  }

  const modal = (typeof bootstrap !== "undefined" && bootstrap.Modal)
    ? bootstrap.Modal.getOrCreateInstance(modalEl)
    : null;
  if (modal) modal.show();
}

export function initIngredientChecker() {
  const searchInput = document.getElementById("ingredientSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      activeSearchQuery = e.target.value;
      renderIngredients();
    });
  }

  const statusSelect = document.getElementById("ingredientStatusSelect");
  if (statusSelect) {
    statusSelect.addEventListener("change", function (e) {
      activeStatusFilter = e.target.value;
      renderIngredients();
    });
  }

  renderCategoryPills();
  renderIngredients();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIngredientChecker);
  } else {
    initIngredientChecker();
  }
}
