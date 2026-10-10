/* TEST-ONLY stub Firebase Auth SDK — for offline sandbox verification only.
   Reactive: signOut() actually flips the simulated state and re-invokes
   every subscribed onAuthStateChanged callback with null, so the test
   harness can verify the navbar/guards update live (no page reload) —
   the same behavior the real Firebase SDK provides. */

let simulatedUser = (typeof window !== "undefined" && "__STUB_USER__" in window) ? window.__STUB_USER__ : null;
const listeners = [];

export function getAuth(app) {
  return { _stub: "auth", app: app };
}

export function onAuthStateChanged(auth, callback) {
  listeners.push(callback);
  setTimeout(function () { callback(simulatedUser); }, 0);
  return function unsubscribe() {
    const i = listeners.indexOf(callback);
    if (i !== -1) listeners.splice(i, 1);
  };
}

export async function signOut(auth) {
  if (typeof window !== "undefined") window.__STUB_SIGNOUT_CALLED__ = true;
  simulatedUser = null;
  listeners.forEach(function (cb) { cb(null); });
  return Promise.resolve();
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  return { user: { uid: "stub-uid-1", email: email } };
}

export async function signInWithEmailAndPassword(auth, email, password) {
  return { user: { uid: "stub-uid-1", email: email } };
}

export async function sendPasswordResetEmail(auth, email) {
  return Promise.resolve();
}

export async function signInWithPopup(auth, provider) {
  return { user: { uid: "stub-uid-google-1", email: "stub@example.com", displayName: "Stub Googler" } };
}

export function GoogleAuthProvider() {
  return { providerId: "google.com" };
}

export const browserLocalPersistence = "LOCAL";
export const browserSessionPersistence = "SESSION";

export async function setPersistence(auth, persistence) {
  return Promise.resolve();
}
