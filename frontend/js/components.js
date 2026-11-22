/* ==========================================================================
   VeganSaathi — components.js
   Small, plain-JS reusable render functions. No framework, no build step —
   each page includes this file and calls the functions it needs.
   Each page sets `window.VS_BASE` before this file runs (see app.js) so
   links work whether the page lives at the root or one folder deep
   (e.g. /awareness/ or /admin/).
   ========================================================================== */

function vsBase() {
  return typeof window.VS_BASE === "string" ? window.VS_BASE : "";
}

/* ---------------- Navbar ---------------- */
// `user` is optional: undefined/null renders the logged-out state
// (Login/Register); a Firebase Auth User object renders the logged-in state
// (Profile/Logout). app.js calls this again every time auth state changes,
// so the navbar updates live without a page reload.
function renderNavbar(activePage, user, isAdmin) {
  const base = vsBase();
  const el = document.getElementById("navbar-placeholder");
  if (!el) return;

  const links = [
    { key: "home",         label: "Home",               href: base + "index.html" },
    { key: "explore",      label: "Explore",             href: base + "explore.html" },
    { key: "alternatives", label: "Alternatives",        href: base + "alternatives/index.html" },
    { key: "compass",      label: "Ingredient Compass",  href: base + "awareness/ingredient-checker.html" },
    { key: "awareness",    label: "Awareness",           href: base + "awareness/what-is-veganism.html" }
  ];

  if (user) {
    links.push({ key: "community", label: "Contribute", href: base + "submit-place.html" });
  }

  const linkHtml = links.map(function (l) {
    const isActive = l.key === activePage;
    return (
      '<li class="nav-item vs-nav-item">' +
      '<a class="nav-link vs-nav-link' + (isActive ? ' active vs-nav-link--active' : '') + '" href="' + l.href + '">' +
      '<span class="vs-nav-link__text">' + l.label + '</span>' +
      (isActive ? '<span class="vs-nav-link__bar" aria-hidden="true"></span>' : '') +
      '</a></li>'
    );
  }).join('');

  const adminBtnHtml = isAdmin
    ? '<a href="' + base + 'admin/dashboard.html" class="vs-nav-admin-btn me-2" aria-label="Admin Dashboard">Admin ▲</a>'
    : '';

  const diningCardBtnHtml = '<button type="button" id="openNavDiningCardBtn" class="vs-nav-tool-btn me-2" title="Bilingual dining card for Maharashtra restaurants">🌿 Dining Card</button>';

  const authHtml = user
    ? adminBtnHtml + diningCardBtnHtml +
      '<a href="' + base + 'profile.html" class="btn btn-vs-outline btn-sm me-2 px-3" style="font-size:0.83rem;font-weight:600;border-radius:8px;">My Profile</a>' +
      '<button type="button" id="navLogoutBtn" class="btn btn-vs-primary btn-sm px-3" style="font-size:0.83rem;border-radius:8px;">Sign Out</button>'
    : diningCardBtnHtml +
      '<a href="' + base + 'login.html" class="btn btn-vs-outline btn-sm me-2 px-3" style="font-size:0.83rem;font-weight:600;border-radius:8px;">Login</a>' +
      '<a href="' + base + 'register.html" class="btn btn-vs-primary btn-sm px-3" style="font-size:0.83rem;border-radius:8px;">Join Free</a>';

  // Top announce strip — civic portal identity
  const topStripHtml =
    '<div class="vs-topstrip" role="banner">' +
    '<div class="container d-flex justify-content-between align-items-center">' +
    '<span class="vs-topstrip__left">' +
    '<svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" class="me-1" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#4c9a61"/></svg>' +
    'Community-verified vegan discovery portal &nbsp;&middot;&nbsp; Maharashtra &amp; India' +
    '</span>' +
    '<span class="vs-topstrip__right">अहिंसा परमो धर्म:</span>' +
    '</div>' +
    '</div>';

  // SVG leaf logo
  const logoHtml =
    '<a class="vs-brand" href="' + base + 'index.html" aria-label="VeganSaathi — Go to Home">' +
    '<span class="vs-brand__accent" aria-hidden="true"></span>' +
    '<svg class="vs-brand__leaf" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M15 4C15 4 6 9.5 6 17.5C6 22.2 9.8 26 14.5 26C14.8 26 15.1 25.98 15.4 25.95V4H15Z" fill="#2f6b3f"/>' +
    '<path d="M15 4C15 4 24 9.5 24 17.5C24 22.2 20.2 26 15.5 26C15.2 26 14.9 25.98 14.6 25.95V4H15Z" fill="#4c9a61" opacity="0.75"/>' +
    '<line x1="15" y1="26" x2="15" y2="12" stroke="#135229" stroke-width="1" stroke-linecap="round" stroke-dasharray="2 3"/>' +
    '</svg>' +
    '<span class="vs-brand__wordmark">' +
    '<span class="vs-brand__w1">Vegan</span>' +
    '<span class="vs-brand__w2">Saathi</span>' +
    '</span>' +
    '</a>';

  el.innerHTML =
    topStripHtml +
    '<nav class="navbar navbar-expand-lg vs-navbar sticky-top" role="navigation" aria-label="Main navigation">' +
    '<div class="container vs-navbar__inner">' +
    logoHtml +
    '<button class="navbar-toggler vs-nav-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#vsNavCollapse" aria-controls="vsNavCollapse" aria-expanded="false" aria-label="Toggle navigation">' +
    '<span class="navbar-toggler-icon"></span>' +
    '</button>' +
    '<div class="collapse navbar-collapse" id="vsNavCollapse">' +
    '<ul class="navbar-nav vs-nav-links me-auto mb-2 mb-lg-0">' + linkHtml + '</ul>' +
    '<div class="vs-nav-actions d-flex align-items-center flex-wrap gap-1">' + authHtml + '</div>' +
    '</div>' +
    '</div>' +
    '</nav>';
}

/* ---------------- Footer ---------------- */
function renderFooter() {
  const base = vsBase();
  const el = document.getElementById("footer-placeholder");
  if (!el) return;

  el.innerHTML =
    '<footer class="vs-footer">' +
    '<div class="container">' +
    '<div class="row g-4">' +
    '<div class="col-md-4">' +
    '<div class="d-flex align-items-center gap-2 mb-2">' +
    '<span style="font-size:1.4rem;">🌱</span>' +
    '<h5 class="mb-0 text-white fw-bold" style="letter-spacing:-0.02em;">VeganSaathi</h5>' +
    '</div>' +
    '<p class="text-muted-vs" style="color:#c8d3c0; font-size:0.9rem; line-height:1.6;">' +
    "Community-led discovery platform for conscious, ethical, and plant-based dining. " +
    "Empowering individuals, families, and travellers with transparent, evidence-checked foodways across Maharashtra and India.</p>" +
    '<div class="d-flex flex-wrap gap-2 mt-3">' +
    '<span class="badge border border-success text-success bg-white" style="font-size:0.75rem;">🛡️ Transparent Verification</span>' +
    '<span class="badge border border-success text-success bg-white" style="font-size:0.75rem;">🌱 100% Non-Profit</span>' +
    '</div>' +
    "</div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Discovery</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'explore.html">Find Places</a></li>' +
    '<li><a href="' + base + 'explore.html?diet=vegan">100% Vegan Venues</a></li>' +
    '<li><a href="' + base + 'explore.html?diet=jain">Jain-Friendly Dining</a></li>' +
    '<li><a href="' + base + 'alternatives/index.html">Plant-Based Alternatives</a></li>' +
    '<li><a href="' + base + 'awareness/ingredient-checker.html">Ingredient Compass</a></li>' +
    '<li><a href="#" class="vs-dining-card-trigger">Bilingual Dining Card</a></li>' +
    '<li><a href="' + base + 'saved.html">Saved Bookmarks</a></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Knowledge Hub</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'awareness/what-is-veganism.html">What is Veganism?</a></li>' +
    '<li><a href="' + base + 'awareness/vegetarian-vs-vegan.html">Vegetarian vs Vegan</a></li>' +
    '<li><a href="' + base + 'awareness/plant-based-indian-foods.html">Indian Plant Foods</a></li>' +
    '<li><a href="' + base + 'awareness/misconceptions.html">Common Misconceptions</a></li>' +
    '<li><a href="' + base + 'awareness/getting-started.html">Getting Started Guide</a></li>' +
    '<li><a href="' + base + 'awareness/faq.html">Community FAQ</a></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Community &amp; Ethics</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'awareness/what-is-veganism.html#spiritual-roots">Spiritual Heritage &amp; Saints</a></li>' +
    '<li><a href="' + base + 'awareness/what-is-veganism.html#compassion">Ahimsa &amp; Karuna Values</a></li>' +
    '<li><span style="color:#b5c7b3;">Maharashtra, India</span></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Get Involved</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'register.html">Join Community</a></li>' +
    '<li><a href="mailto:vegansaathi@gmail.com">Contact Editorial Team</a></li>' +
    '<li><a href="https://github.com/arjundabbe-work-commits/VeganSaathi" target="_blank" rel="noopener noreferrer">Open Source Repository</a></li>' +
    "</ul></div>" +
    "</div>" +
    '<div class="vs-footer__bottom d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">' +
    '<div>&copy; 2026 VeganSaathi Community Portal. Created for civic good and conscious living. Open-access and independent.</div>' +
    '<div class="d-flex flex-wrap gap-2 text-muted" style="font-size:0.78rem;">' +
    '<span>Maharashtra &bull; India</span>' +
    '<span>Pure Compassion (अहिंसा परमो धर्म:)</span>' +
    '</div>' +
    '</div>' +
    "</div></footer>";
}

/* ---------------- Awareness Sub-Navigation ---------------- */
function renderAwarenessNav(activeSubPage) {
  const base = vsBase();
  const el = document.getElementById("awareness-nav-placeholder");
  if (!el) return;

  const topics = [
    { key: "what-is-veganism", label: "What is Veganism?", href: base + "awareness/what-is-veganism.html" },
    { key: "vegetarian-vs-vegan", label: "Vegetarian vs Vegan", href: base + "awareness/vegetarian-vs-vegan.html" },
    { key: "misconceptions", label: "Misconceptions", href: base + "awareness/misconceptions.html" },
    { key: "getting-started", label: "Getting Started", href: base + "awareness/getting-started.html" },
    { key: "plant-based-indian-foods", label: "Indian Plant Foods", href: base + "awareness/plant-based-indian-foods.html" },
    { key: "faq", label: "Community FAQ", href: base + "awareness/faq.html" }
  ];

  const pillsHtml = topics.map(function (t) {
    const isActive = t.key === activeSubPage;
    const btnClass = isActive ? "btn-vs-primary" : "btn-outline-secondary";
    const ariaCurrent = isActive ? ' aria-current="page"' : '';
    return '<a href="' + t.href + '" class="btn btn-sm ' + btnClass + ' text-nowrap"' + ariaCurrent + '>' + t.label + '</a>';
  }).join(" ");

  el.innerHTML =
    '<nav class="vs-awareness-nav d-flex gap-2 overflow-auto py-2 mb-4" aria-label="Awareness topics navigation">' +
    pillsHtml +
    '</nav>';
}

/* ---------------- Shared helpers ---------------- */

// Escape text before it is placed inside an HTML string that will be assigned to
// innerHTML. Once place/review data comes from Firestore (and, later, from
// community submissions), any field could contain markup — this turns it into
// harmless literal text. Do NOT use it for text assigned via textContent (that is
// already safe, and escaping it too would show "&amp;" on screen).
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Turn a date-like value into "YYYY-MM-DD" (the same format the mock data already
// displays, so nothing changes visually). Accepts a Firestore Timestamp (anything
// with a toDate() method), a JS Date, an ISO-style string, or a millisecond number.
// Returns "" when the value is missing or not a valid date.
function formatDate(value) {
  if (value === null || value === undefined || value === "") return "";

  let date = null;
  if (typeof value === "object" && typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    // Already "YYYY-MM-DD..." — keep the date part as written. Re-parsing it with
    // new Date() would treat it as UTC midnight and can shift the day locally.
    const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDate) return isoDate[1];
    date = new Date(value);
  } else if (typeof value === "number") {
    date = new Date(value);
  }

  if (!date || isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

// Link to a place's detail page. The id is URL-encoded so an unusual id can't
// break out of the query string.
function placeDetailsUrl(placeId) {
  const id = placeId === null || placeId === undefined ? "" : String(placeId);
  return vsBase() + "place-details.html?id=" + encodeURIComponent(id);
}

// Text shown in the photo slot. Real photos arrive with the image phase (Cloudinary);
// until then a place without a mock label says so plainly instead of "undefined".
function placeImageLabel(place) {
  return place.imageLabel ? place.imageLabel + " (mock photo)" : "No photo yet";
}

// Inserts Cloudinary dynamic transformations for optimized image delivery.
// Returns original URL if not hosted on Cloudinary or missing.
function buildOptimizedImageUrl(rawUrl, width, height) {
  width = width || 800;
  height = height || 450;
  if (!rawUrl || typeof rawUrl !== "string") return "";
  var trimmed = rawUrl.trim();

  // Reject unsafe schemes immediately (javascript:, data:, vbscript:, file:)
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "";

  if (trimmed.indexOf("res.cloudinary.com") === -1) return trimmed;

  var uploadToken = "/image/upload/";
  var index = trimmed.indexOf(uploadToken);
  if (index === -1) return trimmed;

  var afterUpload = trimmed.slice(index + uploadToken.length);
  if (afterUpload.indexOf("c_") === 0 || afterUpload.indexOf("w_") === 0 || afterUpload.indexOf("f_") === 0) {
    return trimmed;
  }

  var transform = "c_fill,g_auto,w_" + Math.round(width) + ",h_" + Math.round(height) + ",q_auto,f_auto/";
  return trimmed.slice(0, index + uploadToken.length) + transform + afterUpload;
}

/* ---------------- Diet badges ---------------- */
// Real configuration (not mock data), so it lives here rather than in mock-data.js:
// removing mock-data.js from a page must never break the diet badges.
const DIET_TAG_LABELS = {
  vegan: { label: "Vegan", cssClass: "vs-badge-vegan", icon: "🌱" },
  vegetarian: { label: "Vegetarian", cssClass: "vs-badge-vegetarian", icon: "🥗" },
  eggetarian: { label: "Eggetarian", cssClass: "vs-badge-eggetarian", icon: "🥚" },
  jain: { label: "Jain", cssClass: "vs-badge-jain", icon: "🌿" }
};

function renderDietBadges(dietTags) {
  if (!Array.isArray(dietTags)) return "";
  return dietTags.map(function (tag) {
    const info = DIET_TAG_LABELS[tag];
    if (!info) return "";
    return '<span class="vs-badge ' + info.cssClass + '">' + info.icon + " " + info.label + "</span>";
  }).join(" ");
}

function isVeganDietVerified(place) {
  const claim = {
    fully_vegan: "fully_vegan_venue",
    vegan_friendly: "vegan_friendly_options",
    verified_vegan_options: "vegan_options"
  }[place?.veganClassification];
  const dietaryEvidence = Array.isArray(place?.evidenceRefs)
    ? place.evidenceRefs.find((ref) => hasFreshDietaryEvidence(ref, claim))
    : null;
  return Boolean(place &&
    place.verificationStatus === "verified" &&
    place.verificationDimensions &&
    place.verificationDimensions.vegan_options_verified === true &&
    ["fully_vegan", "vegan_friendly", "verified_vegan_options"].includes(place.veganClassification) &&
    ["ingredients_reviewed", "owner_confirmed", "vegansaathi_reviewed"].includes(place.evidenceStatus) &&
    dietaryEvidence &&
    Array.isArray(place.dietTags) && place.dietTags.includes("vegan"));
}

function hasFreshDietaryEvidence(ref, claim) {
  if (!ref || ref.claim !== claim || ref.validity !== "current" ||
      !["direct", "corroborating"].includes(ref.strength) || typeof ref.excerpt !== "string" || ref.excerpt.trim().length < 20 ||
      typeof ref.url !== "string" || !/^https:\/\//i.test(ref.url)) return false;
  const checkedAt = Date.parse(ref.lastCheckedAt);
  const age = Date.now() - checkedAt;
  return Number.isFinite(checkedAt) && age >= 0 && age <= 180 * 86400000;
}

function renderPlaceDietBadges(place) {
  if (!isVeganDietVerified(place)) return "";
  const labels = {
    fully_vegan: "Fully vegan",
    vegan_friendly: "Vegan-friendly options",
    verified_vegan_options: "Verified vegan options"
  };
  const label = labels[place.veganClassification];
  return label ? '<span class="vs-badge vs-badge-vegan">🌿 ' + label + "</span>" : "";
}

function renderDietBadgesDetailed(place) {
  if (!place || !Array.isArray(place.dietTags)) return "";
  const badges = [];

  // Vegan tier (evidence-gated)
  if (isVeganDietVerified(place)) {
    const labels = {
      fully_vegan: "🌱 100% Fully Vegan Venue",
      vegan_friendly: "🌿 Vegan-Friendly Options Available",
      verified_vegan_options: "✨ Verified Vegan Options on Menu"
    };
    const label = labels[place.veganClassification] || "🌱 Verified Vegan";
    badges.push('<span class="vs-badge vs-badge-vegan me-1 mb-1">' + escapeHtml(label) + "</span>");
  }

  // Vegetarian
  if (place.dietTags.includes("vegetarian") && place.veganClassification !== "fully_vegan") {
    badges.push('<span class="badge bg-light text-success border border-success me-1 mb-1">🥬 Vegetarian</span>');
  }

  // Jain
  if (place.dietTags.includes("jain")) {
    badges.push('<span class="badge bg-light text-warning border border-warning me-1 mb-1" style="color:#856404 !important; border-color:#ffeeba !important;">🪷 Jain Options</span>');
  }

  // Eggetarian
  if (place.dietTags.includes("eggetarian")) {
    badges.push('<span class="badge bg-light text-secondary border me-1 mb-1">🥚 Eggetarian Options</span>');
  }

  return badges.join("");
}

/* ---------------- Verification badge ---------------- */
// 90-day soft "re-check due" cue (Phase 5 decision D5, docs/PHASE_5_PLAN.md).
// Presentation only — never changes verificationStatus itself, and the
// absolute verified date is always still shown alongside it.
const VS_RECHECK_DUE_DAYS = 90;

function isRecheckDue(lastVerifiedAt) {
  if (!(lastVerifiedAt instanceof Date) || isNaN(lastVerifiedAt.getTime())) return false;
  const ageMs = Date.now() - lastVerifiedAt.getTime();
  return ageMs > VS_RECHECK_DUE_DAYS * 24 * 60 * 60 * 1000;
}

function renderVerificationBadge(place) {
  const verifiedOn = formatDate(place.lastVerifiedAt);
  if (place.verificationStatus === "verified" && verifiedOn) {
    const physicallyVisited = place.verificationDimensions?.physically_visited === true;
    const label = physicallyVisited ? "Field visit recorded — " : "Evidence reviewed — last checked ";
    const staleNote = isRecheckDue(place.lastVerifiedAt instanceof Date ? place.lastVerifiedAt : null)
      ? ' <span class="vs-verify-stale">(re-check due)</span>'
      : "";
    return (
      '<span class="vs-verify"><span class="vs-verify__dot"></span>' + label +
      escapeHtml(verifiedOn) +
      "</span>" + staleNote
    );
  }
  return '<span class="vs-verify unverified"><span class="vs-verify__dot"></span>Not yet verified</span>';
}

/* ---------------- Place card ---------------- */
function renderPlaceCard(place, km) {
  // Type and area are both optional-ish: join only the parts that exist so a place
  // with no area doesn't render "Mess · undefined".
  var metaText = [formatPlaceType(place.placeType), place.area]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &middot; ");
  var priceText = place.priceRange ? capitalize(place.priceRange) : "Price not listed";

  // Distance badge — only shown when the user has shared their location.
  // "~" prefix makes clear this is an approximate straight-line distance,
  // not walking or driving distance.
  var distanceBadge = "";
  if (typeof km === "number" && Number.isFinite(km)) {
    var dist = km < 10
      ? (Math.round(km * 10) / 10).toFixed(1) + " km"
      : Math.round(km) + " km";
    distanceBadge = '<span class="text-muted-vs font-tabular" style="font-size:0.80rem;" title="Approximate straight-line distance">\u007e' + escapeHtml(dist) + ' away</span>';
  }

  var imageSlotHtml = "";
  if (place.imageUrl && typeof place.imageUrl === "string" && place.imageUrl.trim().length > 0) {
    var thumbUrl = buildOptimizedImageUrl(place.imageUrl.trim(), 400, 260);
    if (thumbUrl) {
      imageSlotHtml = '<img class="vs-place-card__img" src="' + escapeHtml(thumbUrl) + '" alt="' + escapeHtml(place.name) + '" loading="lazy" data-fallback="' + escapeHtml(placeImageLabel(place)) + '" onerror="this.onerror=null;this.parentElement.textContent=this.getAttribute(\'data-fallback\')||\'No photo yet\';" />';
    } else {
      imageSlotHtml = '<div class="vs-place-card__placeholder"><span class="vs-place-card__placeholder-icon">🌿</span><span class="vs-place-card__placeholder-label">' + escapeHtml(placeImageLabel(place)) + '</span></div>';
    }
  } else {
    imageSlotHtml = '<div class="vs-place-card__placeholder"><span class="vs-place-card__placeholder-icon">🌿</span><span class="vs-place-card__placeholder-label">' + escapeHtml(placeImageLabel(place)) + '</span></div>';
  }

  return (
    '<div class="col-sm-6 col-lg-4">' +
    '<div class="vs-card vs-place-card">' +
    '<div class="vs-place-card__image">' + imageSlotHtml + "</div>" +
    '<div class="vs-place-card__body">' +
    '<h3 class="vs-place-card__title">' + escapeHtml(place.name) + "</h3>" +
    '<div class="vs-place-card__meta">' + metaText + "</div>" +
    '<div>' + renderPlaceDietBadges(place) + "</div>" +
    '<div class="d-flex justify-content-between align-items-center mt-1">' +
    '<span class="text-muted-vs" style="font-size:0.85rem;">' + escapeHtml(priceText) + "</span>" +
    renderVerificationBadge(place) +
    "</div>" +
    (distanceBadge ? '<div class="mt-1">' + distanceBadge + "</div>" : "") +
    '<a href="' + escapeHtml(placeDetailsUrl(place.id)) + '" class="btn btn-vs-primary btn-sm mt-2">View Details</a>' +
    "</div></div></div>"
  );
}

function capitalize(str) {
  if (!str) return "";
  const text = String(str);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPlaceType(type) {
  return ({ dessert: "Dessert shop", shop: "Grocery / food shop" })[type] || capitalize(type);
}

/* ---------------- Formal Bilingual Dietary Declaration Card ---------------- */
function showDiningCardModal() {
  let modalEl = document.getElementById("diningCardModal");
  if (!modalEl) {
    const div = document.createElement("div");
    div.id = "diningCardModal";
    div.className = "modal fade";
    div.tabIndex = -1;
    div.setAttribute("aria-hidden", "true");
    div.innerHTML = (
      '<div class="modal-dialog modal-dialog-centered modal-lg">' +
      '<div class="modal-content border-0 rounded-4 shadow-lg overflow-hidden" style="background:#fdfcf9;">' +
      '<div class="modal-header border-bottom py-3 px-4" style="background:linear-gradient(135deg, #135229 0%, #0d381c 100%); color:#fff;">' +
      '<div>' +
      '<div class="d-flex align-items-center gap-2 mb-1">' +
      '<span style="font-size:1.2rem;">🏛️</span>' +
      '<h5 class="modal-title fw-bold mb-0" style="letter-spacing:-0.02em; font-size:1.15rem;">अधिकृत आहार निवेदन / Dietary Declaration</h5>' +
      '</div>' +
      '<div style="font-size:0.75rem; color:#b7dfbe; letter-spacing:0.02em;">VEGANSAATHI COMMUNITY FOODWAY INITIATIVE &bull; MAHARASHTRA</div>' +
      '</div>' +
      '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
      '</div>' +
      '<div class="modal-body p-4">' +
      '<div class="p-3 rounded-3 mb-3" style="background:#ffffff; border:1.5px solid #d4e5d6; box-shadow:0 1px 3px rgba(0,0,0,0.04);">' +
      '<div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">' +
      '<span class="fw-bold" style="color:#135229; font-size:0.88rem; text-transform:uppercase; letter-spacing:0.03em;">मराठी (अधिकृत निवेदन — आचारी / व्यवस्थापक यांना दाखवावे):</span>' +
      '<span class="badge" style="background:#e8f3ea; color:#135229; font-size:0.72rem; border:1px solid #c7e2ce;">मराठी आवृत्ती</span>' +
      '</div>' +
      '<p class="mb-0 text-dark" style="line-height:1.75; font-size:0.95rem; font-family:\'Plus Jakarta Sans\', \'Noto Sans Devanagari\', sans-serif;" id="diningMrText">' +
      '“आदरणीय व्यवस्थापक व मुख्य आचारी (Chef) महोदय,<br>' +
      'मी पूर्णपणे वनस्पती-आधारित (व्हेगन) आहाराचे काटेकोर पालन करतो/करते. कृपया माझ्या भोजनात दूध, दही, साजूक तूप, लोणी, मलाई, पनीर, चीज, मध किंवा कोणताही प्राणिज घटक वापरू नये.<br>' +
      'कृपया माझे भोजन केवळ शुद्ध वनस्पती तेलामध्ये तयार करावे व अन्नावर अतिरिक्त तूप किंवा बटर लावू नये.<br>' +
      'आपल्या व्यावसायिक सहकार्याबद्दल धन्यवाद!”' +
      '</p>' +
      '</div>' +
      '<div class="p-3 rounded-3 mb-3" style="background:#ffffff; border:1.5px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.04);">' +
      '<div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">' +
      '<span class="fw-bold text-muted-vs" style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.03em;">English (To Executive Chef / Management):</span>' +
      '<span class="badge bg-light text-secondary border" style="font-size:0.72rem;">English Version</span>' +
      '</div>' +
      '<p class="text-muted-vs mb-0" style="line-height:1.7; font-size:0.9rem;" id="diningEnText">' +
      '“To the Executive Chef &amp; Restaurant Management,<br>' +
      'I strictly observe a 100% plant-based / vegan diet. Kindly ensure that all items prepared for my order contain no dairy or animal derivatives (including milk, butter, ghee, curd/yogurt, cream, paneer, cheese, or honey).<br>' +
      'Please prepare the meal using pure vegetable/plant oils only, without any butter or ghee glaze.<br>' +
      'Thank you for your professional consideration and courteous accommodation.”' +
      '</p>' +
      '</div>' +
      '<div class="d-flex gap-2 flex-wrap">' +
      '<button type="button" class="btn btn-outline-success btn-sm flex-grow-1 py-2" id="copyDiningMrBtn" style="font-weight:600;">📋 Copy Marathi Notice</button>' +
      '<button type="button" class="btn btn-outline-secondary btn-sm flex-grow-1 py-2" id="copyDiningEnBtn" style="font-weight:600;">📋 Copy English Notice</button>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer border-top bg-white py-2.5 px-4 d-flex justify-content-between align-items-center">' +
      '<small class="text-muted-vs" style="font-size:0.78rem;">✓ Designed for restaurants, dhabas, canteens &amp; prasadalayas across Maharashtra</small>' +
      '<button type="button" class="btn btn-vs-outline btn-sm px-4" data-bs-dismiss="modal">Close</button>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
    document.body.appendChild(div);
    modalEl = div;

    div.querySelector("#copyDiningMrBtn").addEventListener("click", function () {
      const text = div.querySelector("#diningMrText").innerText.replace(/[“”]/g, "").trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          div.querySelector("#copyDiningMrBtn").textContent = "✓ Copied to Clipboard!";
          setTimeout(function () { div.querySelector("#copyDiningMrBtn").textContent = "📋 Copy Marathi Notice"; }, 2000);
        });
      }
    });

    div.querySelector("#copyDiningEnBtn").addEventListener("click", function () {
      const text = div.querySelector("#diningEnText").innerText.replace(/[“”]/g, "").trim();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          div.querySelector("#copyDiningEnBtn").textContent = "✓ Copied to Clipboard!";
          setTimeout(function () { div.querySelector("#copyDiningEnBtn").textContent = "📋 Copy English Notice"; }, 2000);
        });
      }
    });
  }

  const modal = (typeof bootstrap !== "undefined" && bootstrap.Modal)
    ? bootstrap.Modal.getOrCreateInstance(modalEl)
    : null;
  if (modal) modal.show();
}

if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
  document.addEventListener("click", function (e) {
    if (e.target.closest("#openNavDiningCardBtn") || e.target.closest(".vs-dining-card-trigger") || e.target.closest("#openDiningCardBtn")) {
      e.preventDefault();
      showDiningCardModal();
    }
    // lang toggle removed — Google Translate handles translations natively
  });
}

/* ---------------- Review card ---------------- */
function renderReviewCard(review) {
  // Clamp to a whole number 0-5 so an unexpected value (e.g. a string or -1) can't
  // make String.repeat() throw and take the whole reviews list down with it.
  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating)) || 0));
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  return (
    '<div class="vs-card p-3 mb-2">' +
    '<div class="d-flex justify-content-between">' +
    "<strong>" + escapeHtml(review.userName) + "</strong>" +
    '<span aria-label="' + rating + ' out of 5 stars" style="color:#b8862f;">' + stars + "</span>" +
    "</div>" +
    '<p class="mb-1">' + escapeHtml(review.comment) + "</p>" +
    '<div class="text-muted-vs" style="font-size:0.78rem;">' + escapeHtml(formatDate(review.createdAt)) + "</div>" +
    "</div>"
  );
}
