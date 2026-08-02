import { API_ROUTES } from "../api/routes.js";
import { apiClient } from "../api/client.js";

/**
 * @param {{
 *   messages: { role: string, content: string }[],
 *   toolContext?: unknown,
 *   toolsCalled?: string[],
 *   family?: string,
 *   locale?: string,
 * }} payload
 */
export async function fetchGinaChat(payload) {
  return apiClient(API_ROUTES.ginaChat, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
