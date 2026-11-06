/* ==========================================================================
   VeganSaathi — cloudinary-service.js
   Service layer for Cloudinary image uploads and URL optimizations.
   Strictly enforces client-side pre-flight validation and graceful degradation.
   ========================================================================== */

import { CLOUDINARY_CONFIG } from "./cloudinary-config.js";

const FORMAT_EXTENSIONS = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

/**
 * Validates an image file before upload.
 * Verifies presence, MIME type whitelist, file extension, and size cap (5 MB).
 *
 * @param {File|Blob|object} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: "Please select an image file to upload." };
  }

  const size = typeof file.size === "number" ? file.size : 0;
  if (size <= 0) {
    return { valid: false, error: "The selected file is empty." };
  }

  if (size > CLOUDINARY_CONFIG.maxSizeBytes) {
    const maxMb = (CLOUDINARY_CONFIG.maxSizeBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `Image file exceeds maximum allowed size of ${maxMb} MB.` };
  }

  const mime = typeof file.type === "string" ? file.type.toLowerCase().trim() : "";
  const name = typeof file.name === "string" ? file.name.toLowerCase().trim() : "";

  const allowedExtensions = Object.values(FORMAT_EXTENSIONS).flat();
  const hasAllowedExt = allowedExtensions.some(ext => name.endsWith(ext));
  const hasAllowedMime = CLOUDINARY_CONFIG.allowedFormats.includes(mime);

  // If MIME is provided, it must be in allowed formats
  if (mime.length > 0 && !hasAllowedMime) {
    return {
      valid: false,
      error: "Unsupported image format. Please select a JPG, PNG, or WebP photo."
    };
  }

  // If filename is provided, it must have an allowed extension
  if (name.length > 0 && !hasAllowedExt) {
    return {
      valid: false,
      error: "Unsupported image format. Please select a JPG, PNG, or WebP photo."
    };
  }

  // If neither MIME nor filename has an extension, reject
  if (mime.length === 0 && name.length === 0) {
    return {
      valid: false,
      error: "Unsupported image format. Please select a JPG, PNG, or WebP photo."
    };
  }

  return { valid: true };
}

/**
 * Validates whether a URL is a secure, well-formed HTTPS Cloudinary image URL.
 * Strictly rejects javascript:, data:, vbscript:, http:, or non-Cloudinary domains.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isValidCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return false;
  if (/[\s<>"'`\\]/.test(trimmed)) return false;
  const cloudinaryRegex = /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/.+/i;
  return cloudinaryRegex.test(trimmed);
}

/**
 * Validates a direct web image URL entered by a community contributor.
 * Detects common user mistakes (webpages, Google search URLs, social media links)
 * and verifies that the address points to a direct, public image file.
 *
 * @param {string} url
 * @returns {{ valid: boolean, error?: string, sanitizedUrl?: string }}
 */
export function validateDirectImageUrl(url) {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "Please enter an image web address." };
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Image address cannot be empty." };
  }

  if (trimmed.length > 1000) {
    return { valid: false, error: "Image URL is too long (maximum 1000 characters)." };
  }

  // Strictly reject dangerous schemes
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { valid: false, error: "Unsafe URL scheme detected. Only secure https:// web addresses are accepted." };
  }

  // Must be valid HTTP or HTTPS
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, error: "Invalid URL. Please enter a full web address starting with https://" };
  }

  // Discourage insecure HTTP
  if (trimmed.startsWith("http://")) {
    return { valid: false, error: "For security and privacy, please use a secure (https://) image address." };
  }

  // Disallow whitespace or raw quote characters
  if (/[\s<>"'`\\]/.test(trimmed)) {
    return { valid: false, error: "Image URL contains invalid characters or whitespace." };
  }

  // Parse URL to inspect host and path
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Please enter a valid, well-formed web address." };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // Common mistake 1: Google Images search results page
  if (host.includes("google.") && (path.includes("imgres") || path.includes("search") || path.includes("url"))) {
    return {
      valid: false,
      error: "This is a Google search page URL, not a direct image. On the image, right-click and choose 'Copy Image Address' (it should end in .jpg, .png, or .webp)."
    };
  }

  // Common mistake 2: Social media webpage links (Instagram, Facebook, Twitter, Pinterest)
  if (host.includes("instagram.com") || host.includes("facebook.com") || host.includes("twitter.com") || host.includes("x.com") || host.includes("pinterest.com")) {
    return {
      valid: false,
      error: "Social media post links cannot be used directly as image addresses. Please save the photo to your device and use 'Option A: Upload Photo' instead."
    };
  }

  // Common mistake 3: YouTube or video links
  if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("vimeo.com")) {
    return {
      valid: false,
      error: "Video URLs cannot be used as place photographs. Please provide a direct image address or upload a photo."
    };
  }

  // Direct image extension check
  const hasImageExt = /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(parsed.pathname);

  // Common direct image CDN patterns (e.g. Cloudinary, Unsplash, Imgur, Wikimedia)
  const isKnownImageCdn = host.includes("cloudinary.com") ||
    host.includes("images.unsplash.com") ||
    host.includes("imgur.com") ||
    host.includes("wikimedia.org") ||
    host.includes("wp.com") ||
    parsed.searchParams.has("format") ||
    parsed.searchParams.has("auto");

  if (!hasImageExt && !isKnownImageCdn) {
    return {
      valid: false,
      error: "This address does not appear to be a direct image file (e.g., ending in .jpg, .png, or .webp). Please check the link or upload the photo from your device."
    };
  }

  return { valid: true, sanitizedUrl: trimmed };
}

/**
 * Uploads a remote web image URL to Cloudinary using an unsigned upload preset.
 * Cloudinary retrieves the asset server-to-server, applies optimization, and stores
 * it safely under the project's folder.
 *
 * @param {string} remoteUrl
 * @param {object} [options={}]
 * @param {function(number):void} [options.onProgress]
 * @returns {Promise<{ success: boolean, secureUrl?: string, publicId?: string, isMock?: boolean, error?: string }>}
 */
export async function uploadRemoteImageToCloudinary(remoteUrl, options = {}) {
  const validation = validateDirectImageUrl(remoteUrl);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const sanitized = validation.sanitizedUrl;
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

  // Offline / Demo fallback pathway
  if (!CLOUDINARY_CONFIG.isConfigured) {
    if (onProgress) {
      onProgress(40);
      await new Promise(r => setTimeout(r, 60));
      onProgress(85);
      await new Promise(r => setTimeout(r, 60));
      onProgress(100);
    }

    return {
      success: true,
      secureUrl: sanitized,
      publicId: `mock_remote_${Date.now()}`,
      format: sanitized.split(".").pop().split("?")[0].toLowerCase() || "jpg",
      isMock: true,
      message: "Remote image verified in demonstration mode (Cloudinary credentials pending setup)."
    };
  }

  // Active Cloudinary Remote Upload API
  const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CONFIG.cloudName)}/image/upload`;
  const formData = new FormData();
  formData.append("file", sanitized);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  if (CLOUDINARY_CONFIG.folder) {
    formData.append("folder", CLOUDINARY_CONFIG.folder);
  }

  try {
    if (onProgress) onProgress(35);
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });
    if (onProgress) onProgress(80);

    const data = await response.json();
    if (!response.ok || !data.secure_url || !isValidCloudinaryUrl(data.secure_url)) {
      let msg = (data && data.error && data.error.message) || `Remote upload failed (HTTP ${response.status})`;
      // Provide clear guidance if Cloudinary was blocked by the remote host
      if (/fetch|download|connect|status code|access/i.test(msg)) {
        msg = "The website hosting this photo blocked Cloudinary from retrieving it (hotlink protection). Please save the photo to your device and use 'Option A: Upload Photo' instead.";
      }
      return { success: false, error: msg };
    }

    if (onProgress) onProgress(100);
    return {
      success: true,
      secureUrl: data.secure_url,
      publicId: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
      isMock: false
    };
  } catch (err) {
    return {
      success: false,
      error: (err && err.message) || "Network error occurred while fetching the remote image."
    };
  }
}

/**
 * Inserts Cloudinary transformation directives into a raw upload URL.
 * Automatically injects auto-format, auto-quality, and crop-fill dimensions.
 * Safe for non-Cloudinary URLs (returns unchanged if valid HTTP/HTTPS, rejects unsafe schemes).
 *
 * @param {string} rawUrl
 * @param {number} [width=800]
 * @param {number} [height=450]
 * @returns {string}
 */
export function buildOptimizedImageUrl(rawUrl, width = 800, height = 450) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();

  // Reject unsafe schemes immediately (javascript:, data:, vbscript:, file:)
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return "";
  if (!/^https?:\/\//i.test(trimmed)) return "";

  if (!trimmed.includes("res.cloudinary.com")) return trimmed;

  const uploadToken = "/image/upload/";
  const index = trimmed.indexOf(uploadToken);
  if (index === -1) return trimmed;

  // If URL already contains a transformation segment, return unchanged
  const afterUpload = trimmed.slice(index + uploadToken.length);
  if (afterUpload.startsWith("c_") || afterUpload.startsWith("w_") || afterUpload.startsWith("f_")) {
    return trimmed;
  }

  const transform = `c_fill,g_auto,w_${Math.round(width)},h_${Math.round(height)},q_auto,f_auto/`;
  return trimmed.slice(0, index + uploadToken.length) + transform + afterUpload;
}

/**
 * Uploads an image file to Cloudinary using an unsigned upload preset.
 * When Cloudinary is unconfigured (`isConfigured: false`), gracefully provides
 * an offline preview URL without network dispatch.
 *
 * @param {File|Blob} file
 * @param {object} [options={}]
 * @param {function(number):void} [options.onProgress]
 * @returns {Promise<{ success: boolean, secureUrl?: string, publicId?: string, isMock?: boolean, error?: string }>}
 */
export async function uploadImageToCloudinary(file, options = {}) {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

  // Offline / Demo fallback pathway
  if (!CLOUDINARY_CONFIG.isConfigured) {
    if (onProgress) {
      onProgress(30);
      await new Promise(r => setTimeout(r, 50));
      onProgress(75);
      await new Promise(r => setTimeout(r, 50));
      onProgress(100);
    }

    let demoUrl = "";
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && file instanceof Blob) {
      try {
        demoUrl = URL.createObjectURL(file);
      } catch {
        demoUrl = "";
      }
    }

    if (!demoUrl) {
      const ext = typeof file.name === "string" ? file.name.split(".").pop().toLowerCase() : "jpg";
      demoUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/demo_${Date.now()}.${ext}`;
    }

    return {
      success: true,
      secureUrl: demoUrl,
      publicId: `mock_${Date.now()}`,
      format: typeof file.name === "string" ? file.name.split(".").pop().toLowerCase() : "jpg",
      isMock: true,
      message: "Photo staged in offline demonstration mode (Cloudinary credentials pending setup)."
    };
  }

  // Active Cloudinary upload
  const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CONFIG.cloudName)}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  if (CLOUDINARY_CONFIG.folder) {
    formData.append("folder", CLOUDINARY_CONFIG.folder);
  }

  // Use XMLHttpRequest when available for progress updates
  if (typeof XMLHttpRequest !== "undefined" && onProgress) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url && isValidCloudinaryUrl(data.secure_url)) {
            resolve({
              success: true,
              secureUrl: data.secure_url,
              publicId: data.public_id,
              format: data.format,
              width: data.width,
              height: data.height,
              isMock: false
            });
          } else {
            const msg = (data && data.error && data.error.message) || `Cloudinary upload failed (HTTP ${xhr.status})`;
            resolve({ success: false, error: msg });
          }
        } catch {
          resolve({ success: false, error: "Failed to parse Cloudinary response." });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, error: "Network error during photo upload. Please check your connection." });
      };

      xhr.onabort = () => {
        resolve({ success: false, error: "Upload was cancelled." });
      };

      xhr.ontimeout = () => {
        resolve({ success: false, error: "Upload timed out. Please check your connection." });
      };

      xhr.send(formData);
    });
  }

  // Fallback to standard fetch
  try {
    if (onProgress) onProgress(40);
    const response = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });
    if (onProgress) onProgress(80);

    const data = await response.json();
    if (!response.ok || !data.secure_url || !isValidCloudinaryUrl(data.secure_url)) {
      const msg = (data && data.error && data.error.message) || `Upload failed (HTTP ${response.status})`;
      return { success: false, error: msg };
    }

    if (onProgress) onProgress(100);
    return {
      success: true,
      secureUrl: data.secure_url,
      publicId: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
      isMock: false
    };
  } catch (err) {
    return {
      success: false,
      error: (err && err.message) || "Network error occurred during photo upload."
    };
  }
}
