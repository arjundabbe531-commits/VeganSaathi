/* ==========================================================================
   VeganSaathi — auth-ui.js
   Phase 4 — Firebase Authentication

   Handles:
   - Email/password registration
   - Email/password login
   - Remember me
   - Password reset
   - Google sign-in
   - Logout helper
   - Firebase Auth + Firestore profile creation
   - Friendly error handling

   Firebase is initialized only through firebase-init.js.
   ========================================================================== */

import {
  getFirebaseAuth,
  getFirebaseDb
} from "./firebase-init.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";


/* ---------------- Form feedback ---------------- */

function showFormNote(elId, message, isError) {
  const el = document.getElementById(elId);

  if (!el) return;

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


/* ---------------- Button loading state ---------------- */

function setButtonLoading(button, loading, loadingText) {
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent =
      button.dataset.originalText || button.textContent;
  }
}


/* ---------------- Authentication error messages ---------------- */

function getFriendlyAuthError(error) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email address.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/weak-password":
      return "Password is too weak. Please use a stronger password.";

    case "auth/invalid-credential":
      return "The email or password is incorrect.";

    case "auth/user-not-found":
      return "No account was found with this email address.";

    case "auth/wrong-password":
      return "The email or password is incorrect.";

    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";

    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";

    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase.";

    case "auth/user-disabled":
      return "This account has been disabled.";

    default:
      console.error("Firebase Authentication error:", error);
      return "Something went wrong. Please try again.";
  }
}


/* ---------------- Firestore error messages ---------------- */

function getFriendlyFirestoreError(error) {
  switch (error.code) {
    case "permission-denied":
      return "Your account was created, but your profile could not be saved to the database.";

    case "unavailable":
      return "The database is temporarily unavailable. Please try again.";

    case "failed-precondition":
      return "The database request could not be completed.";

    case "not-found":
      return "The requested database record could not be found.";

    default:
      console.error("Firestore error:", error);
      return "Your account was created, but something went wrong while saving your profile.";
  }
}


/* ---------------- Create email/password user profile ---------------- */

async function createUserProfile(user, name, dietPreference) {
  const db = getFirebaseDb();

  const userRef = doc(db, "users", user.uid);

  await setDoc(userRef, {
    uid: user.uid,
    name: name,
    email: user.email,
    dietPreference: dietPreference,
    role: "user",
    createdAt: serverTimestamp()
  });
}


/* ---------------- Create Google user profile if needed ---------------- */

async function ensureGoogleUserProfile(user) {
  const db = getFirebaseDb();

  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  /*
   * Existing profile:
   * Do not overwrite role, dietary preference, or createdAt.
   */
  if (snapshot.exists()) {
    return;
  }

  /*
   * First Google sign-in:
   * Create a normal user profile.
   */
  await setDoc(userRef, {
    uid: user.uid,
    name: user.displayName || "VeganSaathi User",
    email: user.email,
    dietPreference: "unspecified",
    role: "user",
    createdAt: serverTimestamp()
  });
}


/* ---------------- Set login persistence ---------------- */

async function setLoginPersistence(auth) {
  const rememberCheckbox = document.getElementById("rememberMe");

  const persistence = rememberCheckbox && rememberCheckbox.checked
    ? browserLocalPersistence
    : browserSessionPersistence;

  await setPersistence(auth, persistence);
}


/* ---------------- Login ---------------- */

function wireLoginForm() {
  const form = document.getElementById("loginForm");

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const emailElement = document.getElementById("loginEmail");
    const passwordElement = document.getElementById("loginPassword");
    const submitButton = form.querySelector('button[type="submit"]');

    const email = emailElement.value.trim();
    const password = passwordElement.value;

    if (!email || !password) {
      showFormNote(
        "loginFeedback",
        "Please enter both email and password.",
        true
      );
      return;
    }

    try {
      setButtonLoading(
        submitButton,
        true,
        "Logging in..."
      );

      const auth = getFirebaseAuth();

      await setLoginPersistence(auth);

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showFormNote(
        "loginFeedback",
        "Login successful. Redirecting...",
        false
      );

      setTimeout(function () {
        window.location.href = "index.html";
      }, 700);

    } catch (error) {
      showFormNote(
        "loginFeedback",
        getFriendlyAuthError(error),
        true
      );

      setButtonLoading(
        submitButton,
        false,
        "Login"
      );
    }
  });
}


/* ---------------- Register ---------------- */

function wireRegisterForm() {
  const form = document.getElementById("registerForm");

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirm = document.getElementById("registerConfirm").value;
    const diet = document.getElementById("registerDiet").value;

    const submitButton = form.querySelector('button[type="submit"]');

    if (!name || !email || !password || !confirm || !diet) {
      showFormNote(
        "registerFeedback",
        "Please fill in every field before creating an account.",
        true
      );
      return;
    }

    if (password.length < 6) {
      showFormNote(
        "registerFeedback",
        "Password should be at least 6 characters.",
        true
      );
      return;
    }

    if (password !== confirm) {
      showFormNote(
        "registerFeedback",
        "Passwords do not match.",
        true
      );
      return;
    }

    try {
      setButtonLoading(
        submitButton,
        true,
        "Creating Account..."
      );

      const auth = getFirebaseAuth();

      /*
       * Firebase Authentication creates the account first.
       */
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      /*
       * Then create the matching Firestore users/{uid} document.
       */
      try {
        await createUserProfile(
          credential.user,
          name,
          diet
        );
      } catch (firestoreError) {
        console.error(
          "Firestore profile creation failed:",
          firestoreError
        );

        showFormNote(
          "registerFeedback",
          getFriendlyFirestoreError(firestoreError),
          true
        );

        setButtonLoading(
          submitButton,
          false,
          "Create Account"
        );

        return;
      }

      showFormNote(
        "registerFeedback",
        "Account created successfully. Redirecting...",
        false
      );

      setTimeout(function () {
        window.location.href = "index.html";
      }, 700);

    } catch (error) {
      showFormNote(
        "registerFeedback",
        getFriendlyAuthError(error),
        true
      );

      setButtonLoading(
        submitButton,
        false,
        "Create Account"
      );
    }
  });
}


/* ---------------- Password reset ---------------- */

function wirePasswordReset() {
  const link =
    document.getElementById("forgotPasswordLink");

  if (!link) return;

  link.addEventListener("click", async function (e) {
    e.preventDefault();

    const emailElement =
      document.getElementById("loginEmail");

    const email = emailElement.value.trim();

    if (!email) {
      showFormNote(
        "loginFeedback",
        "Enter your email address first, then click Forgot password.",
        true
      );
      return;
    }

    try {
      const auth = getFirebaseAuth();

      await sendPasswordResetEmail(
        auth,
        email
      );

      showFormNote(
        "loginFeedback",
        "Password reset email sent. Please check your inbox.",
        false
      );

    } catch (error) {
      showFormNote(
        "loginFeedback",
        getFriendlyAuthError(error),
        true
      );
    }
  });
}


/* ---------------- Google sign-in ---------------- */

function wireGoogleSignIn() {
  const button =
    document.getElementById("googleSignInButton");

  if (!button) return;

  button.addEventListener("click", async function () {
    try {
      setButtonLoading(
        button,
        true,
        "Signing in..."
      );

      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(
        auth,
        provider
      );

      try {
        await ensureGoogleUserProfile(
          result.user
        );
      } catch (firestoreError) {
        console.error(
          "Google profile creation failed:",
          firestoreError
        );

        showFormNote(
          "loginFeedback",
          getFriendlyFirestoreError(firestoreError),
          true
        );

        setButtonLoading(
          button,
          false,
          "Sign in with Google"
        );

        return;
      }

      showFormNote(
        "loginFeedback",
        "Google sign-in successful. Redirecting...",
        false
      );

      setTimeout(function () {
        window.location.href = "index.html";
      }, 700);

    } catch (error) {
      console.error(
        "Google sign-in error:",
        error
      );

      showFormNote(
        "loginFeedback",
        getFriendlyAuthError(error),
        true
      );

      setButtonLoading(
        button,
        false,
        "Sign in with Google"
      );
    }
  });
}


/* ---------------- Logout helper ---------------- */

export async function logoutUser() {
  const auth = getFirebaseAuth();

  await signOut(auth);
}


/* ---------------- Initialize authentication forms ---------------- */

document.addEventListener("DOMContentLoaded", function () {
  wireLoginForm();
  wireRegisterForm();
  wirePasswordReset();
  wireGoogleSignIn();
});