import { createServer } from "vite";
const server = await createServer({ configFile: new URL("./vite.config.js", import.meta.url).pathname });
await server.listen();
const ids = [
  "/src/main.jsx",
  "/src/components/intel/MarketHypeWidget.tsx",
  "/src/styles/left-panel.css",
  "/src/styles/market-hype-tailwind.css",
];
for (const id of ids) {
  try {
    const r = await server.transformRequest(id);
    const code = r?.code || "";
    console.log("OK", id, "Folder.svg?", code.includes("Folder.svg"));
    const uploads = code.match(/\/uploads\/[^\s"'`)]+/g);
    if (uploads) console.log("  uploads", [...new Set(uploads)].slice(0, 20));
  } catch (e) {
    console.log("FAIL", id, String(e.message).slice(0, 250));
  }
}
await server.close();
