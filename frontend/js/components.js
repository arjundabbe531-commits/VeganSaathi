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
    { key: "home", label: "Home", href: base + "index.html" },
    { key: "explore", label: "Explore", href: base + "explore.html" },
    { key: "alternatives", label: "Alternatives", href: base + "alternatives/index.html" },
    { key: "awareness", label: "Awareness", href: base + "awareness/what-is-veganism.html" }
  ];

  if (user) {
    links.push({ key: "community", label: "Contribute", href: base + "submit-place.html" });
  }

  const linkHtml = links.map(function (l) {
    const activeClass = l.key === activePage ? " active" : "";
    return '<li class="nav-item"><a class="nav-link' + activeClass + '" href="' + l.href + '">' + l.label + "</a></li>";
  }).join("");

  const adminBtnHtml = isAdmin
    ? '<a href="' + base + 'admin/dashboard.html" class="btn btn-warning btn-sm me-2 text-dark" style="font-weight:600;">Admin</a>'
    : '';

  const authHtml = user
    ? adminBtnHtml +
      '<a href="' + base + 'profile.html" class="btn btn-vs-outline btn-sm me-2">Profile</a>' +
      '<button type="button" id="navLogoutBtn" class="btn btn-vs-primary btn-sm">Logout</button>'
    : '<a href="' + base + 'login.html" class="btn btn-vs-outline btn-sm me-2">Login</a>' +
      '<a href="' + base + 'register.html" class="btn btn-vs-primary btn-sm">Register</a>';

  el.innerHTML =
    '<nav class="navbar navbar-expand-lg vs-navbar sticky-top">' +
    '<div class="container">' +
    '<a class="navbar-brand" href="' + base + 'index.html">' +
    '<span>🌿 VeganSaathi</span>' +
    '<span class="navbar-brand-badge d-none d-sm-inline">SSGMCE CEP</span>' +
    '</a>' +
    '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#vsNavCollapse" aria-controls="vsNavCollapse" aria-expanded="false" aria-label="Toggle navigation">' +
    '<span class="navbar-toggler-icon"></span></button>' +
    '<div class="collapse navbar-collapse" id="vsNavCollapse">' +
    '<ul class="navbar-nav me-auto mb-2 mb-lg-0">' + linkHtml + "</ul>" +
    authHtml +
    "</div></div></nav>";
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
    "<h5>VeganSaathi</h5>" +
    '<p class="text-muted-vs" style="color:#c8d3c0;">Connecting people. Promoting veganism. ' +
    "Community-verified vegan, vegetarian, Jain and eggetarian food discovery \u2014 started at SSGMCE, Shegaon, open to all.</p>" +
    "</div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Explore</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'explore.html">Find places</a></li>' +
    '<li><a href="' + base + 'alternatives/index.html">Vegan alternatives</a></li>' +
    '<li><a href="' + base + 'submit-place.html">Submit a place</a></li>' +
    '<li><a href="' + base + 'saved.html">Saved places</a></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Awareness</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'awareness/what-is-veganism.html">What is veganism?</a></li>' +
    '<li><a href="' + base + 'awareness/vegetarian-vs-vegan.html">Vegetarian vs vegan</a></li>' +
    '<li><a href="' + base + 'awareness/misconceptions.html">Misconceptions</a></li>' +
    '<li><a href="' + base + 'awareness/getting-started.html">Getting started</a></li>' +
    '<li><a href="' + base + 'awareness/plant-based-indian-foods.html">Indian plant foods</a></li>' +
    '<li><a href="' + base + 'awareness/faq.html">Student FAQ</a></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>About</h5><ul class=\"list-unstyled\">" +
    "<li>SSGMCE, Shegaon — B.E. IT CEP</li>" +
    "<li>Sant Gadge Baba Amravati University</li>" +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Contact</h5><ul class=\"list-unstyled\">" +
    '<li><a href="mailto:vegansaathi.cep@gmail.com">Email Team</a></li>' +
    '<li><a href="https://github.com/arjundabbe531-commits/VeganSaathi" target="_blank" rel="noopener noreferrer">GitHub Project</a></li>' +
    "</ul></div>" +
    "</div>" +
    '<div class="vs-footer__bottom">&copy; 2026 VeganSaathi — A student Community Engagement Project. Not a commercial product.</div>' +
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
    { key: "faq", label: "Student FAQ", href: base + "awareness/faq.html" }
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
    const staleNote = isRecheckDue(place.lastVerifiedAt instanceof Date ? place.lastVerifiedAt : null)
      ? ' <span class="vs-verify-stale">(re-check due)</span>'
      : "";
    return (
      '<span class="vs-verify"><span class="vs-verify__dot"></span>Verified — last checked ' +
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
  var metaText = [capitalize(place.placeType), place.area]
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
      imageSlotHtml = escapeHtml(placeImageLabel(place));
    }
  } else {
    imageSlotHtml = escapeHtml(placeImageLabel(place));
  }

  return (
    '<div class="col-sm-6 col-lg-4">' +
    '<div class="vs-card vs-place-card">' +
    '<div class="vs-place-card__image">' + imageSlotHtml + "</div>" +
    '<div class="vs-place-card__body">' +
    '<h3 class="vs-place-card__title">' + escapeHtml(place.name) + "</h3>" +
    '<div class="vs-place-card__meta">' + metaText + "</div>" +
    '<div>' + renderDietBadges(place.dietTags) + "</div>" +
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
