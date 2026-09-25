/* ==========================================================================
   VeganSaathi — app.js
   Runs on every page. Injects the shared navbar/footer and highlights the
   active nav link. `window.VS_BASE` and `window.VS_ACTIVE_PAGE` must be set
   in an inline <script> at the top of each page, before this file loads.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  renderNavbar(window.VS_ACTIVE_PAGE || "");
  renderFooter();
});
