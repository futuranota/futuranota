import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function handler(_req, res) {
  try {
    const xml = readFileSync(join(process.cwd(), "public", "sitemap.xml"), "utf8");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.status(200).send(xml);
  } catch {
    res.status(500).send("sitemap unavailable");
  }
}
