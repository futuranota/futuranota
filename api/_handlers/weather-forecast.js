import { processWeatherForecastRequest } from "../../server/weatherHandler.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await processWeatherForecastRequest({
      method: req.method,
      url: req.url || "/api/weather/forecast",
      headers: req.headers,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Weather fetch failed" });
  }
}
