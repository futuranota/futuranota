/**
 * Route a Vercel dynamic segment to a handler map.
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 * @param {Record<string, (req: import('@vercel/node').VercelRequest, res: import('@vercel/node').VercelResponse) => unknown>} routes
 */
export async function dispatchEndpoint(req, res, routes) {
  const raw = req.query?.endpoint;
  const endpoint = Array.isArray(raw) ? raw.join("/") : typeof raw === "string" ? raw : "";

  const handler = routes[endpoint];
  if (!handler) {
    res.status(404).json({ error: `Unknown endpoint: ${endpoint || "(empty)"}` });
    return;
  }

  return handler(req, res);
}
