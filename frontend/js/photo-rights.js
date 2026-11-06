export function validatePhotoApproval(photo) {
  if (!photo || photo.approval_status !== "pending") throw new Error("Photo is no longer pending review.");
  if (!(photo.is_original_work === true || photo.has_permission_to_publish === true)) {
    throw new Error("A confirmed original-work declaration or explicit publication permission is required.");
  }
  if (!(typeof photo.rights_holder === "string" && photo.rights_holder.trim()) &&
      !(typeof photo.photographer_name === "string" && photo.photographer_name.trim())) {
    throw new Error("Photographer or rights-holder attribution is required.");
  }
  if (photo.attribution_required === true && !(typeof photo.attribution_text === "string" && photo.attribution_text.trim())) {
    throw new Error("Required licence attribution is missing.");
  }
  if (typeof photo.place_id !== "string" || !photo.place_id.trim()) throw new Error("Photo must identify its associated place.");
  return true;
}
