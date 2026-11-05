# Cloudinary Integration Architecture & Implementation Guide — VeganSaathi

*Document status: Canonical Architecture Specification & Implementation Blueprint (2026-10-24)*

---

## 1. Executive Summary & Rationale

VeganSaathi is a community-driven, fieldwork-grounded vegan food discovery platform. Visual evidence—photos of storefronts, menus, verified vegan dishes, and nutritional declarations—is vital for student trust.

### 1.1 Why Cloudinary Over Firebase Storage?

| Dimension | Firebase Storage (Spark Free Plan) | Cloudinary (Free Tier) | VeganSaathi Rationale |
|---|---|---|---|
| **Storage & Bandwidth** | 1 GB total storage, 1 GB/day download bandwidth | 25 monthly credits (~25 GB storage or 25 GB bandwidth) | Cloudinary offers ~25x more storage capacity on free tier. |
| **Transformations** | None (raw storage only); resizing requires Cloud Functions (Blaze paid plan) | On-the-fly URL transformations (`f_auto`, `q_auto`, `w_800`, `c_limit`) | Dynamic optimization without serverless function costs. |
| **SDK Footprint** | Heavy client SDK (`@firebase/storage`), adds ~35 KB gzipped | Zero SDK required; pure standard browser `fetch` to REST endpoint | Zero client bundle bloat; works in vanilla JS. |
| **CDN Delivery** | Google Cloud Storage standard edge cache | Fastly / Akamai multi-CDN integration with global caching | Fast asset loading on mobile campus networks. |
| **Cost Predictability** | Strict caps; paid Blaze plan required for serverless resizing | Free tier never silently charges; soft caps with notification | Protects student project budget from unexpected cloud bills. |

---

## 2. Security Architecture

### 2.1 Unsigned Upload Preset vs Signed Backend

For a client-only static web architecture (Vanilla JS + Firebase Auth + Firestore), two upload patterns exist:

1. **Unsigned Uploads (Recommended for v1.1):**
   - Client directly uploads image binary to `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload` using an **unsigned upload preset**.
   - No API secret is ever exposed in client-side code (`CLOUDINARY_API_SECRET` must **never** appear in frontend JS).
   - Security is enforced through strict preset constraints configured in the Cloudinary Dashboard.

2. **Signed Uploads via Cloud Function (Future v2.0):**
   - Requires Firebase Blaze plan (Node.js Cloud Function generates a signed HMAC-SHA1 signature).
   - Deferred until backend compute is introduced.

### 2.2 Cloudinary Unsigned Preset Security Hardening

The unsigned upload preset (e.g., `vegansaathi_places_unsigned`) must be strictly configured in Cloudinary Dashboard with these constraints:

```yaml
Preset Configuration:
  Signing Mode: Unsigned
  Folder: "vegansaathi/places"
  Allowed Formats: ["jpg", "jpeg", "png", "webp"]
  Max File Size: 5242880 (5 MB)
  Incoming Transformations:
    - Quality: "auto" (q_auto)
    - Fetch Format: "auto" (f_auto)
    - Max Dimensions: 1600 x 1600 (c_limit)
    - Strip Metadata: true (EXIF GPS & camera metadata stripped to protect submitter privacy)
  Auto-tagging: ["user_submission", "community_upload"]
  Access Control: Public
  Moderation: "manual" or "webpurify" / "aws_rek" (optional add-on)
```

> [!IMPORTANT]
> **EXIF Privacy Hardening:** Stripping EXIF metadata on upload ensures submitters' home locations or camera fingerprints are not inadvertently published in photo binaries.

### 2.3 Client-Side Pre-Flight Validation

Before any byte is dispatched across the network, the client-side module (`cloudinary-service.js`) enforces:
1. **File Type Verification:** Mime-type whitelist check (`image/jpeg`, `image/png`, `image/webp`). Refuses SVG, GIF, HTML, or executable binaries.
2. **File Size Check:** Rejects files exceeding 5 MB before dispatch.
3. **Image Dimensions Check:** Reads header dimensions via `Image()` object; rejects images smaller than 200x200 (poor quality) or larger than 4000x4000 (wasteful memory usage).

### 2.4 Server-Side (Firestore Rules) Validation

When community places or admin edits are written to Firestore, security rules validate that `imageUrl` matches the authorized Cloudinary format:

```javascript
// Rule in firestore.rules.proposed
function isValidImageUrl(url) {
  return !( "imageUrl" in request.resource.data )
    || (
      request.resource.data.imageUrl is string
      && (
        request.resource.data.imageUrl.size() == 0
        || (
          request.resource.data.imageUrl.size() <= 300
          && request.resource.data.imageUrl.matches('^https://res\\.cloudinary\\.com/[a-zA-Z0-9_-]+/image/upload/.*')
        )
      )
    );
}
```

---

## 3. Directory & Folder Organization

Cloudinary assets are organized in a clean hierarchical folder structure:

```
vegansaathi/
├── places/               # Place storefront, seating, and food photos
│   └── {placeId}_{timestamp}.{ext}
├── reviews/              # Community dish review photos
│   └── {placeId}_{reviewId}_{timestamp}.{ext}
├── fieldwork/            # Verified fieldwork proof (menus, certs)
│   └── {placeId}_proof_{timestamp}.{ext}
└── avatars/              # User profile pictures (optional)
    └── {uid}_{timestamp}.{ext}
```

---

## 4. URL Transformations & Delivery Optimization

Cloudinary allows dynamic on-the-fly transformations by inserting parameters into the URL. VeganSaathi standardizes four transformation tiers:

| Tier | Transformation URL Snippet | Target Usage | Max Size |
|---|---|---|---|
| **Thumbnail** | `/c_fill,g_auto,w_400,h_260,q_auto,f_auto/` | Place cards on Explore & Home | ~25 KB |
| **Card Banner** | `/c_fill,g_auto,w_800,h_450,q_auto,f_auto/` | Saved places & Profile listing | ~60 KB |
| **Hero / Details** | `/c_limit,w_1200,h_800,q_auto,f_auto/` | Place Details top banner | ~120 KB |
| **Lightbox Zoom** | `/c_limit,w_1600,h_1600,q_auto,f_auto/` | High-res menu inspection | ~250 KB |

### Transformation Helper Function (`buildOptimizedImageUrl`):
```javascript
export function buildOptimizedImageUrl(rawUrl, width = 800, height = 450) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  if (!rawUrl.includes("res.cloudinary.com")) return rawUrl;
  
  // Insert transformation parameters directly after '/image/upload/'
  const uploadToken = "/image/upload/";
  const index = rawUrl.indexOf(uploadToken);
  if (index === -1) return rawUrl;
  
  const transform = `c_fill,g_auto,w_${width},h_${height},q_auto,f_auto/`;
  return rawUrl.slice(0, index + uploadToken.length) + transform + rawUrl.slice(index + uploadToken.length);
}
```

---

## 5. Configuration & Environment Scaffolding

### 5.1 Configuration File (`frontend/js/cloudinary-config.js`)

Public frontend configuration with clear defaults, graceful unconfigured detection, and mock provider:

```javascript
export const CLOUDINARY_CONFIG = {
  // Replace with real cloud name once account is provisioned:
  cloudName: window.VS_CLOUDINARY_CLOUD_NAME || "vegansaathi",
  uploadPreset: window.VS_CLOUDINARY_PRESET || "vegansaathi_places_unsigned",
  folder: "vegansaathi/places",
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  allowedFormats: ["image/jpeg", "image/png", "image/webp"],
  isConfigured: false // Set to true when real credentials are verified
};
```

### 5.2 Graceful Degradation & Mock Support

If `CLOUDINARY_CONFIG.isConfigured` is `false`:
- The submission UI shows an advisory notice: `"(Optional) Photo upload running in offline/demo mode"`.
- If an image file is selected, the service generates a clean local object URL (`URL.createObjectURL(file)`) or placeholder for offline demonstration.
- The place can be submitted successfully without photo upload failing the entire submission.

---

## 6. Frontend Component Architecture

### 6.1 `frontend/js/cloudinary-service.js`

Provides core upload functionality:
- `validateImageFile(file)`: Verifies format, size, and dimensions.
- `uploadImageToCloudinary(file, options)`: Dispatches multipart `FormData` to Cloudinary endpoint with `onProgress` callback support.
- `buildOptimizedImageUrl(url, width, height)`: Generates responsive transformation URL.

### 6.2 UI Integration in `frontend/submit-place.html`

Replace disabled placeholder file input with interactive upload zone:
- Remove `disabled` attribute from `#spPhoto`.
- Add interactive image preview container (`#spPhotoPreviewContainer`) with image thumbnail and "✕ Remove" button.
- Add progress bar (`#spUploadProgress`).
- Add helper hint detailing allowed formats (JPG, PNG, WebP) and 5MB limit.

### 6.3 Form Handler in `frontend/js/submit-place-guard.js`

When user submits the form:
1. If a photo file is selected:
   - Sets button to `"Uploading photo…"`
   - Calls `uploadImageToCloudinary(photoFile, { onProgress: updateProgressBar })`
   - Obtains secure `secure_url` (or demo URL in mock mode)
   - Assigns `imageUrl: uploadResult.secureUrl`
2. If no photo file selected:
   - Submits cleanly with `imageUrl: ""`
3. Passes `imageUrl` to `submitCommunityPlace()`.

---

## 7. Automated Testing & Verification Strategy

### 7.1 Unit Tests (`tests/test-cloudinary-service.mjs`)
- Validates file type whitelisting (accepts JPG/PNG/WebP, rejects PDF/SVG/EXE).
- Validates file size boundary conditions (accepts 5,242,880 bytes, rejects 5,242,881 bytes).
- Validates URL generation with transformation parameters.
- Validates mock upload pathway when `isConfigured` is false.
- Validates network error handling and graceful error message propagation.

### 7.2 Static Checks
- Verify no duplicate globals on `submit-place.html`.
- Run `node --check` across all new JS/MJS modules.

---

## 8. Deployment & Operational Runbook

When the team creates their free Cloudinary account:
1. Log in to [Cloudinary Console](https://cloudinary.com/console).
2. Note your **Cloud Name** (e.g. `vegansaathi-media`).
3. Navigate to **Settings** → **Upload** → **Upload presets**.
4. Click **Add upload preset**:
   - Preset name: `vegansaathi_places_unsigned`
   - Signing Mode: `Unsigned`
   - Folder: `vegansaathi/places`
   - Allowed formats: `jpg, png, webp`
   - Incoming transformations: `q_auto, f_auto, w_1600, c_limit`
   - Exif data: `Discard Exif data` (checked)
5. Save preset.
6. Update `cloudName` and `isConfigured: true` in `frontend/js/cloudinary-config.js`.

---

## 9. Web Image Address Ingestion & Dual Photo Experience

### 9.1 The Problem Solved
Community submitters frequently find place photographs from restaurant menus, reviews, or photo galleries online. Pasting arbitrary web links previously resulted in validation failures or broken previews because:
1. Pasted URLs were often full HTML web pages (e.g., Google Search result links, Instagram posts, YouTube videos) rather than direct image binaries.
2. The submission pipeline previously rejected non-file inputs or strictly required pre-existing `res.cloudinary.com` addresses.

### 9.2 Architecture of the Solution
The Submit Place interface provides two clearly demarcated, mutual options:
- **Option A (Device Upload / Camera / Dropzone):**
  - Allows selecting from local device storage, mobile camera, or drag-and-drop.
  - Progress bar indicates client-to-Cloudinary upload status.
- **Option B (Direct Image Web Address):**
  - Text input for pasting direct image URLs.
  - Client-side pre-validation via `validateDirectImageUrl(url)` detects and rejects HTML webpage links, search engine wrappers, and video sites, providing immediate, actionable guidance.
  - Live pre-flight render via an in-memory `new Image()` verifies that the image is publicly accessible and not blocked by remote hotlinking / CORS protections.
  - During form submission, `uploadRemoteImageToCloudinary(url)` dispatches the verified URL to Cloudinary's remote upload API (`file: <remote_url>`), creating an optimized, permanently hosted asset on Cloudinary.
  - If Cloudinary is unconfigured (demo mode) or remote mirroring encounters restrictive CORS headers, the system safely falls back without crashing, informing the submitter.

### 9.3 Unified Preview Card
Regardless of whether Option A or Option B is used, a single unified preview card displays:
- A rendered image preview with responsive aspect-ratio containment.
- File metadata (file name and size for local uploads; host domain and pixel dimensions for web URLs).
- A single "Remove Photo" control that completely resets both inputs and preview states.
