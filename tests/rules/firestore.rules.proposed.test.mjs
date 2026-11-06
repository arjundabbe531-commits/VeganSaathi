/* ==========================================================================
   Firestore rules — PROPOSED changes (docs/proposals/firestore-rules-batch6.md).
   ==========================================================================
   EXPECTED TO FAIL against the current rules. A failure here means the gap is still
   open. Each test here becomes a passing test once its proposal is applied and the
   emulator run confirms it. Do not apply a proposal merely to make this file pass:
   apply it, run the full rules suite, and keep it only if every test holds.
   ========================================================================== */
import { describe, it, before, beforeEach, after } from "node:test";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { makeEnv, communityPlace, publishedPlace, seed, doc, setDoc, getDoc, updateDoc, serverTimestamp } from "./common.mjs";

let env;
before(async () => { env = await makeEnv("proposed"); });  // explicitly firebase/firestore.rules.proposed
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env.cleanup(); });
const as = (uid) => env.authenticatedContext(uid).firestore();

describe("PROPOSED R1 — bounded review comments and report descriptions", () => {
  // R1's check runs only once R2's exists()+published check has passed, so every
  // R1 case seeds a REAL published place first. Otherwise a "refused" result would
  // come from R2 (no such place), not from the length cap being tested.
  async function seedPublished(id) {
    await seed(env, async (db) => setDoc(doc(db, "places", id), { ...publishedPlace("u2"), createdAt: new Date(), updatedAt: new Date(), lastVerifiedAt: new Date() }));
  }

  it("boundary pair, same published place: 500-character comment accepted, 501 refused", async () => {
    await seedPublished("r1-boundary-place");
    await assertSucceeds(setDoc(doc(as("u1"), "reviews", "p-r1-500"), { placeId: "r1-boundary-place", userId: "u1", authorName: "C", rating: 4, comment: "x".repeat(500), createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("u1"), "reviews", "p-r1-501"), { placeId: "r1-boundary-place", userId: "u1", authorName: "C", rating: 4, comment: "x".repeat(501), createdAt: serverTimestamp() }));
  });
  it("a review with no comment is still accepted (comment is optional)", async () => {
    await seedPublished("r1-nocomment-place");
    await assertSucceeds(setDoc(doc(as("u1"), "reviews", "p-r1-nc"), { placeId: "r1-nocomment-place", userId: "u1", authorName: "C", rating: 4, createdAt: serverTimestamp() }));
  });
  it("refuses a non-string comment (number)", async () => {
    await seedPublished("r1-numcomment-place");
    await assertFails(setDoc(doc(as("u1"), "reviews", "p-r1-num"), { placeId: "r1-numcomment-place", userId: "u1", authorName: "C", rating: 4, comment: 12345, createdAt: serverTimestamp() }));
  });
  it("refuses a non-string comment (boolean)", async () => {
    await seedPublished("r1-boolcomment-place");
    await assertFails(setDoc(doc(as("u1"), "reviews", "p-r1-bool"), { placeId: "r1-boolcomment-place", userId: "u1", authorName: "C", rating: 4, comment: true, createdAt: serverTimestamp() }));
  });
  it("refuses a non-string comment (map)", async () => {
    await seedPublished("r1-mapcomment-place");
    await assertFails(setDoc(doc(as("u1"), "reviews", "p-r1-map"), { placeId: "r1-mapcomment-place", userId: "u1", authorName: "C", rating: 4, comment: { text: "x" }, createdAt: serverTimestamp() }));
  });
  it("boundary pair, report description: 500 accepted, 501 refused", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "reports", "p-r1b-500"), { placeId: "any-place-id", reporterId: "u1", reason: "other", status: "pending", description: "x".repeat(500), createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("u1"), "reports", "p-r1b-501"), { placeId: "any-place-id", reporterId: "u1", reason: "other", status: "pending", description: "x".repeat(501), createdAt: serverTimestamp() }));
  });
  it("refuses a non-string report description (number)", async () => {
    await assertFails(setDoc(doc(as("u1"), "reports", "p-r1b-num"), { placeId: "any-place-id", reporterId: "u1", reason: "other", status: "pending", description: 404, createdAt: serverTimestamp() }));
  });
  it("a report with no description is still accepted", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "reports", "p-r1b-nodesc"), { placeId: "any-place-id", reporterId: "u1", reason: "other", status: "pending", createdAt: serverTimestamp() }));
  });
});

describe("PROPOSED R2 — a review may only attach to a published place", () => {
  it("refuses a review on a PENDING place", async () => {
    await seed(env, async (db) => setDoc(doc(db, "places", "p-pend"), { ...communityPlace("u2"), createdAt: new Date(), updatedAt: new Date() }));
    await assertFails(setDoc(doc(as("u1"), "reviews", "p-r2"), { placeId: "p-pend", userId: "u1", authorName: "C", rating: 4, createdAt: serverTimestamp() }));
  });
  it("refuses a review on a place that does not exist", async () => {
    await assertFails(setDoc(doc(as("u1"), "reviews", "p-r2b"), { placeId: "no-such-place", userId: "u1", authorName: "C", rating: 4, createdAt: serverTimestamp() }));
  });
});

describe("PROPOSED R3 — users may write only known profile fields with a valid diet", () => {
  it("refuses an unknown field on the caller's own profile", async () => {
    await seed(env, async (db) => setDoc(doc(db, "users", "u1"), { uid: "u1", name: "A", email: "a@ssgmce.ac.in", dietPreference: "vegan", role: "user", createdAt: new Date() }));
    await assertFails(updateDoc(doc(as("u1"), "users", "u1"), { isVerifiedFieldworker: true }));
  });
  it("refuses an invalid dietPreference on update", async () => {
    await seed(env, async (db) => setDoc(doc(db, "users", "u1"), { uid: "u1", name: "A", email: "a@ssgmce.ac.in", dietPreference: "vegan", role: "user", createdAt: new Date() }));
    await assertFails(updateDoc(doc(as("u1"), "users", "u1"), { dietPreference: "carnivore" }));
  });
});

describe("PROPOSED Admin place creation payload validation & intelligence collections", () => {
  async function seedAdmin() {
    await seed(env, async (db) => {
      await setDoc(doc(db, "users", "admin1"), { uid: "admin1", name: "Admin", email: "admin@example.com", dietPreference: "unspecified", role: "admin", createdAt: new Date() });
    });
  }

  it("admin can create place with valid schema and verified timestamp", async () => {
    await seedAdmin();
    const validPlace = {
      name: "Valid Vegan Cafe",
      placeType: "cafe",
      address: "123 Green Way, Pune",
      latitude: 18.5204,
      longitude: 73.8567,
      dietTags: ["vegan"],
      priceRange: "moderate",
      status: "published",
      verificationStatus: "verified",
      lastVerifiedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(as("admin1"), "places", "admin-p1"), validPlace));
  });

  it("admin cannot create place marked verified without lastVerifiedAt timestamp", async () => {
    await seedAdmin();
    const invalidVerified = {
      name: "Unverified Timeless Cafe",
      placeType: "cafe",
      address: "123 Green Way, Pune",
      latitude: 18.5204,
      longitude: 73.8567,
      dietTags: ["vegan"],
      priceRange: "moderate",
      status: "published",
      verificationStatus: "verified",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(as("admin1"), "places", "admin-p2"), invalidVerified));
  });

  it("admin cannot create place with invalid coordinates or invalid placeType", async () => {
    await seedAdmin();
    const badCoords = {
      name: "Invalid Coordinates Cafe",
      placeType: "cafe",
      address: "123 Green Way, Pune",
      latitude: 999,
      longitude: 73.8567,
      dietTags: ["vegan"],
      priceRange: "moderate",
      status: "published",
      verificationStatus: "unverified",
      createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(as("admin1"), "places", "admin-p3"), badCoords));

    const badType = {
      name: "Bad Type Joint",
      placeType: "invalid_type",
      address: "123 Green Way, Pune",
      latitude: 18.5204,
      longitude: 73.8567,
      dietTags: ["vegan"],
      priceRange: "moderate",
      status: "published",
      verificationStatus: "unverified",
      createdAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(as("admin1"), "places", "admin-p4"), badType));
  });

  it("non-admin cannot read or write placeCandidates staging", async () => {
    await assertFails(setDoc(doc(as("u1"), "placeCandidates", "cand1"), { name: "Staged" }));
    await assertFails(getDoc(doc(as("u1"), "placeCandidates", "cand1")));
  });

  it("admin can read and write placeCandidates and verificationHistory", async () => {
    await seedAdmin();
    await assertSucceeds(setDoc(doc(as("admin1"), "placeCandidates", "cand1"), { name: "Staged", status: "pending" }));
    await assertSucceeds(setDoc(doc(as("admin1"), "verificationHistory", "vh1"), { candidateId: "cand1", decision: "approved" }));
  });
});
