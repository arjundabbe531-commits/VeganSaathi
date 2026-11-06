/* ==========================================================================
   VeganSaathi — cloudinary-config.js
   Public configuration for Cloudinary media uploads.
   ========================================================================== */

export const CLOUDINARY_CONFIG = {
  // Public cloud name and unsigned upload preset (never commit API secret)
  cloudName: (typeof window !== "undefined" && window.VS_CLOUDINARY_CLOUD_NAME) || "vegansaathi",
  uploadPreset: (typeof window !== "undefined" && window.VS_CLOUDINARY_PRESET) || "vegansaathi_places_unsigned",
  folder: "vegansaathi/places",
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB maximum file size
  allowedFormats: ["image/jpeg", "image/png", "image/webp"],
  // When false, upload runs in safe offline/demo mode without network dispatch
  isConfigured: (typeof window !== "undefined" && window.VS_CLOUDINARY_IS_CONFIGURED === true) || false
};
