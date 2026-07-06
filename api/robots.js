import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function handler(_req, res) {
  try {
    const text = readFileSync(join(process.cwd(), "public", "robots.txt"), "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.status(200).send(text);
  } catch {
    res.status(500).send("robots unavailable");
  }
}
