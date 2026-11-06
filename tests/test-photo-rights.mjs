import test from "node:test";
import assert from "node:assert/strict";
import { photoRightsEvidenceSnapshot, validatePhotoApproval } from "../frontend/js/photo-rights.js";

const valid = () => ({
  approval_status: "pending", place_id: "place-1", is_original_work: true,
  creator_name: "A. Photographer", rights_holder: "A. Photographer",
  permission_basis: "original_work", permission_evidence_ref: "evidence-record:photo-rights-001",
  licence: "original-work", attribution_required: false, attribution_text: ""
});
const publishedPlace = () => ({ status: "published" });

test("photo approval accepts documented rights evidence for a published place", () => {
  assert.equal(validatePhotoApproval(valid(), publishedPlace()), true);
});

test("photo approval rejects missing or contradictory rights evidence", () => {
  for (const change of [
    (photo) => { photo.is_original_work = false; photo.has_permission_to_publish = false; },
    (photo) => { photo.creator_name = ""; },
    (photo) => { photo.rights_holder = ""; },
    (photo) => { photo.permission_basis = "uploader-says-so"; },
    (photo) => { photo.permission_basis = "written_permission"; photo.has_permission_to_publish = false; },
    (photo) => { photo.permission_evidence_ref = ""; },
    (photo) => { photo.permission_evidence_ref = "unreviewable-claim"; },
    (photo) => { photo.licence = ""; },
    (photo) => { photo.attribution_required = "no"; },
    (photo) => { photo.attribution_required = true; },
    (photo) => { photo.place_id = ""; },
    (photo) => { photo.approval_status = "approved"; }
  ]) {
    const photo = valid(); change(photo);
    assert.throws(() => validatePhotoApproval(photo, publishedPlace()));
  }
  assert.throws(() => validatePhotoApproval(valid(), { status: "pending" }), /published place/);
  assert.throws(() => validatePhotoApproval(valid(), null), /published place/);
});

test("rights review snapshot preserves creator, rights holder, basis, evidence, licence and attribution", () => {
  assert.deepEqual(photoRightsEvidenceSnapshot(valid()), {
    creator_name: "A. Photographer",
    rights_holder: "A. Photographer",
    permission_basis: "original_work",
    permission_evidence_ref: "evidence-record:photo-rights-001",
    licence: "original-work",
    attribution_required: false,
    attribution_text: ""
  });
});
