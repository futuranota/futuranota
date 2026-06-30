import { verifyAndProcessWebhook } from "../../server/billing/billingActions.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @returns {Promise<Buffer>}
 */
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const raw = await readRawBody(req);
    const signature = req.headers["stripe-signature"];
    await verifyAndProcessWebhook(raw, signature);
    res.status(200).json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook failed";
    const status = message.includes("signature") ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
