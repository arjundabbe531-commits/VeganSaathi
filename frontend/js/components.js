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
function renderNavbar(activePage, user) {
  const base = vsBase();
  const el = document.getElementById("navbar-placeholder");
  if (!el) return;

  const links = [
    { key: "home", label: "Home", href: base + "index.html" },
    { key: "explore", label: "Explore", href: base + "explore.html" },
    { key: "awareness", label: "Awareness", href: base + "awareness/what-is-veganism.html" },
    { key: "community", label: "Community", href: base + "submit-place.html" }
  ];

  const linkHtml = links.map(function (l) {
    const activeClass = l.key === activePage ? " active" : "";
    return '<li class="nav-item"><a class="nav-link' + activeClass + '" href="' + l.href + '">' + l.label + "</a></li>";
  }).join("");

  const authHtml = user
    ? '<a href="' + base + 'profile.html" class="btn btn-vs-outline btn-sm me-2">Profile</a>' +
      '<button type="button" id="navLogoutBtn" class="btn btn-vs-primary btn-sm">Logout</button>'
    : '<a href="' + base + 'login.html" class="btn btn-vs-outline btn-sm me-2">Login</a>' +
      '<a href="' + base + 'register.html" class="btn btn-vs-primary btn-sm">Register</a>';

  el.innerHTML =
    '<nav class="navbar navbar-expand-lg vs-navbar sticky-top">' +
    '<div class="container">' +
    '<a class="navbar-brand" href="' + base + 'index.html">VeganSaathi</a>' +
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
    "A community-verified vegan/vegetarian/Jain/eggetarian food discovery pilot for SSGMCE and nearby Shegaon.</p>" +
    "</div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Explore</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'explore.html">Find places</a></li>' +
    '<li><a href="' + base + 'submit-place.html">Submit a place</a></li>' +
    '<li><a href="' + base + 'saved.html">Saved places</a></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Awareness</h5><ul class=\"list-unstyled\">" +
    '<li><a href="' + base + 'awareness/what-is-veganism.html">What is veganism?</a></li>' +
    '<li><a href="' + base + 'awareness/vegetarian-vs-vegan.html">Vegetarian vs vegan</a></li>' +
    '<li><a href="' + base + 'awareness/faq.html">FAQ</a></li>' +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>About</h5><ul class=\"list-unstyled\">" +
    "<li>SSGMCE, Shegaon — B.E. IT CEP</li>" +
    "<li>Sant Gadge Baba Amravati University</li>" +
    "</ul></div>" +
    '<div class="col-6 col-md-2">' +
    "<h5>Contact</h5><ul class=\"list-unstyled\">" +
    "<li>Contact details placeholder</li>" +
    "<li>Privacy notice placeholder</li>" +
    "</ul></div>" +
    "</div>" +
    '<div class="vs-footer__bottom">&copy; 2026 VeganSaathi — A student Community Engagement Project. Not a commercial product.</div>' +
    "</div></footer>";
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

/* ---------------- Diet badges ---------------- */
// Real configuration (not mock data), so it lives here rather than in mock-data.js:
// removing mock-data.js from a page must never break the diet badges.
const DIET_TAG_LABELS = {
  vegan: { label: "Vegan", cssClass: "vs-badge-vegan" },
  vegetarian: { label: "Vegetarian", cssClass: "vs-badge-vegetarian" },
  eggetarian: { label: "Eggetarian", cssClass: "vs-badge-eggetarian" },
  jain: { label: "Jain", cssClass: "vs-badge-jain" }
};

function renderDietBadges(dietTags) {
  if (!Array.isArray(dietTags)) return "";
  return dietTags.map(function (tag) {
    const info = DIET_TAG_LABELS[tag];
    if (!info) return "";
    return '<span class="vs-badge ' + info.cssClass + '">' + info.label + "</span>";
  }).join(" ");
}

/* ---------------- Verification badge ---------------- */
function renderVerificationBadge(place) {
  const verifiedOn = formatDate(place.lastVerifiedAt);
  if (place.verificationStatus === "verified" && verifiedOn) {
    return (
      '<span class="vs-verify"><span class="vs-verify__dot"></span>Verified — last checked ' +
      escapeHtml(verifiedOn) +
      "</span>"
    );
  }
  return '<span class="vs-verify unverified"><span class="vs-verify__dot"></span>Not yet verified</span>';
}

/* ---------------- Place card ---------------- */
function renderPlaceCard(place) {
  // Type and area are both optional-ish: join only the parts that exist so a place
  // with no area doesn't render "Mess · undefined".
  const metaText = [capitalize(place.placeType), place.area]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &middot; ");
  const priceText = place.priceRange ? capitalize(place.priceRange) : "Price not listed";

  return (
    '<div class="col-sm-6 col-lg-4">' +
    '<div class="vs-card vs-place-card">' +
    '<div class="vs-place-card__image">' + escapeHtml(placeImageLabel(place)) + "</div>" +
    '<div class="vs-place-card__body">' +
    '<h3 class="vs-place-card__title">' + escapeHtml(place.name) + "</h3>" +
    '<div class="vs-place-card__meta">' + metaText + "</div>" +
    '<div>' + renderDietBadges(place.dietTags) + "</div>" +
    '<div class="d-flex justify-content-between align-items-center mt-1">' +
    '<span class="text-muted-vs" style="font-size:0.85rem;">' + escapeHtml(priceText) + "</span>" +
    renderVerificationBadge(place) +
    "</div>" +
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
