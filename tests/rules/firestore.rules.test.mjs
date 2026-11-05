/* ==========================================================================
   Firestore rules — CURRENT behaviour of firebase/firestore.rules.
   ==========================================================================
   Runs against the Firestore EMULATOR only. Never touches the live project.
   Every "fails" assertion is a rule that must refuse a write or read; every
   "succeeds" assertion is a rule that must allow an intended action.

   Enforcement note: these assertions test the RULES. The admin checks in the app
   are conveniences; the rules are what refuse an unauthorised request.
   ========================================================================== */
import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { makeEnv, communityPlace, seed, doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "./common.mjs";

let env;
before(async () => { env = await makeEnv("current"); });  // explicitly firebase/firestore.rules
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env.cleanup(); });

const guest = () => env.unauthenticatedContext().firestore();
const as = (uid) => env.authenticatedContext(uid).firestore();

// Common preconditions, created without rules, then attacked.
async function seedUsers() {
  await seed(env, async (db) => {
    await setDoc(doc(db, "users", "u1"), { uid: "u1", name: "Student One", email: "s1@ssgmce.ac.in", dietPreference: "vegan", role: "user", createdAt: new Date() });
    await setDoc(doc(db, "users", "u2"), { uid: "u2", name: "Student Two", email: "s2@ssgmce.ac.in", dietPreference: "jain", role: "user", createdAt: new Date() });
    await setDoc(doc(db, "users", "admin1"), { uid: "admin1", name: "Admin", email: "admin@ssgmce.ac.in", dietPreference: "unspecified", role: "admin", createdAt: new Date() });
  });
}
async function seedPlace(id, data) {
  await seed(env, async (db) => setDoc(doc(db, "places", id), { ...communityPlace("u1"), ...data, createdAt: new Date(), updatedAt: new Date() }));
}
const publishedPlace = { status: "published", verificationStatus: "verified", source: "fieldwork", lastVerifiedAt: new Date() };

describe("Visitor (not signed in)", () => {
  it("can read a PUBLISHED place", async () => {
    await seedPlace("pub1", publishedPlace);
    await assertSucceeds(getDoc(doc(guest(), "places", "pub1")));
  });
  it("cannot read a PENDING place", async () => {
    await seedPlace("pend1", {});
    await assertFails(getDoc(doc(guest(), "places", "pend1")));
  });
  it("cannot read any user profile", async () => {
    await seedUsers();
    await assertFails(getDoc(doc(guest(), "users", "u1")));
  });
  it("cannot read reports", async () => {
    await seed(env, async (db) => setDoc(doc(db, "reports", "rep1"), { placeId: "p", reporterId: "u1", reason: "outdated", status: "pending", createdAt: new Date() }));
    await assertFails(getDoc(doc(guest(), "reports", "rep1")));
  });
  it("cannot create a place", async () => {
    await assertFails(setDoc(doc(guest(), "places", "g1"), communityPlace("u1")));
  });
  it("cannot create a review", async () => {
    await assertFails(setDoc(doc(guest(), "reviews", "g1"), { placeId: "pub1", userId: "u1", authorName: "X", rating: 4, createdAt: serverTimestamp() }));
  });
});

describe("Ordinary signed-in user (u1)", () => {
  it("can create their own profile with role user", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "users", "u1"), { uid: "u1", name: "A", email: "a@ssgmce.ac.in", dietPreference: "vegan", role: "user", createdAt: serverTimestamp() }));
  });
  it("cannot create their own profile with role admin", async () => {
    await assertFails(setDoc(doc(as("u1"), "users", "u1"), { uid: "u1", name: "A", email: "a@ssgmce.ac.in", dietPreference: "vegan", role: "admin", createdAt: serverTimestamp() }));
  });
  it("cannot change their own role to admin", async () => {
    await seedUsers();
    await assertFails(updateDoc(doc(as("u1"), "users", "u1"), { role: "admin" }));
  });
  it("can update their own name", async () => {
    await seedUsers();
    await assertSucceeds(updateDoc(doc(as("u1"), "users", "u1"), { name: "Renamed" }));
  });
  it("cannot read another user's profile", async () => {
    await seedUsers();
    await assertFails(getDoc(doc(as("u1"), "users", "u2")));
  });
  it("cannot update another user's profile", async () => {
    await seedUsers();
    await assertFails(updateDoc(doc(as("u1"), "users", "u2"), { name: "Hijacked" }));
  });

  it("can submit a valid pending community place under their own uid", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "places", "sub1"), communityPlace("u1")));
  });
  it("cannot submit a place as someone else", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub2"), communityPlace("u2")));
  });
  it("cannot submit a place that is already published", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub3"), communityPlace("u1", { status: "published" })));
  });
  it("cannot submit a place already marked verified", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub4"), communityPlace("u1", { verificationStatus: "verified" })));
  });
  it("cannot submit a place claiming fieldwork source", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub5"), communityPlace("u1", { source: "fieldwork" })));
  });
  it("cannot submit a place with coordinates outside valid global range", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub6"), communityPlace("u1", { latitude: 200, longitude: 72.87 })));
  });
  it("cannot submit a place with an unknown place type", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub7"), communityPlace("u1", { placeType: "nightclub" })));
  });
  it("cannot submit a place with an unknown diet tag", async () => {
    await assertFails(setDoc(doc(as("u1"), "places", "sub8"), communityPlace("u1", { dietTags: ["carnivore"] })));
  });

  it("cannot approve their own pending place (set it published)", async () => {
    await seedPlace("own-pend", {});
    await assertFails(updateDoc(doc(as("u1"), "places", "own-pend"), { status: "published" }));
  });
  it("cannot edit a published place they did not create", async () => {
    await seedPlace("pub-by-admin", { ...publishedPlace, submittedBy: "admin1" });
    await assertFails(updateDoc(doc(as("u1"), "places", "pub-by-admin"), { name: "Vandalised" }));
  });
  it("cannot edit their own place once it is published", async () => {
    await seedPlace("own-pub", publishedPlace);
    await assertFails(updateDoc(doc(as("u1"), "places", "own-pub"), { name: "Changed after publication" }));
  });
  it("cannot delete a place", async () => {
    await seedPlace("del1", {});
    await assertFails(deleteDoc(doc(as("u1"), "places", "del1")));
  });

  it("can review a published place under their own identity", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "reviews", "r1"), { placeId: "pub1", userId: "u1", authorName: "Community member", rating: 4, comment: "Good thali", createdAt: serverTimestamp() }));
  });
  it("cannot give a rating of 0, 6, or a non-integer", async () => {
    for (const [id, rating] of [["r2", 0], ["r3", 6], ["r4", 4.5]]) {
      await assertFails(setDoc(doc(as("u1"), "reviews", id), { placeId: "pub1", userId: "u1", authorName: "C", rating, createdAt: serverTimestamp() }));
    }
  });
  it("cannot review under another user's id", async () => {
    await assertFails(setDoc(doc(as("u1"), "reviews", "r5"), { placeId: "pub1", userId: "u2", authorName: "C", rating: 4, createdAt: serverTimestamp() }));
  });
  it("cannot edit a review, even their own", async () => {
    await seed(env, async (db) => setDoc(doc(db, "reviews", "r6"), { placeId: "pub1", userId: "u1", authorName: "C", rating: 4, createdAt: new Date() }));
    await assertFails(updateDoc(doc(as("u1"), "reviews", "r6"), { rating: 1 }));
  });
  it("cannot delete another user's review", async () => {
    await seed(env, async (db) => setDoc(doc(db, "reviews", "r7"), { placeId: "pub1", userId: "u2", authorName: "C", rating: 4, createdAt: new Date() }));
    await assertFails(deleteDoc(doc(as("u1"), "reviews", "r7")));
  });
  it("can delete their own review", async () => {
    await seed(env, async (db) => setDoc(doc(db, "reviews", "r8"), { placeId: "pub1", userId: "u1", authorName: "C", rating: 4, createdAt: new Date() }));
    await assertSucceeds(deleteDoc(doc(as("u1"), "reviews", "r8")));
  });

  it("can file a report under their own reporter id", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "reports", "rep-ok"), { placeId: "pub1", reporterId: "u1", reason: "outdated", status: "pending", createdAt: serverTimestamp() }));
  });
  it("cannot file a report under another reporter's id", async () => {
    await assertFails(setDoc(doc(as("u1"), "reports", "rep-x"), { placeId: "pub1", reporterId: "u2", reason: "outdated", status: "pending", createdAt: serverTimestamp() }));
  });
  it("cannot file a report with an unknown reason, or a status other than pending", async () => {
    await assertFails(setDoc(doc(as("u1"), "reports", "rep-y"), { placeId: "pub1", reporterId: "u1", reason: "rude", status: "pending", createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as("u1"), "reports", "rep-z"), { placeId: "pub1", reporterId: "u1", reason: "outdated", status: "resolved", createdAt: serverTimestamp() }));
  });
  it("cannot read another reporter's report", async () => {
    await seed(env, async (db) => setDoc(doc(db, "reports", "rep-u2"), { placeId: "p", reporterId: "u2", reason: "outdated", status: "pending", createdAt: new Date() }));
    await assertFails(getDoc(doc(as("u1"), "reports", "rep-u2")));
  });
  it("cannot resolve or edit a report, even their own", async () => {
    await seed(env, async (db) => setDoc(doc(db, "reports", "rep-own"), { placeId: "p", reporterId: "u1", reason: "outdated", status: "pending", createdAt: new Date() }));
    await assertFails(updateDoc(doc(as("u1"), "reports", "rep-own"), { status: "resolved" }));
  });

  it("can save a published place under their own key", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "savedPlaces", "u1_pub1"), { userId: "u1", placeId: "pub1", createdAt: serverTimestamp() }));
  });
  it("cannot save under another user's key", async () => {
    await assertFails(setDoc(doc(as("u1"), "savedPlaces", "u2_pub1"), { userId: "u2", placeId: "pub1", createdAt: serverTimestamp() }));
  });
  it("cannot save with a document id that does not match the caller and place", async () => {
    await assertFails(setDoc(doc(as("u1"), "savedPlaces", "wrong-id"), { userId: "u1", placeId: "pub1", createdAt: serverTimestamp() }));
  });
  it("cannot read another user's saved place", async () => {
    await seed(env, async (db) => setDoc(doc(db, "savedPlaces", "u2_pub1"), { userId: "u2", placeId: "pub1", createdAt: new Date() }));
    await assertFails(getDoc(doc(as("u1"), "savedPlaces", "u2_pub1")));
  });
  it("cannot update a saved place", async () => {
    await seed(env, async (db) => setDoc(doc(db, "savedPlaces", "u1_pub2"), { userId: "u1", placeId: "pub2", createdAt: new Date() }));
    await assertFails(updateDoc(doc(as("u1"), "savedPlaces", "u1_pub2"), { placeId: "other" }));
  });
  it("can delete their own saved place but not another user's", async () => {
    await seed(env, async (db) => {
      await setDoc(doc(db, "savedPlaces", "u1_pub3"), { userId: "u1", placeId: "pub3", createdAt: new Date() });
      await setDoc(doc(db, "savedPlaces", "u2_pub3"), { userId: "u2", placeId: "pub3", createdAt: new Date() });
    });
    await assertSucceeds(deleteDoc(doc(as("u1"), "savedPlaces", "u1_pub3")));
    await assertFails(deleteDoc(doc(as("u1"), "savedPlaces", "u2_pub3")));
  });
});

describe("Administrator (role admin in users/{uid})", () => {
  it("can read a pending place", async () => {
    await seedUsers();
    await seedPlace("adm-read", {});
    await assertSucceeds(getDoc(doc(as("admin1"), "places", "adm-read")));
  });
  it("can approve a pending place (set it published)", async () => {
    await seedUsers();
    await seedPlace("adm-approve", {});
    await assertSucceeds(updateDoc(doc(as("admin1"), "places", "adm-approve"), { status: "published", verificationStatus: "unverified" }));
  });
  it("can resolve a report", async () => {
    await seedUsers();
    await seed(env, async (db) => setDoc(doc(db, "reports", "adm-rep"), { placeId: "p", reporterId: "u1", reason: "outdated", status: "pending", createdAt: new Date() }));
    await assertSucceeds(updateDoc(doc(as("admin1"), "reports", "adm-rep"), { status: "resolved" }));
  });
  it("can delete any review", async () => {
    await seedUsers();
    await seed(env, async (db) => setDoc(doc(db, "reviews", "adm-rev"), { placeId: "p", userId: "u2", authorName: "C", rating: 2, createdAt: new Date() }));
    await assertSucceeds(deleteDoc(doc(as("admin1"), "reviews", "adm-rev")));
  });
  it("a user with role user, even with an admin-looking name, cannot resolve a report", async () => {
    await seedUsers();
    await seed(env, async (db) => setDoc(doc(db, "reports", "fake-adm"), { placeId: "p", reporterId: "u2", reason: "outdated", status: "pending", createdAt: new Date() }));
    await assertFails(updateDoc(doc(as("u1"), "reports", "fake-adm"), { status: "resolved" }));
  });
});

describe("GAP (current behaviour, documented) — rules do not yet enforce these", () => {
  // These assert what the rules CURRENTLY allow. They pass today. When the proposal
  // in docs/proposals/firestore-rules-batch6.md is applied, each of these must be
  // inverted to assertFails and moved to firestore.rules.proposed.test.mjs.
  it("GAP R1: accepts a 501-character review comment", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "reviews", "gap-r1"), { placeId: "pub1", userId: "u1", authorName: "C", rating: 4, comment: "x".repeat(501), createdAt: serverTimestamp() }));
  });
  it("GAP R1: accepts a 501-character report description", async () => {
    await assertSucceeds(setDoc(doc(as("u1"), "reports", "gap-r1b"), { placeId: "pub1", reporterId: "u1", reason: "other", status: "pending", description: "x".repeat(501), createdAt: serverTimestamp() }));
  });
  it("GAP R2: accepts a review on a place that is still pending", async () => {
    await seedPlace("gap-pending", {});
    await assertSucceeds(setDoc(doc(as("u1"), "reviews", "gap-r2"), { placeId: "gap-pending", userId: "u1", authorName: "C", rating: 4, createdAt: serverTimestamp() }));
  });
  it("GAP R3: accepts an unknown field written to a user's own profile", async () => {
    await seedUsers();
    await assertSucceeds(updateDoc(doc(as("u1"), "users", "u1"), { isVerifiedFieldworker: true }));
  });
});
