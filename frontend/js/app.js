/* ==========================================================================
   VeganSaathi — app.js
   Runs on every page. Injects the shared navbar/footer, highlights the
   active nav link, and keeps the navbar in sync with Firebase auth state
   (Login/Register when signed out, Profile/Logout when signed in) — without
   ever reloading the page. `window.VS_BASE` and `window.VS_ACTIVE_PAGE` must
   be set in an inline <script> at the top of each page, before this file
   loads.

   This file is loaded as an ES module (`<script type="module" src="js/app.js">`)
   because it imports from auth-state.js, which imports from firebase-init.js.
   mock-data.js/components.js are still loaded as plain classic scripts
   earlier in the page, so their globals (renderNavbar, renderFooter, ...)
   are already on `window` by the time this module runs.
   ========================================================================== */

import { onAuthChange } from "./auth-state.js";
import { logoutUser } from "./auth-ui.js";

document.addEventListener("DOMContentLoaded", function () {
  const activePage = window.VS_ACTIVE_PAGE || "";

  // Render once immediately in the logged-out shape so the page never shows
  // a blank navbar while Firebase resolves the real state — then
  // onAuthChange re-renders with the real state as soon as it's known, and
  // again on every future sign-in/sign-out.
  renderNavbar(activePage, null);
  renderFooter();

  onAuthChange(function (user) {
    renderNavbar(activePage, user);
    wireLogoutButton();
  });
});

function wireLogoutButton() {
  const btn = document.getElementById("navLogoutBtn");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "Logging out...";
    try {
      await logoutUser();
      // onAuthChange's own listener will fire and re-render the navbar back
      // to the logged-out state — no manual re-render or reload needed.
    } catch (error) {
      console.error("VeganSaathi: logout failed.", error);
      btn.disabled = false;
      btn.textContent = "Logout";
    }
  });
}
