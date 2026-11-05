/* ==========================================================================
   VeganSaathi — alternatives-page.js
   Interactive controller for the Vegan Alternatives guide page.
   ========================================================================== */

import {
  ALTERNATIVE_CATEGORIES,
  VEGAN_ALTERNATIVES,
  searchAlternatives
} from "./alternatives-data.js";

let currentCategory = "all";
let currentSearch = "";
let currentAllergenExclude = "";

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCategoryPills() {
  const container = document.getElementById("altCategoryPills");
  if (!container) return;

  const html = ALTERNATIVE_CATEGORIES.map(cat => {
    const isActive = cat.slug === currentCategory;
    const btnClass = isActive ? "btn-vs-primary" : "btn-outline-secondary";
    return `
      <button type="button" class="btn btn-sm ${btnClass} rounded-pill text-nowrap px-3 py-2 me-2 mb-2 alt-category-btn" data-category="${cat.slug}">
        <span class="me-1">${cat.icon}</span> ${escapeHtml(cat.name)}
      </button>
    `;
  }).join("");

  container.innerHTML = html;

  // Add click handlers
  container.querySelectorAll(".alt-category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.getAttribute("data-category") || "all";
      renderCategoryPills();
      renderAlternativeCards();
    });
  });
}

function renderAlternativeCards() {
  const grid = document.getElementById("altGridContainer");
  const countEl = document.getElementById("altResultsCount");
  if (!grid) return;

  const results = searchAlternatives(currentSearch, currentCategory, currentAllergenExclude);

  if (countEl) {
    countEl.textContent = `Showing ${results.length} alternative${results.length === 1 ? "" : "s"}`;
  }

  if (results.length === 0) {
    grid.innerHTML = `
      <div class="col-12 py-5 text-center">
        <div class="p-5 border rounded-3 bg-light">
          <div style="font-size: 3rem;">🔍</div>
          <h4 class="mt-3">No matching alternatives found</h4>
          <p class="text-muted">Try adjusting your search terms, changing the category, or clearing the allergen filter.</p>
          <button type="button" id="altResetFiltersBtn" class="btn btn-vs-primary mt-2">Reset All Filters</button>
        </div>
      </div>
    `;
    const resetBtn = document.getElementById("altResetFiltersBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        currentCategory = "all";
        currentSearch = "";
        currentAllergenExclude = "";
        const searchInput = document.getElementById("altSearchInput");
        if (searchInput) searchInput.value = "";
        const allergenSelect = document.getElementById("altAllergenSelect");
        if (allergenSelect) allergenSelect.value = "";
        renderCategoryPills();
        renderAlternativeCards();
      });
    }
    return;
  }

  grid.innerHTML = results.map(item => {
    const allergenBadges = (item.allergens || []).map(a =>
      `<span class="badge bg-light text-dark border me-1">${escapeHtml(a)}</span>`
    ).join("");

    return `
      <div class="col-lg-6 col-md-12 mb-4">
        <div class="card h-100 shadow-sm border-0 vs-card-hover" style="border-radius: 12px; overflow: hidden; border: 1px solid #e2ebe3 !important;">
          <div class="card-header bg-white border-bottom-0 pt-4 px-4 pb-2">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <span class="text-muted small text-uppercase fw-semibold" style="letter-spacing: 0.5px;">Traditional: ${escapeHtml(item.traditionalFood)}</span>
                <h4 class="card-title text-success fw-bold mb-1 mt-1" style="color: #215e34 !important;">
                  🌱 ${escapeHtml(item.veganAlternative)}
                </h4>
              </div>
              <span class="badge rounded-pill px-3 py-2" style="background-color: #e8f5e9; color: #1b5e20; font-size: 0.75rem;">
                ${escapeHtml(item.category.toUpperCase())}
              </span>
            </div>
          </div>
          <div class="card-body px-4 py-3">
            <div class="mb-3">
              <strong class="text-dark small d-block mb-1">✨ Best Used For:</strong>
              <p class="card-text text-secondary mb-0 small">${escapeHtml(item.bestUsedFor)}</p>
            </div>

            <div class="mb-3">
              <strong class="text-dark small d-block mb-1">💡 Indian Kitchen Tip:</strong>
              <div class="p-2 rounded bg-light border-start border-success border-3 small text-dark">
                ${escapeHtml(item.culinaryTip)}
              </div>
            </div>

            <div class="row g-2 mb-3 small">
              <div class="col-sm-6">
                <span class="text-muted d-block">💰 Cost Comparison:</span>
                <span class="fw-semibold text-dark">${escapeHtml(item.costComparison)}</span>
              </div>
              <div class="col-sm-6">
                <span class="text-muted d-block">⏱️ Preparation / Prep Time:</span>
                <span class="fw-semibold text-dark">${escapeHtml(item.preparationTime)}</span>
              </div>
            </div>

            <div class="mb-2 small">
              <span class="text-muted d-block">🛒 Availability:</span>
              <span class="text-secondary">${escapeHtml(item.availability)}</span>
            </div>

            <div class="mb-2 small">
              <span class="text-muted d-block">🥗 Nutrition:</span>
              <span class="text-secondary">${escapeHtml(item.nutritionalHighlights)}</span>
            </div>

            ${item.notRecommendedFor ? `
              <div class="mt-2 small text-muted">
                <strong>⚠️ Caution:</strong> ${escapeHtml(item.notRecommendedFor)}
              </div>
            ` : ""}
          </div>
          <div class="card-footer bg-light px-4 py-2 border-top-0 d-flex justify-content-between align-items-center">
            <div class="small">
              <span class="text-muted me-1">Allergens:</span>
              ${allergenBadges || '<span class="text-muted">None</span>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function wireFilters() {
  const searchInput = document.getElementById("altSearchInput");
  const allergenSelect = document.getElementById("altAllergenSelect");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderAlternativeCards();
    });
  }

  if (allergenSelect) {
    allergenSelect.addEventListener("change", (e) => {
      currentAllergenExclude = e.target.value;
      renderAlternativeCards();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderCategoryPills();
  renderAlternativeCards();
  wireFilters();
});
