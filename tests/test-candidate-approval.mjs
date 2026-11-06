import test from "node:test";
import assert from "node:assert/strict";
import { approveCandidateRecord, assertCandidateCanStage } from "../frontend/js/candidate-approval.js";

const baseCandidate = () => ({ candidate_id: "c-1", name: "Green Table", mapped_place_type: "cafe", address: "12 Market Road, Pune", latitude: 18.52, longitude: 73.85, dietTags: ["jain"], import_status: "staged" });
const evidence = (claim, overrides = {}) => ({
  claim, url: `https://evidence.example.test/${claim}`, sourceType: "official_business_source",
  sourceOwner: "Green Table", collectedAt: "2026-11-01", lastCheckedAt: "2026-11-05",
  excerpt: `Current evidence supporting ${claim}.`, reviewerUid: "admin-1", strength: "direct",
  validity: "current", rightsLimitations: "Public business information", reviewerNote: "Reviewed directly.",
  ...overrides
});
const baseDecision = () => ({ veganClass: "verified_vegan_options", existence: "business_identity_supported", operating: "open", evidenceStatus: "ingredients_reviewed", evidenceUrl: "https://business.example.test/menu", evidenceRefs: [evidence("business_identity"), evidence("current_operation"), evidence("address"), evidence("coordinates"), evidence("vegan_options")], notes: "Reviewed current ingredient list." });

function harness({ candidate = baseCandidate(), candidateId = "c-1", existingPlace = false, readError = null } = {}) {
  candidate.candidate_id = candidateId;
  const store = new Map([[`placeCandidates/${candidateId}`, structuredClone(candidate)]]);
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
  return { store, firestore, db: {}, candidateId, candidate, decision: baseDecision(), admin: { uid: "admin-1" } };
}

test("production approval publishes verified record and atomically records candidate/history", async () => {
  const h = harness();
  const result = await approveCandidateRecord(h);
  assert.equal(result.placeId, "place_c-1");
  assert.equal(h.store.get("places/place_c-1").verificationStatus, "verified");
  assert.deepEqual(h.store.get("places/place_c-1").dietTags, ["vegan"]);
  assert.equal(h.store.get("places/place_c-1").verificationDimensions.address_confirmed, true);
  assert.equal(h.store.get("places/place_c-1").verificationDimensions.coordinates_supported, true);
  const history = [...h.store.entries()].find(([key]) => key.startsWith("verificationHistory/"))[1];
  assert.deepEqual(history.evidenceRefs, h.decision.evidenceRefs);
  assert.equal(history.evidenceRefs.find((ref) => ref.claim === "vegan_options").excerpt, "Current evidence supporting vegan_options.");
  assert.equal(history.evidenceRefs[0].reviewerUid, "admin-1");
  assert.equal(h.store.get("places/place_c-1").evidenceRefs[0].reviewerUid, undefined);
  assert.equal(h.store.get("places/place_c-1").evidenceRefs[0].sourceOwner, undefined);
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

test("fixture provenance cannot be staged or published after editable markers are stripped", async (t) => {
  const fixture = { candidate_id: "cand_synthetic_fixture_fsq_001", name: "Edited Fixture" };
  assert.throws(() => assertCandidateCanStage(fixture), /cannot be staged/);
  const h = harness({ candidate: { ...baseCandidate(), is_synthetic_fixture: true }, candidateId: "cand_synthetic_fixture_fsq_001" });
  const edited = { ...h.candidate };
  delete edited.is_synthetic_fixture;
  delete h.store.get("placeCandidates/cand_synthetic_fixture_fsq_001").is_synthetic_fixture;
  await assert.rejects(approveCandidateRecord({ ...h, candidate: edited }), /cannot be published/);
  assert.equal(h.store.has("places/place_c-1"), false);
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

test("production approval requires claim-matched reviewed dietary evidence references", async (t) => {
  for (const [label, alter] of [
    ["missing refs", (h) => { h.decision.evidenceRefs = []; }],
    ["no vegan claim ref", (h) => { h.decision.evidenceRefs = h.decision.evidenceRefs.filter((ref) => ref.claim !== "vegan_options"); }],
    ["stale ref", (h) => { h.decision.evidenceRefs.find((ref) => ref.claim === "vegan_options").lastCheckedAt = "2025-01-01"; }],
    ["future ref", (h) => { h.decision.evidenceRefs.find((ref) => ref.claim === "vegan_options").lastCheckedAt = "2099-01-01"; }],
    ["impossible review date", (h) => { h.decision.evidenceRefs.find((ref) => ref.claim === "vegan_options").lastCheckedAt = "2026-02-30"; }],
    ["conflicting ref", (h) => { h.decision.evidenceRefs.find((ref) => ref.claim === "vegan_options").validity = "conflicting"; }],
    ["invalid ref URL", (h) => { h.decision.evidenceRefs.find((ref) => ref.claim === "vegan_options").url = "javascript:alert(1)"; }],
    ["mismatched reviewer", (h) => { h.decision.evidenceRefs.find((ref) => ref.claim === "vegan_options").reviewerUid = "someone-else"; }],
    ["wrong class-specific claim", (h) => { h.decision.veganClass = "fully_vegan"; }],
    ["visit checkbox without visit evidence", (h) => { h.decision.physicallyVisited = true; }]
  ]) await t.test(label, async () => {
    const h = harness(); alter(h);
    await assert.rejects(approveCandidateRecord(h));
    assert.equal(h.store.has("places/place_c-1"), false);
  });
});

test("racing production approvals publish exactly once", async () => {
  const h = harness();
  const attempts = await Promise.allSettled([approveCandidateRecord(h), approveCandidateRecord(h)]);
  assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
  assert.equal([...h.store.keys()].filter((key) => key.startsWith("verificationHistory/")).length, 1);
});
