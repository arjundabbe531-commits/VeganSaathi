/* TEST-ONLY Node stub for firebase-auth.js. places-service.js doesn't use
   Auth directly, but firebase-init.js's ensureInitialized() calls getAuth()
   unconditionally, so a minimal stub is needed even here. */
export function getAuth(app) {
  return { _stub: "auth", app: app };
}
