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
