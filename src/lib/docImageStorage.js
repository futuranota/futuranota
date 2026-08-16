import { convertFileToWebpData } from "./convertImageToWebp.js";
import { getSupabaseConfigError, supabase } from "./supabaseClient.js";
import { inferAttachmentKind } from "./folderLibraryNormalize.js";

export const DOC_IMAGES_BUCKET = "doc-images";

function sanitizePathSegment(value, fallback = "misc") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || fallback;
}

/**
 * Upload a WebP blob to the public `doc-images` bucket.
 * Path: `{user_id}/{scopeId}/{fileId}.webp`
 *
 * @param {Blob} blob
 * @param {{ fileId?: string, scopeId?: string, upsert?: boolean }} [options]
 * @returns {Promise<string>} Public object URL
 */
export async function uploadDocImageBlob(blob, options = {}) {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }
  if (!blob || !(blob instanceof Blob)) {
    throw new Error("No image blob to upload.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message || "Auth error while uploading image.");
  }
  const userId = userData?.user?.id;
  if (!userId) {
    throw new Error("Sign in required to upload document images.");
  }

  const scopeId = sanitizePathSegment(options.scopeId, "doc");
  const fileId = sanitizePathSegment(options.fileId || `img_${Date.now()}`, "img");
  const path = `${userId}/${scopeId}/${fileId}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(DOC_IMAGES_BUCKET)
    .upload(path, blob, {
      contentType: "image/webp",
      upsert: options.upsert === true,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload image to Storage.");
  }

  const { data } = supabase.storage.from(DOC_IMAGES_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Upload succeeded but public URL was empty.");
  }
  return publicUrl;
}

/**
 * Convert a File to WebP and upload to Storage.
 * Same fields as convertFileToWebpData, but `src` is the Storage public URL (not a data-URL).
 *
 * @param {File|Blob} file
 * @param {{ quality?: number, fileName?: string, idPrefix?: string, maxWidth?: number, maxHeight?: number, scopeId?: string }} [options]
 * @returns {Promise<{ id: string, src: string, name: string, width: number, height: number }|null>}
 */
export async function convertAndUploadDocImage(file, options = {}) {
  const converted = await convertFileToWebpData(file, options);
  if (!converted?.blob) return null;

  const publicUrl = await uploadDocImageBlob(converted.blob, {
    fileId: converted.id,
    scopeId: options.scopeId,
  });

  return {
    id: converted.id,
    src: publicUrl,
    name: converted.name,
    width: converted.width,
    height: converted.height,
  };
}

/**
 * Upload a non-image library attachment (skill/pdf pack) without WebP conversion.
 * Path: `{user_id}/{scopeId}/{fileId}.{ext}`
 *
 * @param {File|Blob} file
 * @param {{ fileId?: string, scopeId?: string, upsert?: boolean, fileName?: string }} [options]
 * @returns {Promise<{ url: string, name: string, contentType: string, kind: string }>}
 */
export async function uploadDocAttachmentFile(file, options = {}) {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }
  if (!file) {
    throw new Error("No file to upload.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw new Error(userError.message || "Auth error while uploading attachment.");
  }
  const userId = userData?.user?.id;
  if (!userId) {
    throw new Error("Sign in required to upload attachments.");
  }

  const originalName = options.fileName
    || (typeof file.name === "string" && file.name.trim() ? file.name.trim() : "attachment");
  const extMatch = originalName.match(/\.([a-zA-Z0-9]{1,12})$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
  const scopeId = sanitizePathSegment(options.scopeId, "lib");
  const fileId = sanitizePathSegment(options.fileId || `att_${Date.now()}`, "att");
  const path = `${userId}/${scopeId}/${fileId}.${ext}`;
  const contentType = (file.type && String(file.type).trim())
    || "application/octet-stream";

  const { error: uploadError } = await supabase.storage
    .from(DOC_IMAGES_BUCKET)
    .upload(path, file, {
      contentType,
      upsert: options.upsert === true,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload attachment to Storage.");
  }

  const { data } = supabase.storage.from(DOC_IMAGES_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) {
    throw new Error("Upload succeeded but public URL was empty.");
  }

  return {
    url: publicUrl,
    name: originalName,
    contentType,
    kind: inferAttachmentKind(originalName, contentType),
  };
}
