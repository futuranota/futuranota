import { supabase } from "./supabaseClient.js";
import { API_ROUTES } from "../api/routes.js";

async function authedFetch(url, init = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export function fetchHorizonKits() {
  return authedFetch(API_ROUTES.horizonKits);
}

export function saveHorizonKits(payload) {
  return authedFetch(API_ROUTES.horizonKits, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * @param {File} file
 * @param {"image"|"zip"} kind
 */
export async function uploadHorizonKitAsset(file, kind) {
  const data = await fileToBase64(file);
  return authedFetch(API_ROUTES.horizonKits, {
    method: "POST",
    body: JSON.stringify({
      kind,
      filename: file.name,
      data,
    }),
  });
}
