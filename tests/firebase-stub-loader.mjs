/* ==========================================================================
   VeganSaathi — tests/firebase-stub-loader.mjs
   ============================================================================
   A Node.js custom module-resolution hook (module.register(), stable since
   Node 20.6/18.19 — no npm package involved). It intercepts the exact
   `https://www.gstatic.com/firebasejs/...` specifiers this project's own
   source files import, and redirects them to the plain local stub modules
   in tests/node-firebase-stub/. Everything else resolves normally.

   This exists because Node's module loader refuses to fetch https: URLs on
   its own (ERR_UNSUPPORTED_ESM_URL_SCHEME) — without this hook,
   `import "../frontend/js/places-service.js"` could never load in a plain
   Node test at all, since that file (via firebase-init.js) imports from the
   Firebase CDN exactly as the browser does.

   TEST-ONLY. Never loaded by any page in the actual app — the real
   deployed site loads the real Firebase CDN files exactly as written.
   ========================================================================== */

import { pathToFileURL } from "node:url";
import path from "node:path";

const STUB_DIR = path.join(import.meta.dirname, "node-firebase-stub");

const CDN_PREFIX = "https://www.gstatic.com/firebasejs/";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(CDN_PREFIX)) {
    const fileName = specifier.slice(specifier.lastIndexOf("/") + 1);
    const stubPath = path.join(STUB_DIR, fileName);
    return {
      url: pathToFileURL(stubPath).href,
      shortCircuit: true
    };
  }
  return nextResolve(specifier, context);
}
