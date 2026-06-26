/**
 * DataForSEO Basic auth.
 *
 * Preferred (.env.local):
 *   DATAFORSEO_LOGIN=<base64 of "api_login:api_password">
 *   → Authorization: Basic ${DATAFORSEO_LOGIN}
 *
 * Legacy (still supported):
 *   DATAFORSEO_LOGIN=api_login
 *   DATAFORSEO_PASSWORD=api_password
 */
export function getDataForSeoAuthHeader() {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  if (!login) return null;

  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (password) {
    const token = Buffer.from(`${login}:${password}`).toString("base64");
    return `Basic ${token}`;
  }

  if (login.toLowerCase().startsWith("basic ")) return login;
  return `Basic ${login}`;
}

export function isDataForSeoConfigured() {
  return Boolean(process.env.DATAFORSEO_LOGIN?.trim());
}
