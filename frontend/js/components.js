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
function renderNavbar(activePage) {
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

  el.innerHTML =
    '<nav class="navbar navbar-expand-lg vs-navbar sticky-top">' +
    '<div class="container">' +
    '<a class="navbar-brand" href="' + base + 'index.html">VeganSaathi</a>' +
    '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#vsNavCollapse" aria-controls="vsNavCollapse" aria-expanded="false" aria-label="Toggle navigation">' +
    '<span class="navbar-toggler-icon"></span></button>' +
    '<div class="collapse navbar-collapse" id="vsNavCollapse">' +
    '<ul class="navbar-nav me-auto mb-2 mb-lg-0">' + linkHtml + "</ul>" +
    '<a href="' + base + 'login.html" class="btn btn-vs-outline btn-sm me-2">Login</a>' +
    '<a href="' + base + 'register.html" class="btn btn-vs-primary btn-sm">Register</a>' +
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

/* ---------------- Diet badges ---------------- */
function renderDietBadges(dietTags) {
  return dietTags.map(function (tag) {
    const info = DIET_TAG_LABELS[tag];
    if (!info) return "";
    return '<span class="vs-badge ' + info.cssClass + '">' + info.label + "</span>";
  }).join(" ");
}

/* ---------------- Verification badge ---------------- */
function renderVerificationBadge(place) {
  if (place.verificationStatus === "verified" && place.lastVerifiedAt) {
    return (
      '<span class="vs-verify"><span class="vs-verify__dot"></span>Verified — last checked ' +
      place.lastVerifiedAt +
      "</span>"
    );
  }
  return '<span class="vs-verify unverified"><span class="vs-verify__dot"></span>Not yet verified</span>';
}

/* ---------------- Place card ---------------- */
function renderPlaceCard(place) {
  const base = vsBase();
  return (
    '<div class="col-sm-6 col-lg-4">' +
    '<div class="vs-card vs-place-card">' +
    '<div class="vs-place-card__image">' + place.imageLabel + " (mock photo)</div>" +
    '<div class="vs-place-card__body">' +
    '<h3 class="vs-place-card__title">' + place.name + "</h3>" +
    '<div class="vs-place-card__meta">' + capitalize(place.placeType) + " &middot; " + place.area + "</div>" +
    '<div>' + renderDietBadges(place.dietTags) + "</div>" +
    '<div class="d-flex justify-content-between align-items-center mt-1">' +
    '<span class="text-muted-vs" style="font-size:0.85rem;">' + capitalize(place.priceRange) + "</span>" +
    renderVerificationBadge(place) +
    "</div>" +
    '<a href="' + base + "place-details.html?id=" + place.id + '" class="btn btn-vs-primary btn-sm mt-2">View Details</a>' +
    "</div></div></div>"
  );
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------------- Review card ---------------- */
function renderReviewCard(review) {
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  return (
    '<div class="vs-card p-3 mb-2">' +
    '<div class="d-flex justify-content-between">' +
    "<strong>" + review.userName + "</strong>" +
    '<span aria-label="' + review.rating + ' out of 5 stars" style="color:#b8862f;">' + stars + "</span>" +
    "</div>" +
    '<p class="mb-1">' + review.comment + "</p>" +
    '<div class="text-muted-vs" style="font-size:0.78rem;">' + review.createdAt + "</div>" +
    "</div>"
  );
}
