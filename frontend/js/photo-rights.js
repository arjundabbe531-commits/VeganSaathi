export function validatePhotoApproval(photo, place) {
  if (!photo || photo.approval_status !== "pending") throw new Error("Photo is no longer pending review.");
  if (!(photo.is_original_work === true || photo.has_permission_to_publish === true)) {
    throw new Error("A confirmed original-work declaration or explicit publication permission is required.");
  }
  if (typeof photo.creator_name !== "string" || !photo.creator_name.trim()) {
    throw new Error("The creator must be identified before publication.");
  }
  if (typeof photo.rights_holder !== "string" || !photo.rights_holder.trim()) {
    throw new Error("The rights holder must be identified before publication.");
  }
  const allowedBases = ["original_work", "written_permission", "open_license"];
  if (!allowedBases.includes(photo.permission_basis)) {
    throw new Error("A documented permission basis is required.");
  }
  if (photo.permission_basis === "original_work" && photo.is_original_work !== true) {
    throw new Error("The original-work basis conflicts with the uploader declaration.");
  }
  if (photo.permission_basis === "written_permission" && photo.has_permission_to_publish !== true) {
    throw new Error("Written permission must be explicitly recorded.");
  }
  if (typeof photo.permission_evidence_ref !== "string" ||
      !(photo.permission_evidence_ref.startsWith("https://") || /^evidence-record:[A-Za-z0-9_-]+$/.test(photo.permission_evidence_ref))) {
    throw new Error("Use an HTTPS source or evidence-record reference for permission proof.");
  }
  if (typeof photo.licence !== "string" || !photo.licence.trim()) {
    throw new Error("The applicable licence or rights basis must be recorded.");
  }
  if (typeof photo.attribution_required !== "boolean") {
    throw new Error("Attribution requirements must be reviewed explicitly.");
  }
  if (photo.attribution_required === true && !(typeof photo.attribution_text === "string" && photo.attribution_text.trim())) {
    throw new Error("Required licence attribution is missing.");
  }
  if (typeof photo.place_id !== "string" || !photo.place_id.trim()) throw new Error("Photo must identify its associated place.");
  if (!place || place.status !== "published") throw new Error("Photos can be approved only for an existing published place.");
  return true;
}

export function photoRightsEvidenceSnapshot(photo) {
  return {
    creator_name: String(photo?.creator_name || ""),
    rights_holder: String(photo?.rights_holder || ""),
    permission_basis: String(photo?.permission_basis || ""),
    permission_evidence_ref: String(photo?.permission_evidence_ref || ""),
    licence: String(photo?.licence || ""),
    attribution_required: photo?.attribution_required === true,
    attribution_text: String(photo?.attribution_text || ""),
  };
}
