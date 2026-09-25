/* ==========================================================================
   VeganSaathi — auth-ui.js
   Client-side validation only. No credentials are stored anywhere, and no
   network/Firebase calls happen here — that is Phase 4's job. Each form
   shows a clear "coming in a later phase" message on successful validation.
   ========================================================================== */

function showFormNote(elId, message, isError) {
  const el = document.getElementById(elId);
  el.textContent = message;
  el.classList.remove("d-none");
  if (isError) {
    el.style.backgroundColor = "#fbeaea";
    el.style.borderColor = "#f0c3c3";
    el.style.color = "#8a2f2f";
  } else {
    el.style.backgroundColor = "";
    el.style.borderColor = "";
    el.style.color = "";
  }
}

function wireLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) {
      showFormNote("loginFeedback", "Please enter both email and password.", true);
      return;
    }
    showFormNote("loginFeedback", "Authentication will be connected in Phase 4. No account was actually signed in.", false);
  });
}

function wireRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirm = document.getElementById("registerConfirm").value;
    const diet = document.getElementById("registerDiet").value;

    if (!name || !email || !password || !confirm || !diet) {
      showFormNote("registerFeedback", "Please fill in every field before creating an account.", true);
      return;
    }
    if (password.length < 6) {
      showFormNote("registerFeedback", "Password should be at least 6 characters.", true);
      return;
    }
    if (password !== confirm) {
      showFormNote("registerFeedback", "Passwords do not match.", true);
      return;
    }
    showFormNote("registerFeedback", "Firebase authentication will be implemented in Phase 4. No account or password was stored.", false);
  });
}

function wireSubmitPlaceForm() {
  const form = document.getElementById("submitPlaceForm");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("spName").value.trim();
    const type = document.getElementById("spType").value;
    const address = document.getElementById("spAddress").value.trim();
    const dietChecks = document.querySelectorAll('input[name="spDiet"]:checked');

    if (!name || !type || !address || dietChecks.length === 0) {
      showFormNote("submitPlaceFeedback", "Please fill in the place name, type, address, and select at least one dietary category.", true);
      return;
    }
    showFormNote("submitPlaceFeedback", "Demo: this submission workflow will be connected to Firestore in a later phase. New places go to a pending queue for admin review before appearing publicly — nothing was saved yet.", false);
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  wireLoginForm();
  wireRegisterForm();
  wireSubmitPlaceForm();
});
