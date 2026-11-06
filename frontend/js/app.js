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

import { onAuthChange, fetchUserProfile } from "./auth-state.js";
import { logoutUser } from "./auth-ui.js";

function initApp() {
  const activePage = window.VS_ACTIVE_PAGE || "";

  // Render immediately in logged-out shape
  renderNavbar(activePage, null, false);
  renderFooter();

  if (typeof renderAwarenessNav === "function" && window.VS_AWARENESS_SUBPAGE) {
    renderAwarenessNav(window.VS_AWARENESS_SUBPAGE);
  }

  onAuthChange(async function (user) {
    let isAdmin = false;
    if (user && user.uid) {
      try {
        const profile = await fetchUserProfile(user.uid);
        if (profile && profile.role === "admin") {
          isAdmin = true;
        }
      } catch (err) {
        isAdmin = false;
      }
    }
    renderNavbar(activePage, user, isAdmin);
    wireLogoutButton();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

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
