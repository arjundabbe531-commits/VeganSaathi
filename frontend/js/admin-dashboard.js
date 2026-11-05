/* ==========================================================================
   VeganSaathi — admin-dashboard.js
   ============================================================================
   Phase 7 — Admin Dashboard UI Controller.
   Handles administrator authentication gating, live data rendering,
   moderation queues (pending, published, verification, reports, reviews, users),
   interactive modals, and error/empty states.
   ========================================================================== */

import { onAuthChange, getCurrentUser } from "./auth-state.js";
import {
  checkIsAdmin,
  fetchAdminOverviewStats,
  fetchPendingSubmissions,
  approvePlace,
  rejectPlace,
  fetchPublishedPlacesForAdmin,
  updatePlaceByAdmin,
  reverifyPlace,
  fetchAdminReports,
  resolveReport,
  dismissReport,
  fetchAdminReviews,
  deleteReviewByAdmin,
  fetchAdminUsersList
} from "./admin-service.js";

// Global cache of places currently loaded in the dashboard for edit modal lookup
let currentPlacesCache = {};
let activeAdminUser = null;
let editModalInstance = null;

function showSection(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("d-none");
}

function hideSection(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("d-none");
}

function showAdminAlert(message, isError) {
  const alertEl = document.getElementById("adminAlert");
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = "alert " + (isError ? "alert-danger" : "alert-success") + " alert-dismissible fade show";
  alertEl.classList.remove("d-none");
  setTimeout(function () {
    alertEl.classList.add("d-none");
  }, 6000);
}

function formatDate(date) {
  if (!date) return "—";
  if (typeof date.toLocaleDateString === "function") {
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return String(date);
}

function isOlderThan90Days(date) {
  if (!date) return true;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return true;
  const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 90;
}

/* ---------------- Gating and Initialization ---------------- */

async function handleAuthState(user) {
  if (user === undefined) {
    // Waiting for Firebase Auth
    showSection("adminLoadingScreen");
    hideSection("adminUnauthorizedScreen");
    hideSection("adminMainContent");
    return;
  }

  if (user === null) {
    // Signed out
    hideSection("adminLoadingScreen");
    hideSection("adminMainContent");
    showSection("adminUnauthorizedScreen");
    const unauthReason = document.getElementById("unauthorizedReason");
    if (unauthReason) {
      unauthReason.textContent = "Please sign in with an authorized administrator account to access this moderation dashboard.";
    }
    return;
  }

  // Signed in — check admin role claim on users/{uid}
  showSection("adminLoadingScreen");
  hideSection("adminUnauthorizedScreen");
  hideSection("adminMainContent");

  try {
    const isAdmin = await checkIsAdmin(user);
    if (!isAdmin) {
      hideSection("adminLoadingScreen");
      hideSection("adminMainContent");
      showSection("adminUnauthorizedScreen");
      const unauthReason = document.getElementById("unauthorizedReason");
      if (unauthReason) {
        unauthReason.textContent = "Access Denied: Your account (" + (user.email || user.uid) + ") does not have administrator privileges.";
      }
      return;
    }

    // Authorized Admin!
    activeAdminUser = user;
    hideSection("adminLoadingScreen");
    hideSection("adminUnauthorizedScreen");
    showSection("adminMainContent");

    const adminIdentity = document.getElementById("adminUserIdentity");
    if (adminIdentity) {
      adminIdentity.textContent = "Signed in as: " + (user.displayName || user.email || "Admin");
    }

    await loadOverviewStats();
    await loadPendingTab();
    setupTabListeners();
    setupEditModal();
  } catch (err) {
    console.error("VeganSaathi admin gating error", err);
    hideSection("adminLoadingScreen");
    hideSection("adminMainContent");
    showSection("adminUnauthorizedScreen");
    const unauthReason = document.getElementById("unauthorizedReason");
    if (unauthReason) {
      unauthReason.textContent = "An error occurred verifying your administrator privileges. Please check your network and try again.";
    }
  }
}

/* ---------------- Overview Stats ---------------- */

async function loadOverviewStats() {
  const res = await fetchAdminOverviewStats();
  if (res.status === "ok" && res.stats) {
    document.getElementById("statPending").textContent = res.stats.pendingPlaces;
    document.getElementById("statPublished").textContent = res.stats.publishedPlaces;
    document.getElementById("statReports").textContent = res.stats.openReports;
    document.getElementById("statReviews").textContent = res.stats.totalReviews;
    document.getElementById("statUsers").textContent = res.stats.totalUsers;
  } else {
    document.getElementById("statPending").textContent = "—";
    document.getElementById("statPublished").textContent = "—";
    document.getElementById("statReports").textContent = "—";
    document.getElementById("statReviews").textContent = "—";
    document.getElementById("statUsers").textContent = "—";
  }
}

/* ---------------- Pending Submissions Tab ---------------- */

async function loadPendingTab() {
  const tbody = document.getElementById("pendingTableBody");
  const loading = document.getElementById("pendingLoading");
  const empty = document.getElementById("pendingEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (loading) loading.classList.remove("d-none");
  if (empty) empty.classList.add("d-none");

  const res = await fetchPendingSubmissions();
  if (loading) loading.classList.add("d-none");

  if (res.status !== "ok" || !res.places || res.places.length === 0) {
    if (empty) empty.classList.remove("d-none");
    return;
  }

  // Populate cache
  res.places.forEach(function (p) { currentPlacesCache[p.id] = p; });

  tbody.innerHTML = res.places.map(function (p) {
    const mapUrl = "https://www.google.com/maps/search/?api=1&query=" + p.latitude + "," + p.longitude;
    const notesHtml = p.notesForReview
      ? '<br><small class="text-muted-vs"><strong>Note:</strong> ' + escapeHtml(p.notesForReview) + '</small>'
      : '';

    return (
      '<tr id="pending-row-' + escapeHtml(p.id) + '">' +
      '<td><strong>' + escapeHtml(p.name) + '</strong><br>' +
      '<span class="badge bg-secondary me-1">' + escapeHtml(capitalize(p.placeType)) + '</span>' +
      renderDietBadges(p.dietTags) +
      '<br><small class="text-muted-vs">' + escapeHtml(p.address) + (p.area ? ' (' + escapeHtml(p.area) + ')' : '') + '</small>' +
      (p.imageUrl && /^https:\/\/res\.cloudinary\.com\//i.test(p.imageUrl.trim()) ? '<br><a href="' + escapeHtml(p.imageUrl) + '" target="_blank" rel="noopener noreferrer" class="badge bg-light text-dark border mt-1">📷 View Photo ↗</a>' : '') +
      notesHtml +
      '</td>' +
      '<td>' +
      '<small>' + p.latitude.toFixed(4) + ', ' + p.longitude.toFixed(4) + '</small><br>' +
      '<a href="' + escapeHtml(mapUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm py-0" style="font-size:0.75rem;">View Map ↗</a>' +
      '</td>' +
      '<td><small>' + escapeHtml(p.submittedByName) + '</small><br><span class="text-muted-vs" style="font-size:0.75rem;">' + escapeHtml(formatDate(p.createdAt)) + '</span></td>' +
      '<td>' +
      '<div class="btn-group btn-group-sm">' +
      '<button type="button" class="btn btn-vs-primary btn-approve-place" data-place-id="' + escapeHtml(p.id) + '" data-place-name="' + escapeHtml(p.name) + '">Approve</button>' +
      '<button type="button" class="btn btn-outline-danger btn-reject-place" data-place-id="' + escapeHtml(p.id) + '" data-place-name="' + escapeHtml(p.name) + '">Reject</button>' +
      '<button type="button" class="btn btn-outline-secondary btn-edit-place" data-place-id="' + escapeHtml(p.id) + '">Edit</button>' +
      '</div>' +
      '</td>' +
      '</tr>'
    );
  }).join("");

  wirePendingButtons();
}

function wirePendingButtons() {
  document.querySelectorAll(".btn-approve-place").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const placeId = btn.getAttribute("data-place-id");
      const placeName = btn.getAttribute("data-place-name");
      if (!confirm("Approve and publish \"" + placeName + "\"?\n\nIt will be visible publicly on Explore in unverified state until fieldwork confirmation.")) {
        return;
      }

      btn.disabled = true;
      btn.textContent = "Approving…";
      const res = await approvePlace(placeId, activeAdminUser);
      if (res.status === "ok") {
        showAdminAlert("Listing \"" + placeName + "\" approved and published.", false);
        await loadOverviewStats();
        await loadPendingTab();
      } else {
        showAdminAlert("Failed to approve place: " + (res.message || "server error"), true);
        btn.disabled = false;
        btn.textContent = "Approve";
      }
    });
  });

  document.querySelectorAll(".btn-reject-place").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const placeId = btn.getAttribute("data-place-id");
      const placeName = btn.getAttribute("data-place-name");
      const reason = prompt("Enter rejection reason for \"" + placeName + "\" (optional):", "Inappropriate or incomplete details");
      if (reason === null) return; // user cancelled

      btn.disabled = true;
      btn.textContent = "Rejecting…";
      const res = await rejectPlace(placeId, activeAdminUser, reason);
      if (res.status === "ok") {
        showAdminAlert("Listing \"" + placeName + "\" marked as rejected.", false);
        await loadOverviewStats();
        await loadPendingTab();
      } else {
        showAdminAlert("Failed to reject place: " + (res.message || "server error"), true);
        btn.disabled = false;
        btn.textContent = "Reject";
      }
    });
  });

  document.querySelectorAll(".btn-edit-place").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const placeId = btn.getAttribute("data-place-id");
      openEditModal(placeId);
    });
  });
}

/* ---------------- Published Places Tab ---------------- */

async function loadPublishedTab() {
  const tbody = document.getElementById("publishedTableBody");
  const loading = document.getElementById("publishedLoading");
  const empty = document.getElementById("publishedEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (loading) loading.classList.remove("d-none");
  if (empty) empty.classList.add("d-none");

  const res = await fetchPublishedPlacesForAdmin();
  if (loading) loading.classList.add("d-none");

  if (res.status !== "ok" || !res.places || res.places.length === 0) {
    if (empty) empty.classList.remove("d-none");
    return;
  }

  res.places.forEach(function (p) { currentPlacesCache[p.id] = p; });

  tbody.innerHTML = res.places.map(function (p) {
    return (
      '<tr>' +
      '<td><strong>' + escapeHtml(p.name) + '</strong><br>' +
      '<span class="badge bg-secondary me-1">' + escapeHtml(capitalize(p.placeType)) + '</span>' +
      renderDietBadges(p.dietTags) + '<br>' +
      '<small class="text-muted-vs">' + escapeHtml(p.address) + (p.area ? ' &middot; ' + escapeHtml(p.area) : '') + '</small>' +
      (p.imageUrl && /^https:\/\//i.test(p.imageUrl.trim()) ? '<br><a href="' + escapeHtml(p.imageUrl) + '" target="_blank" rel="noopener noreferrer" class="badge bg-light text-dark border mt-1">📷 Photo ↗</a>' : '') +
      '</td>' +
      '<td>' + renderVerificationBadge(p) + '</td>' +
      '<td>' + escapeHtml(capitalize(p.priceRange)) + '</td>' +
      '<td>' +
      '<div class="btn-group btn-group-sm">' +
      '<button type="button" class="btn btn-outline-secondary btn-edit-published" data-place-id="' + escapeHtml(p.id) + '">Edit</button>' +
      '<button type="button" class="btn btn-outline-danger btn-unpublish-place" data-place-id="' + escapeHtml(p.id) + '" data-place-name="' + escapeHtml(p.name) + '">Unpublish</button>' +
      '</div>' +
      '</td>' +
      '</tr>'
    );
  }).join("");

  tbody.querySelectorAll(".btn-edit-published").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openEditModal(btn.getAttribute("data-place-id"));
    });
  });

  tbody.querySelectorAll(".btn-unpublish-place").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const placeId = btn.getAttribute("data-place-id");
      const placeName = btn.getAttribute("data-place-name");
      if (!confirm("Unpublish \"" + placeName + "\"? It will be hidden from the public Explore page.")) return;

      btn.disabled = true;
      const res = await rejectPlace(placeId, activeAdminUser, "Unpublished by admin moderation");
      if (res.status === "ok") {
        showAdminAlert("\"" + placeName + "\" unpublished.", false);
        await loadOverviewStats();
        await loadPublishedTab();
      } else {
        showAdminAlert("Failed to unpublish: " + res.message, true);
        btn.disabled = false;
      }
    });
  });
}

/* ---------------- Re-Verification Tab ---------------- */

async function loadVerificationTab() {
  const tbody = document.getElementById("verificationTableBody");
  const loading = document.getElementById("verificationLoading");
  const empty = document.getElementById("verificationEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (loading) loading.classList.remove("d-none");
  if (empty) empty.classList.add("d-none");

  const res = await fetchPublishedPlacesForAdmin();
  if (loading) loading.classList.add("d-none");

  if (res.status !== "ok" || !res.places || res.places.length === 0) {
    if (empty) empty.classList.remove("d-none");
    return;
  }

  tbody.innerHTML = res.places.map(function (p) {
    const isVerified = p.verificationStatus === "verified";
    const needsCheck = !isVerified || isOlderThan90Days(p.lastVerifiedAt);
    const freshnessBadge = needsCheck
      ? '<span class="badge bg-warning text-dark">Re-Check Due (>90d)</span>'
      : '<span class="badge bg-success">Verified (Fresh)</span>';

    const lastDate = p.lastVerifiedAt ? formatDate(p.lastVerifiedAt) : "Never verified";
    const noteText = p.verificationNote ? '<br><small class="text-muted-vs">' + escapeHtml(p.verificationNote) + '</small>' : '';

    return (
      '<tr>' +
      '<td><strong>' + escapeHtml(p.name) + '</strong><br><small class="text-muted-vs">' + escapeHtml(p.address) + '</small></td>' +
      '<td>' + freshnessBadge + '</td>' +
      '<td>' + escapeHtml(lastDate) + noteText + '</td>' +
      '<td>' +
      '<button type="button" class="btn btn-vs-primary btn-sm btn-reverify-place" data-place-id="' + escapeHtml(p.id) + '" data-place-name="' + escapeHtml(p.name) + '">' +
      'Mark Re-Verified' +
      '</button>' +
      '</td>' +
      '</tr>'
    );
  }).join("");

  tbody.querySelectorAll(".btn-reverify-place").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const placeId = btn.getAttribute("data-place-id");
      const placeName = btn.getAttribute("data-place-name");
      const note = prompt(
        "Confirm Physical Verification for \"" + placeName + "\":\n\nEnter verification notes (e.g., visited venue, checked kitchen/menu):",
        ""
      );
      if (note === null) return; // user cancelled
      if (!note.trim()) {
        showAdminAlert("Enter what was checked at the visit before confirming re-verification.", true);
        return;
      }
      const visitDate = prompt(
        "Date of the physical visit for \"" + placeName + "\" (YYYY-MM-DD):",
        ""
      );
      if (visitDate === null) return; // user cancelled

      btn.disabled = true;
      btn.textContent = "Updating…";
      const res = await reverifyPlace(placeId, note, activeAdminUser, visitDate);
      if (res.status === "ok") {
        showAdminAlert("\"" + placeName + "\" marked as physically re-verified.", false);
        await loadVerificationTab();
      } else {
        showAdminAlert("Failed to update verification: " + (res.message || "server error"), true);
        btn.disabled = false;
        btn.textContent = "Mark Re-Verified";
      }
    });
  });
}

/* ---------------- Reports Moderation Tab ---------------- */

async function loadReportsTab() {
  const tbody = document.getElementById("reportsTableBody");
  const loading = document.getElementById("reportsLoading");
  const empty = document.getElementById("reportsEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (loading) loading.classList.remove("d-none");
  if (empty) empty.classList.add("d-none");

  const res = await fetchAdminReports();
  if (loading) loading.classList.add("d-none");

  if (res.status !== "ok" || !res.reports || res.reports.length === 0) {
    if (empty) empty.classList.remove("d-none");
    return;
  }

  tbody.innerHTML = res.reports.map(function (r) {
    const statusBadge = r.status === "pending"
      ? '<span class="badge bg-warning text-dark">Pending</span>'
      : (r.status === "resolved" ? '<span class="badge bg-success">Resolved</span>' : '<span class="badge bg-secondary">Dismissed</span>');

    const actionsHtml = r.status === "pending"
      ? '<div class="btn-group btn-group-sm">' +
        '<button type="button" class="btn btn-vs-primary btn-resolve-report" data-report-id="' + escapeHtml(r.id) + '">Resolve</button>' +
        '<button type="button" class="btn btn-outline-secondary btn-dismiss-report" data-report-id="' + escapeHtml(r.id) + '">Dismiss</button>' +
        '</div>'
      : '<small class="text-muted-vs">' + (r.resolvedAt ? 'Resolved ' + formatDate(r.resolvedAt) : 'Dismissed') + '</small>';

    return (
      '<tr>' +
      '<td><code>' + escapeHtml(r.placeId) + '</code></td>' +
      '<td><span class="badge bg-info text-dark">' + escapeHtml(r.reason) + '</span></td>' +
      '<td>' + escapeHtml(r.description || "(no additional text)") + '</td>' +
      '<td>' + statusBadge + '</td>' +
      '<td><small class="text-muted-vs">' + escapeHtml(formatDate(r.createdAt)) + '</small></td>' +
      '<td>' + actionsHtml + '</td>' +
      '</tr>'
    );
  }).join("");

  tbody.querySelectorAll(".btn-resolve-report").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const repId = btn.getAttribute("data-report-id");
      btn.disabled = true;
      const res = await resolveReport(repId, activeAdminUser);
      if (res.status === "ok") {
        showAdminAlert("Report resolved.", false);
        await loadOverviewStats();
        await loadReportsTab();
      } else {
        showAdminAlert("Failed to resolve report.", true);
        btn.disabled = false;
      }
    });
  });

  tbody.querySelectorAll(".btn-dismiss-report").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const repId = btn.getAttribute("data-report-id");
      btn.disabled = true;
      const res = await dismissReport(repId, activeAdminUser);
      if (res.status === "ok") {
        showAdminAlert("Report dismissed.", false);
        await loadOverviewStats();
        await loadReportsTab();
      } else {
        showAdminAlert("Failed to dismiss report.", true);
        btn.disabled = false;
      }
    });
  });
}

/* ---------------- Reviews Moderation Tab ---------------- */

async function loadReviewsTab() {
  const container = document.getElementById("reviewsAdminList");
  const loading = document.getElementById("reviewsLoading");
  const empty = document.getElementById("reviewsEmptyState");
  if (!container) return;

  container.innerHTML = "";
  if (loading) loading.classList.remove("d-none");
  if (empty) empty.classList.add("d-none");

  const res = await fetchAdminReviews();
  if (loading) loading.classList.add("d-none");

  if (res.status !== "ok" || !res.reviews || res.reviews.length === 0) {
    if (empty) empty.classList.remove("d-none");
    return;
  }

  container.innerHTML = res.reviews.map(function (r) {
    const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
    return (
      '<div class="d-flex justify-content-between align-items-center border-bottom py-2" id="review-row-' + escapeHtml(r.id) + '">' +
      '<div>' +
      '<strong>' + escapeHtml(r.authorName) + '</strong> &middot; <span style="color:#b8862f;">' + stars + '</span> ' +
      '<small class="text-muted-vs">(Place: ' + escapeHtml(r.placeId) + ')</small><br>' +
      '<span class="text-muted-vs" style="font-size:0.88rem;">' + escapeHtml(r.comment) + '</span><br>' +
      '<small class="text-muted-vs" style="font-size:0.75rem;">Posted on ' + escapeHtml(formatDate(r.createdAt)) + '</small>' +
      '</div>' +
      '<button type="button" class="btn btn-outline-danger btn-sm btn-delete-review" data-review-id="' + escapeHtml(r.id) + '">Delete Review</button>' +
      '</div>'
    );
  }).join("");

  container.querySelectorAll(".btn-delete-review").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const revId = btn.getAttribute("data-review-id");
      if (!confirm("Permanently delete this review?")) return;
      btn.disabled = true;
      btn.textContent = "Deleting…";
      const res = await deleteReviewByAdmin(revId, activeAdminUser);
      if (res.status === "ok") {
        showAdminAlert("Review deleted.", false);
        await loadOverviewStats();
        await loadReviewsTab();
      } else {
        showAdminAlert("Failed to delete review: " + (res.message || "server error"), true);
        btn.disabled = false;
        btn.textContent = "Delete Review";
      }
    });
  });
}

/* ---------------- Users Directory Tab ---------------- */

async function loadUsersTab() {
  const tbody = document.getElementById("usersTableBody");
  const loading = document.getElementById("usersLoading");
  const empty = document.getElementById("usersEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (loading) loading.classList.remove("d-none");
  if (empty) empty.classList.add("d-none");

  const res = await fetchAdminUsersList();
  if (loading) loading.classList.add("d-none");

  if (res.status !== "ok" || !res.users || res.users.length === 0) {
    if (empty) empty.classList.remove("d-none");
    return;
  }

  tbody.innerHTML = res.users.map(function (u) {
    const roleBadge = u.role === "admin"
      ? '<span class="badge bg-danger">admin</span>'
      : '<span class="badge bg-secondary">user</span>';

    return (
      '<tr>' +
      '<td><strong>' + escapeHtml(u.name) + '</strong></td>' +
      '<td>' + escapeHtml(u.email) + '</td>' +
      '<td><span class="badge bg-light text-dark">' + escapeHtml(u.dietPreference) + '</span></td>' +
      '<td>' + roleBadge + '</td>' +
      '<td><small class="text-muted-vs">' + escapeHtml(formatDate(u.createdAt)) + '</small></td>' +
      '</tr>'
    );
  }).join("");
}

/* ---------------- Edit Place Modal ---------------- */

function setupEditModal() {
  const modalEl = document.getElementById("editPlaceModal");
  if (!modalEl || typeof bootstrap === "undefined") return;
  editModalInstance = new bootstrap.Modal(modalEl);

  const form = document.getElementById("adminEditPlaceForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const placeId = document.getElementById("editPlaceId").value;
    const name = document.getElementById("editPlaceName").value.trim();
    const type = document.getElementById("editPlaceType").value;
    const address = document.getElementById("editPlaceAddress").value.trim();
    const area = document.getElementById("editPlaceArea").value.trim();
    const lat = parseFloat(document.getElementById("editPlaceLat").value);
    const lon = parseFloat(document.getElementById("editPlaceLon").value);
    const priceRange = document.getElementById("editPlacePrice").value;
    const desc = document.getElementById("editPlaceDesc").value.trim();
    const dietNotes = document.getElementById("editPlaceDietNotes").value.trim();
    const opening = document.getElementById("editPlaceOpening").value.trim();
    const imageUrl = document.getElementById("editPlaceImageUrl").value.trim();
    const status = document.getElementById("editPlaceStatus").value;

    const dietChecks = form.querySelectorAll('input[name="editPlaceDiet"]:checked');
    const dietTags = Array.from(dietChecks).map(function (c) { return c.value; });

    if (!name || !type || !address || dietTags.length === 0) {
      alert("Name, type, address and at least one diet tag are required.");
      return;
    }

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert("Coordinates must be valid numbers (Latitude: -90 to 90, Longitude: -180 to 180).");
      return;
    }

    const saveBtn = document.getElementById("saveEditPlaceBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    const res = await updatePlaceByAdmin(placeId, {
      name: name,
      placeType: type,
      address: address,
      area: area,
      latitude: lat,
      longitude: lon,
      dietTags: dietTags,
      priceRange: priceRange,
      description: desc,
      dietNotes: dietNotes,
      openingInfo: opening,
      imageUrl: imageUrl,
      status: status
    }, activeAdminUser);

    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";

    if (res.status === "ok") {
      editModalInstance.hide();
      showAdminAlert("Place details updated successfully.", false);
      await loadPendingTab();
      await loadPublishedTab();
    } else {
      alert("Failed to save changes: " + (res.message || "error"));
    }
  });
}

function openEditModal(placeId) {
  const p = currentPlacesCache[placeId];
  if (!p) {
    alert("Place data not found in cache.");
    return;
  }

  document.getElementById("editPlaceId").value = p.id;
  document.getElementById("editPlaceName").value = p.name;
  document.getElementById("editPlaceType").value = p.placeType;
  document.getElementById("editPlaceAddress").value = p.address;
  document.getElementById("editPlaceArea").value = p.area || "";
  document.getElementById("editPlaceLat").value = p.latitude;
  document.getElementById("editPlaceLon").value = p.longitude;
  document.getElementById("editPlacePrice").value = p.priceRange || "Price not listed";
  document.getElementById("editPlaceDesc").value = p.description || "";
  document.getElementById("editPlaceDietNotes").value = p.dietNotes || "";
  document.getElementById("editPlaceOpening").value = p.openingInfo || "";
  document.getElementById("editPlaceImageUrl").value = p.imageUrl || "";
  document.getElementById("editPlaceStatus").value = p.status || "pending";

  const form = document.getElementById("adminEditPlaceForm");
  form.querySelectorAll('input[name="editPlaceDiet"]').forEach(function (chk) {
    chk.checked = Array.isArray(p.dietTags) && p.dietTags.includes(chk.value);
  });

  if (editModalInstance) {
    editModalInstance.show();
  }
}

/* ---------------- Tab Navigation Listeners ---------------- */

function setupTabListeners() {
  const tabLinks = document.querySelectorAll('#adminTabs button[data-bs-toggle="tab"]');
  tabLinks.forEach(function (tab) {
    tab.addEventListener("shown.bs.tab", function (e) {
      const target = e.target.getAttribute("data-bs-target");
      if (target === "#tab-pending") loadPendingTab();
      if (target === "#tab-published") loadPublishedTab();
      if (target === "#tab-verification") loadVerificationTab();
      if (target === "#tab-reports") loadReportsTab();
      if (target === "#tab-reviews") loadReviewsTab();
      if (target === "#tab-users") loadUsersTab();
    });
  });
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

document.addEventListener("DOMContentLoaded", function () {
  onAuthChange(handleAuthState);
});
