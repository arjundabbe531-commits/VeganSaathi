/* Shared setup for the Firestore rules tests. Runs only inside the emulator. */
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

// Explicit, named rule-file selection. There is deliberately NO default: every
// caller must name the file, so a suite cannot silently load the wrong rules.
// (An earlier harness hardcoded one path that both suites imported, so the
// "proposed" suite was actually exercising the ACTIVE rules.)
export const RULES_FILES = {
  current: new URL("../../firebase/firestore.rules", import.meta.url),
  proposed: new URL("../../firebase/firestore.rules.proposed", import.meta.url)
};

export async function makeEnv(which) {
  if (which !== "current" && which !== "proposed") {
    throw new Error(
      'makeEnv() requires an explicit rules file: makeEnv("current") or makeEnv("proposed"). ' +
      "There is no default on purpose."
    );
  }
  const rulesPath = RULES_FILES[which];
  const rulesText = readFileSync(rulesPath, "utf8");
  // Printed on every run: the console output is evidence of which file loaded.
  console.log(`[tests/rules] loaded "${which}" rules from ${rulesPath.pathname}`);
  return initializeTestEnvironment({
    projectId: `vegansaathi-rules-test-${which}`,
    firestore: { rules: rulesText }
  });
}

export { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp };

// A community submission the rules accept: pending, unverified, source community,
// inside the pilot box, with a valid price range.
export function communityPlace(submittedBy, overrides = {}) {
  return {
    name: "Test Mess",
    placeType: "mess",
    address: "Station Road, Shegaon",
    latitude: 20.79,
    longitude: 76.69,
    dietTags: ["vegan"],
    priceRange: "budget",
    status: "pending",
    verificationStatus: "unverified",
    source: "community",
    submittedBy: submittedBy,
    submittedByName: "Community member",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

// A published, verified place: the precondition R2 requires before a review.
export function publishedPlace(submittedBy, overrides = {}) {
  return communityPlace(submittedBy, {
    status: "published",
    verificationStatus: "verified",
    source: "fieldwork",
    lastVerifiedAt: serverTimestamp(),
    ...overrides
  });
}

// Writes data without rules, to set up a precondition only.
export async function seed(env, fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}
