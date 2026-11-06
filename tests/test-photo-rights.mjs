import test from "node:test";
import assert from "node:assert/strict";
import { validatePhotoApproval } from "../frontend/js/photo-rights.js";

const valid = () => ({ approval_status: "pending", place_id: "place-1", is_original_work: true, photographer_name: "A. Photographer", attribution_required: false });
const publishedPlace = () => ({ status: "published" });

test("photo approval accepts a pending original with creator attribution", () => {
  assert.equal(validatePhotoApproval(valid(), publishedPlace()), true);
});

test("photo approval rejects missing rights, attribution, place, or pending state", () => {
  for (const change of [
    (photo) => { photo.is_original_work = false; photo.has_permission_to_publish = false; },
    (photo) => { photo.photographer_name = ""; },
    (photo) => { photo.attribution_required = true; },
    (photo) => { photo.place_id = ""; },
    (photo) => { photo.approval_status = "approved"; }
  ]) {
    const photo = valid(); change(photo);
    assert.throws(() => validatePhotoApproval(photo, publishedPlace()));
  }
  const permission = valid();
  permission.is_original_work = false;
  permission.has_permission_to_publish = true;
  permission.rights_holder = "Business owner";
  assert.equal(validatePhotoApproval(permission, publishedPlace()), true);
  assert.throws(() => validatePhotoApproval(valid(), { status: "pending" }), /published place/);
  assert.throws(() => validatePhotoApproval(valid(), null), /published place/);
});
