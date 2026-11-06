import test from "node:test";
import assert from "node:assert/strict";
import { approveCandidateRecord } from "../frontend/js/candidate-approval.js";

const baseCandidate = () => ({ candidate_id: "c-1", name: "Green Table", mapped_place_type: "cafe", address: "12 Market Road, Pune", latitude: 18.52, longitude: 73.85, dietTags: ["jain"], import_status: "staged" });
const baseDecision = () => ({ veganClass: "verified_vegan_options", existence: "business_identity_supported", operating: "open", evidenceStatus: "ingredients_reviewed", notes: "Reviewed current ingredient list." });

function harness({ candidate = baseCandidate(), existingPlace = false, readError = null } = {}) {
  const store = new Map([["placeCandidates/c-1", structuredClone(candidate)]]);
  if (existingPlace) store.set("places/place_c-1", {});
  let historySequence = 0;
  let transactionQueue = Promise.resolve();
  const firestore = {
    doc: (dbOrCollection, collectionName, id) => ({ path: id ? `${collectionName}/${id}` : `${dbOrCollection.path}/history-${++historySequence}` }),
    collection: (_db, name) => ({ path: name }),
    serverTimestamp: () => "server-time",
    runTransaction: async (_db, callback) => {
      let release;
      const previous = transactionQueue;
      transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      const writes = [];
      try {
        const result = await callback({
          get: async (ref) => {
            const error = typeof readError === "function" ? readError(ref) : readError;
            if (error) throw error;
            const value = store.get(ref.path);
            return { exists: () => value !== undefined, data: () => value };
          },
          set: (ref, value) => writes.push(() => store.set(ref.path, structuredClone(value))),
          update: (ref, value) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...value }))
        });
        writes.forEach((write) => write());
        return result;
      } finally {
        release();
      }
    }
  };
  return { store, firestore, db: {}, candidateId: "c-1", candidate, decision: baseDecision(), admin: { uid: "admin-1" } };
}

test("production approval publishes verified record and atomically records candidate/history", async () => {
  const h = harness();
  const result = await approveCandidateRecord(h);
  assert.equal(result.placeId, "place_c-1");
  assert.equal(h.store.get("places/place_c-1").verificationStatus, "verified");
  assert.deepEqual(h.store.get("places/place_c-1").dietTags, ["vegan", "vegetarian", "jain"]);
  assert.equal(h.store.get("placeCandidates/c-1").import_status, "approved");
  assert.equal([...h.store.keys()].filter((key) => key.startsWith("verificationHistory/")).length, 1);
});

test("production approval blocks unreviewed, unsupported, synthetic, closed, and invalid records", async (t) => {
  const cases = [
    ["discovery-only menu evidence", (h) => { h.decision.evidenceStatus = "menu_evidence_found"; }],
    ["unsupported class", (h) => { h.decision.veganClass = "vegan_status_unverified"; }],
    ["conflicting evidence", (h) => { h.decision.evidenceStatus = "conflicting_evidence"; }],
    ["unsupported existence", (h) => { h.decision.existence = "candidate"; }],
    ["unknown operating status", (h) => { h.decision.operating = "unknown"; }],
    ["permanently closed", (h) => { h.decision.operating = "permanently_closed"; }],
    ["synthetic fixture", (h) => { h.candidate.is_synthetic_fixture = true; }],
    ["invalid coordinates", (h) => { h.candidate.latitude = 0; h.candidate.longitude = 0; }],
    ["placeholder address", (h) => { h.candidate.address = "Address pending"; }],
    ["photo rights not cleared", (h) => { h.candidate.imageUrl = "https://example.test/photo.jpg"; }]
  ];
  for (const [label, alter] of cases) await t.test(label, async () => {
    const h = harness(); alter(h);
    await assert.rejects(approveCandidateRecord(h));
    assert.equal(h.store.get("placeCandidates/c-1").import_status, "staged");
    assert.equal(h.store.has("places/place_c-1"), false);
  });
});

test("transaction fails closed for candidate read errors, missing candidate, stale candidate, and duplicate place", async (t) => {
  const readFailure = harness({ readError: new Error("permission/network failure") });
  await assert.rejects(approveCandidateRecord(readFailure), /permission\/network failure/);
  const missing = harness(); missing.store.delete("placeCandidates/c-1");
  await assert.rejects(approveCandidateRecord(missing), /no longer exists/);
  const stale = harness(); stale.store.get("placeCandidates/c-1").import_status = "rejected";
  await assert.rejects(approveCandidateRecord(stale), /no longer staged/);
  const duplicate = harness({ existingPlace: true });
  await assert.rejects(approveCandidateRecord(duplicate), /already exists/);
  const targetReadFailure = harness({ readError: (ref) => ref.path === "places/place_c-1" ? new Error("target read denied") : null });
  await assert.rejects(approveCandidateRecord(targetReadFailure), /target read denied/);
});

test("racing production approvals publish exactly once", async () => {
  const h = harness();
  const attempts = await Promise.allSettled([approveCandidateRecord(h), approveCandidateRecord(h)]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  assert.equal([...h.store.keys()].filter((key) => key.startsWith("verificationHistory/")).length, 1);
});
