/* ==========================================================================
   VeganSaathi — tests/check-duplicate-globals.js
   ============================================================================
   Guards against the exact bug found during the Phase 5 audit: two classic
   (non-module) <script src="..."> files loaded on the same page both
   declaring the same top-level `const`/`let` name. Classic scripts share one
   global scope per page, so the second declaration is a SyntaxError that
   breaks every script after it on that page — including the navbar. Module
   scripts (<script type="module">) are exempt: each module has its own
   scope, so the same name in two modules never collides.

   Pure Node.js (fs/path only) — no parser dependency, on purpose. This is a
   deliberately simple regex-based scan, not a full JS parser: it looks for
   `const NAME` / `let NAME` at the start of a line (column 0), which matches
   this codebase's actual style (every top-level declaration in this project
   is written that way; anything indented is inside a function and out of
   scope for this check by design).

   Run with: node tests/check-duplicate-globals.js
   Exits 0 if clean, 1 and prints every conflict if not.
   ========================================================================== */

const fs = require("fs");
const path = require("path");

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

function findHtmlFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (entry.name.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
}

// Pull every local (non-CDN) <script src="..."> from a page, split into
// classic vs module, in document order — good enough for this check since
// we only care about grouping, not exact execution order.
function classicLocalScriptsFor(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const scriptTagRe = /<script\b([^>]*)\ssrc="([^"]+)"[^>]*>/gi;
  const classic = [];
  let match;
  while ((match = scriptTagRe.exec(html)) !== null) {
    const attrs = match[1];
    const src = match[2];
    if (/^https?:\/\//i.test(src)) continue; // CDN script, not local
    const isModule = /\btype\s*=\s*"module"/i.test(attrs);
    if (isModule) continue;
    const resolved = path.normalize(path.join(path.dirname(htmlPath), src));
    classic.push(resolved);
  }
  return classic;
}

// Top-level (column 0) `const NAME` / `let NAME` declarations in a JS file.
const declCache = new Map();
function topLevelDeclarationsIn(jsPath) {
  if (declCache.has(jsPath)) return declCache.get(jsPath);
  if (!fs.existsSync(jsPath)) {
    declCache.set(jsPath, []);
    return [];
  }
  const content = fs.readFileSync(jsPath, "utf8");
  const names = [];
  const declRe = /^(?:const|let)\s+([A-Za-z_$][\w$]*)/gm;
  let match;
  while ((match = declRe.exec(content)) !== null) {
    names.push(match[1]);
  }
  declCache.set(jsPath, names);
  return names;
}

function main() {
  const htmlFiles = findHtmlFiles(FRONTEND_DIR);
  const conflicts = [];

  for (const htmlPath of htmlFiles) {
    const scripts = classicLocalScriptsFor(htmlPath);
    const ownerOf = new Map(); // name -> script path that first declared it

    for (const scriptPath of scripts) {
      for (const name of topLevelDeclarationsIn(scriptPath)) {
        if (ownerOf.has(name) && ownerOf.get(name) !== scriptPath) {
          conflicts.push({
            page: path.relative(FRONTEND_DIR, htmlPath),
            name: name,
            files: [path.relative(FRONTEND_DIR, ownerOf.get(name)), path.relative(FRONTEND_DIR, scriptPath)]
          });
        } else {
          ownerOf.set(name, scriptPath);
        }
      }
    }
  }

  if (conflicts.length === 0) {
    console.log("PASS - no duplicate top-level const/let declarations across classic scripts on any page (" + htmlFiles.length + " pages checked)");
    process.exit(0);
  }

  console.log("FAIL - duplicate top-level declarations found:");
  conflicts.forEach(function (c) {
    console.log("  " + c.page + ": `" + c.name + "` declared in both " + c.files[0] + " and " + c.files[1]);
  });
  process.exit(1);
}

main();
