import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { assertAdminUser } from "./managementHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const HORIZON_JSON = path.join(ROOT, "content/marketing/horizon.json");
const BLOGS_DIR = path.join(ROOT, "content/marketing/blogs");
const UPLOAD_DIR = path.join(ROOT, "public/uploads/horizon");
const PUBLIC_PREFIX = "/uploads/horizon";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);
const ZIP_EXTS = new Set([".zip"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_ZIP_BYTES = 12 * 1024 * 1024;

function slugify(raw, fallback = "kit") {
  const slug = String(raw || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function uniqueId(base, used) {
  let id = slugify(base);
  if (!used.has(id)) {
    used.add(id);
    return id;
  }
  let n = 2;
  while (used.has(`${id}-${n}`)) n += 1;
  const next = `${id}-${n}`;
  used.add(next);
  return next;
}

function readHorizonDoc() {
  const raw = fs.readFileSync(HORIZON_JSON, "utf8");
  return JSON.parse(raw);
}

function listBlogOptions() {
  if (!fs.existsSync(BLOGS_DIR)) return [];
  return fs
    .readdirSync(BLOGS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const slug = name.replace(/\.json$/i, "");
      let title = slug;
      try {
        const doc = JSON.parse(fs.readFileSync(path.join(BLOGS_DIR, name), "utf8"));
        if (typeof doc.title === "string" && doc.title.trim()) title = doc.title.trim();
        if (typeof doc.slug === "string" && doc.slug.trim()) {
          return { slug: doc.slug.trim(), title };
        }
      } catch {
        /* keep filename slug */
      }
      return { slug, title };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeKit(raw = {}, index = 0, usedIds = new Set()) {
  const title = String(raw.title || "").trim();
  const id = uniqueId(raw.id || title || `kit-${index + 1}`, usedIds);
  const free = Boolean(raw.free) || raw.price === "Free";
  const kitType = raw.kitType === "website-plugin" ? "website-plugin" : "instructions";

  return {
    id,
    tag: String(raw.tag || "HORIZON").trim() || "HORIZON",
    title,
    desc: String(raw.desc || "").trim(),
    org: asStringList(raw.org),
    free,
    price: String(raw.price || (free ? "Free" : "")).trim(),
    kitType,
    includes: asStringList(raw.includes),
    rating: String(raw.rating || "").trim(),
    reviews: (() => {
      if (raw.reviews == null || raw.reviews === "") return null;
      const n = Number(raw.reviews);
      return Number.isFinite(n) ? n : null;
    })(),
    downloads: String(raw.downloads || "").trim(),
    trend: Boolean(raw.trend),
    hot: Boolean(raw.hot),
    downloadUrl: String(raw.downloadUrl || "").trim(),
    previewUrl: String(raw.previewUrl || "").trim(),
    blogSlug: String(raw.blogSlug || "").trim(),
    image: String(raw.image || "").trim(),
  };
}

function normalizeDocument(doc) {
  const usedIds = new Set();
  const header = doc?.header && typeof doc.header === "object" ? doc.header : {};
  const opportunities = Array.isArray(doc?.opportunities) ? doc.opportunities : [];
  return {
    header: {
      eyebrow: String(header.eyebrow || "HORIZON"),
      title: String(header.title || ""),
      lead: String(header.lead || ""),
      linkLabel: String(header.linkLabel || "Browse all kits"),
    },
    opportunities: opportunities.map((item, index) => normalizeKit(item, index, usedIds)),
  };
}

function writeHorizonDoc(doc) {
  const payload = `${JSON.stringify(doc, null, 2)}\n`;
  try {
    fs.writeFileSync(HORIZON_JSON, payload, "utf8");
  } catch (err) {
    const code = err && typeof err === "object" ? err.code : "";
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      const error = new Error(
        "No se puede escribir horizon.json en este entorno. Editá en local (Vite) y commiteá, o usá Tina CMS.",
      );
      error.status = 501;
      throw error;
    }
    throw err;
  }
}

function safeExt(filename, allowed) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  return allowed.has(ext) ? ext : "";
}

function decodeDataUrl(data) {
  const raw = String(data || "");
  const match = raw.match(/^data:[^;]+;base64,(.+)$/);
  const b64 = match ? match[1] : raw;
  return Buffer.from(b64, "base64");
}

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * @param {{ headers?: Record<string, string|string[]|undefined>, method?: string, body?: Record<string, unknown> }} reqLike
 */
export async function processHorizonKitsRequest(reqLike) {
  const auth = await assertAdminUser(reqLike);
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };

  const method = String(reqLike.method || "GET").toUpperCase();

  if (method === "GET") {
    const doc = normalizeDocument(readHorizonDoc());
    return {
      status: 200,
      body: {
        ...doc,
        blogs: listBlogOptions(),
      },
    };
  }

  if (method === "POST") {
    const body = reqLike.body && typeof reqLike.body === "object" ? reqLike.body : {};
    const kind = body.kind === "zip" ? "zip" : "image";
    const filename = String(body.filename || "upload");
    const allowed = kind === "zip" ? ZIP_EXTS : IMAGE_EXTS;
    const ext = safeExt(filename, allowed);
    if (!ext) {
      return {
        status: 400,
        body: { error: kind === "zip" ? "Solo se aceptan archivos .zip" : "Imagen: png, jpg, webp, gif o svg" },
      };
    }
    const buf = decodeDataUrl(body.data);
    const max = kind === "zip" ? MAX_ZIP_BYTES : MAX_IMAGE_BYTES;
    if (!buf.length) return { status: 400, body: { error: "Archivo vacío" } };
    if (buf.length > max) {
      return {
        status: 400,
        body: { error: kind === "zip" ? "ZIP máximo 12 MB" : "Imagen máxima 4 MB" },
      };
    }

    ensureUploadDir();
    const stem = slugify(path.basename(filename, ext), kind);
    const outName = `${stem}-${Date.now()}${ext}`;
    const dest = path.join(UPLOAD_DIR, outName);
    try {
      fs.writeFileSync(dest, buf);
    } catch (err) {
      const code = err && typeof err === "object" ? err.code : "";
      if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
        return {
          status: 501,
          body: {
            error: "Los uploads no persisten en Vercel. Subí el archivo en local y commiteá public/uploads/horizon/.",
          },
        };
      }
      throw err;
    }

    return { status: 200, body: { url: `${PUBLIC_PREFIX}/${outName}` } };
  }

  if (method === "PUT") {
    const body = reqLike.body && typeof reqLike.body === "object" ? reqLike.body : {};
    const next = normalizeDocument({
      header: body.header,
      opportunities: body.opportunities,
    });
    if (next.opportunities.some((item) => !item.title)) {
      return { status: 400, body: { error: "Cada kit necesita un título" } };
    }
    writeHorizonDoc(next);
    return { status: 200, body: { ...next, blogs: listBlogOptions() } };
  }

  return { status: 405, body: { error: "Method not allowed" } };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => { chunks.push(chunk); });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function createHorizonKitsMiddleware() {
  return async (req, res, next) => {
    const pathname = req.url?.split("?")[0] || "";
    if (pathname !== "/api/admin/horizon-kits") {
      next();
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      const body = req.method === "GET" ? {} : await readJsonBody(req);
      const result = await processHorizonKitsRequest({
        headers: req.headers,
        method: req.method,
        body,
      });
      sendJson(res, result.status, result.body);
    } catch (err) {
      const status = err && typeof err === "object" && err.status ? err.status : 500;
      sendJson(res, status, {
        error: err instanceof Error ? err.message : "Horizon kits failed",
      });
    }
  };
}
