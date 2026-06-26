import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DETECTOR_PATH = path.join(__dirname, "../content/admin/detector-de-campanas.md");
const BRAND_DEEP_DETECTOR_PATH = path.join(__dirname, "../content/admin/detector-campana-marca.md");

let cachedDetectorContext = null;
let cachedBrandDeepTemplate = null;

/**
 * Loads the Futura Nota "Detector de Detonadores" business context for Groq.
 * @returns {string}
 */
export function loadDetectorContext() {
  if (cachedDetectorContext !== null) return cachedDetectorContext;
  try {
    cachedDetectorContext = fs.readFileSync(DETECTOR_PATH, "utf8").trim();
  } catch {
    cachedDetectorContext = "";
  }
  return cachedDetectorContext;
}

/**
 * Loads single-brand deep campaign detector context with brand substituted.
 * @param {string} brandName
 * @returns {string}
 */
export function loadBrandDeepDetectorContext(brandName) {
  if (cachedBrandDeepTemplate === null) {
    try {
      cachedBrandDeepTemplate = fs.readFileSync(BRAND_DEEP_DETECTOR_PATH, "utf8").trim();
    } catch {
      cachedBrandDeepTemplate = "";
    }
  }
  const name = (brandName || "").trim() || "la marca del corpus";
  return cachedBrandDeepTemplate.replace(/\{brandName\}/g, name);
}

/** Clears in-memory cache (tests / hot reload). */
export function clearDetectorContextCache() {
  cachedDetectorContext = null;
  cachedBrandDeepTemplate = null;
}

const TECHNICAL_BRIDGE = `
MAPEO OBLIGATORIO PARA ESTE SCAN (Horizon Scan):
- Cada "Detonador" / Objeto Padre del corpus → un item en JSON "companies[]".
- "brandName" = marca, evento o proveedor identificado en el snippet (no inventar).
- "overview" = 2-3 frases en español. Si aplica Matriz 1 (innovación/look) o Matriz 2 (pain point/solución), inclúyelo explícitamente citando el snippet.
- "launchDate" / "announcementDate" = solo fechas explícitas en el snippet; si no hay → null.
- Sin evidencia en snippets → no incluir la compañía.
`.trim();

const CADENCE_TECHNICAL_BRIDGE = `
MAPEO OBLIGATORIO PARA ANÁLISIS DE CADENCIA (Pass B — sin campaña confirmada):
- Un item en JSON "companies[]" por la marca solicitada.
- detectionMode DEBE ser "cadence_only". campaignActive DEBE ser false. launchDate DEBE ser null.
- Extrae SOLO del snippet: lastLaunchDate (YYYY-MM-DD), averageIntervalMonths (número), evidenceUrl, evidenceQuote.
- NO calcules meses restantes ni fechas futuras — el servidor lo hará con la fecha de hoy.
- overview: 2-3 frases en español citando el snippet; empieza con "No se detectó anuncio activo."
- Sin evidencia de cadencia en snippets → {"companies":[]}.
`.trim();

const BRAND_CAMPAIGN_BRIDGE = `
MAPEO OBLIGATORIO PARA VALIDACIÓN DE MARCA (Campaign Detector — Pass A):
- Solo incluir la marca solicitada si aparece en los snippets con evidencia de lanzamiento o anuncio.
- Misma schema que Horizon Scan (confirmed_campaign o cadence_only según evidencia).
- Sin evidencia → {"companies":[]}.
`.trim();

const BRAND_DEEP_BRIDGE = `
MAPEO OBLIGATORIO PARA ESTUDIO PROFUNDO DE MARCA (Intel Campaign — report-first):
- Responde con el schema JSON plano del system prompt (NO uses companies[]).
- Prioridad: cumplir la SOLICITUD DEL USUARIO con hechos de los snippets.
- Solo hechos sobre la marca solicitada presentes en snippets.
- overview = 2-3 frases en español (resumen ejecutivo).
- deepReport = informe completo en párrafos ES; OBLIGATORIO si hay snippets sobre la marca (nunca vacío en ese caso).
- launchSignals = frases del snippet con patrones de lanzamiento (ES/EN) + url + quote ≤200 chars.
- citations = hasta 10 entradas; url DEBE copiarse de un snippet link.
- detectionMode "research_report" cuando hay informe pero no campaña futura confirmada; "confirmed_campaign" solo si launchDate futuro explícito en snippet.
- campaignActive / launchDate = metadata opcional para el doc; NO bloquean el informe.
`.trim();

/**
 * Builds the Groq USER prompt: business detector context + technical extraction task.
 * @param {string} technicalTask
 * @param {"horizon"|"cadence"|"brand"|"brand-deep"} [mode]
 * @param {string} [brandName] — required for brand-deep
 */
export function buildGroqUserPrompt(technicalTask, mode = "horizon", brandName = "") {
  if (mode === "brand-deep") {
    const detector = loadBrandDeepDetectorContext(brandName);
    if (!detector) return `${BRAND_DEEP_BRIDGE}\n\n---\n\n${technicalTask}`;
    return `${detector}\n\n---\n\n${BRAND_DEEP_BRIDGE}\n\n---\n\n${technicalTask}`;
  }

  const detector = loadDetectorContext();
  const bridge = mode === "cadence"
    ? CADENCE_TECHNICAL_BRIDGE
    : mode === "brand"
      ? BRAND_CAMPAIGN_BRIDGE
      : TECHNICAL_BRIDGE;
  if (!detector) return `${bridge}\n\n---\n\n${technicalTask}`;
  return `${detector}\n\n---\n\n${bridge}\n\n---\n\n${technicalTask}`;
}
