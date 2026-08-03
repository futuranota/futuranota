/**
 * Gina system prompt for Groq — live corpus + Meeting LEARN/ANSWER protocol.
 */

const GINA_SYSTEM_PROMPT = `Eres **Gina**, el asistente de dashboard de Futura Nota (empresa / corpus activo).

## Quién eres
- Ves el workspace de la compañía abierta vía TOOL CONTEXT + WORKSPACE INVENTORY.
- Haces **scope**: panorama → foco, conversacional, breve.
- El schedule vive en Documents/folders de la base — **NUNCA** digas "calendario" (ni de Futura ni de Google).

## LIVE CORPUS ONLY (crítico)
- SOLO puedes nombrar departamentos, categorías y folders que aparezcan en WORKSPACE INVENTORY o TOOL CONTEXT.
- Si un nombre no está ahí, **no existe** para ti — no inventes "Productos", "Design", etc. porque salgan en ejemplos del training.
- Los ejemplos tipo Marketing/Blogs/Trends son **ilustrativos**, no datos del user.
- Si el inventario no tiene departamentos, dilo y pregunta en abierto (sin inventar nombres).

## Jerarquía
Empresa → Departamento → Categoría → Folder → Document
- Narración verbal: "Del departamento de {Depto}, de los {Categoría} de {Folder}, tienes…"
- Sin depto/categoría: "folder {X} sin categorizar".
- Mismo nombre en varias rutas → pregunta A/B/C; no asumas.
- No asumas qué quiere revisar el user si hay muchos folders.

## Schedule y status
- Folder: scheduleStartAt → scheduleFinishAt (días, opcional).
- Document: anchorAt → anchorFinishAt + status (null | not_started | reserved | in_progress | submitted | past_due | completed).
- "Qué hay para hoy" = status ≠ completed en el scope de hoy (ver TOOL CONTEXT). No inventes conteos.

## Tiempo (respeta family + TOOL CONTEXT)
- hoy / para hoy: resto del día.
- para mañana: solo mañana.
- hasta mañana: hoy + mañana.
- dentro de N días: solo ese día offset — si el contexto pide confirmación, confirma la fecha.
- esta semana: overview, poco detalle.

## Meeting mode — LEARN / ANSWER / CURSOR
Solo cuando **Meeting mode: ON**:

**LEARN** — el admin enseña (skill/doc en MEETING BRIEF, o dice “aprende esto”, o corrige tono/significado).
- Resume qué entendiste en 2–4 frases.
- Luego emite EXACTAMENTE un bloque (el cliente lo guarda si confirman):
<<<GINA_LEARN
title: Título corto del aprendizaje
body: Texto canónico que debes recordar (definición, tono, o “cuando digan X responde Y”)
>>>
- Pide confirmación: “¿Lo guardo en mi memoria?”

**ANSWER** — test / “¿qué significa…?” / “para tu entendimiento…”
- Responde SOLO con GINA TAUGHT MEMORY (+ MEETING BRIEF si aplica a esta sesión).
- Si no está enseñado → di claro que aún no te lo enseñaron; ofrece aprenderlo ahora. NO inventes producto.

**CURSOR** — UI/código/APIs → “necesita ajuste con Cursor” + qué falta. No finjas.

**MIXTO** — separa LEARN vs CURSOR.

Si Meeting mode está **OFF**:
- Solo TOOLS/scope del workspace.
- Si preguntan significado de producto y hay GINA TAUGHT MEMORY, puedes usarla; si no hay entrada, no inventes glosario.
- No hagas coaching LEARN ni pidas guardar memoria fuera de Meeting.

## Narración
- Mensaje corto (2–4 frases) + pregunta de foco abierta o basada en inventario real.
- NO listes todos los docs en prosa — la UI muestra cards.
- Vacío hoy: invita a explorar un departamento o documento **sin inventar nombres** (usa inventario o pregunta genérica).
- Prohibido hablar por el usuario o asumir su siguiente paso.
- **NUNCA** respondas con JSON, code fences, ni dumps de TOOL CONTEXT / inventory. Solo prosa natural para humanos. El JSON es input interno; la UI ya muestra cards.

## Flujo
1. Si Meeting ON: clasifica LEARN / ANSWER / CURSOR (o MIXTO). Si OFF: TOOLS (+ taught memory solo para producto ya enseñado).
2. Usa SOLO los datos del JSON de tools + inventory + taught memory (+ MEETING BRIEF si Meeting ON) como verdad. No inventes.
3. Responde en el idioma del usuario, en prosa (nunca JSON).
4. Sé directa y empática sin imponer.

## NUNCA
- Mutar datos, forzar status, inventar departamentos, hablar de "calendario".
- Fingir que implementaste UI/código sin Cursor.
- Inventar definiciones de producto que no estén en GINA TAUGHT MEMORY / MEETING BRIEF.
- Pegar o devolver el TOOL CONTEXT / inventory como respuesta.
`;

/**
 * @returns {string}
 */
export function getGinaSystemPrompt() {
  return GINA_SYSTEM_PROMPT;
}

/**
 * @param {unknown} reply
 * @returns {boolean}
 */
export function looksLikeGinaJsonDump(reply) {
  const t = String(reply || "").trim();
  if (!t) return false;
  if (!(t.startsWith("{") || t.startsWith("["))) return false;
  return /"[A-Za-z_][\w]*"\s*:/.test(t);
}

/**
 * Fallback narration when Groq is unavailable — prose only, never raw JSON.
 * @param {unknown} toolContext
 * @param {string} [locale]
 * @param {unknown} [inventory]
 */
export function fallbackGinaNarration(toolContext, locale = "es", inventory = null) {
  const es = locale !== "en";
  const ctx = toolContext && typeof toolContext === "object" ? toolContext : null;
  const inv = inventory && typeof inventory === "object" ? inventory : null;

  if (ctx?.unclear) {
    return es
      ? "No te seguí — ¿puedes decirme qué quieres revisar? Por ejemplo hoy, vencidos, o un departamento."
      : "I didn't follow that — what do you want to review? For example today, past due, or a department.";
  }

  if (ctx?.needsConfirm && ctx?.confirmDateLabel) {
    return es
      ? `¿Te refieres a ${ctx.confirmDateLabel}? Responde sí o no (o dame la fecha exacta).`
      : `Do you mean ${ctx.confirmDateLabel}? Reply yes or no (or give the exact date).`;
  }

  if (ctx?.ambiguity?.options?.length) {
    const lines = ctx.ambiguity.options.map((o, i) => {
      const letter = String.fromCharCode(65 + i);
      return `${letter}) ${o.label}`;
    });
    return es
      ? `${ctx.ambiguity.intro || "Ese nombre aparece en más de un sitio."}\n${lines.join("\n")}\n¿A cuál te refieres? Elige A, B o C.`
      : `${ctx.ambiguity.intro || "That name shows up in more than one place."}\n${lines.join("\n")}\nWhich one? Pick A, B, or C.`;
  }

  const today = ctx?.today && typeof ctx.today === "object" ? ctx.today : ctx;
  const docs = Array.isArray(today?.documents)
    ? today.documents
    : (Array.isArray(ctx?.documents) ? ctx.documents : null);
  const total = typeof today?.totalDocumentsToday === "number"
    ? today.totalDocumentsToday
    : (typeof ctx?.totalDocumentsToday === "number"
      ? ctx.totalDocumentsToday
      : (typeof ctx?.total === "number"
        ? ctx.total
        : (docs ? docs.length : null)));

  const deptNames = Array.isArray(inv?.departments)
    ? inv.departments.map((d) => d.name).filter(Boolean).slice(0, 4)
    : [];

  if (typeof total === "number" && total === 0) {
    if (deptNames.length) {
      return es
        ? `Para ese alcance no veo documentos pendientes (status distinto de completed). ¿Quieres explorar algún departamento en particular (${deptNames.join(", ")}) o algún documento que tengas en mente?`
        : `I don't see pending documents in that scope (status other than completed). Want to explore a department (${deptNames.join(", ")}) or a document you have in mind?`;
    }
    return es
      ? "Para ese alcance no veo documentos pendientes. ¿Quieres explorar algún departamento en particular o algún documento que tengas en mente?"
      : "I don't see pending documents in that scope. Want to explore a department or a document you have in mind?";
  }

  if (typeof total === "number" && total > 0) {
    const sample = (docs || [])
      .slice(0, 3)
      .map((d) => d.title || d.name)
      .filter(Boolean);
    const sampleBit = sample.length
      ? (es ? ` Entre ellos: ${sample.join(", ")}.` : ` Including: ${sample.join(", ")}.`)
      : "";
    return es
      ? `Veo ${total} documento${total === 1 ? "" : "s"} en ese alcance.${sampleBit} ¿En cuál quieres enfocarte?`
      : `I see ${total} document${total === 1 ? "" : "s"} in that scope.${sampleBit} Which one should we focus on?`;
  }

  if (toolContext == null) {
    return es
      ? "No tengo datos de scope todavía. Pregúntame qué tienes para hoy, qué está vencido, o cómo va un departamento."
      : "I don't have scope data yet. Ask what you have today, what's past due, or how a department looks.";
  }

  if (deptNames.length) {
    return es
      ? `Puedo ayudarte con el workspace. Departamentos a la vista: ${deptNames.join(", ")}. ¿Qué quieres revisar?`
      : `I can help with the workspace. Departments in view: ${deptNames.join(", ")}. What do you want to review?`;
  }

  return es
    ? "Puedo leer el workspace. ¿Quieres ver qué hay para hoy, qué está vencido, o un departamento?"
    : "I can read the workspace. Want to see what's for today, what's past due, or a department?";
}

/**
 * If the model echoed JSON, replace with prose fallback.
 * @param {string} reply
 * @param {unknown} toolContext
 * @param {string} [locale]
 * @param {unknown} [inventory]
 */
export function sanitizeGinaReply(reply, toolContext, locale = "es", inventory = null) {
  const text = String(reply || "").trim();
  if (!text) {
    return fallbackGinaNarration(toolContext, locale, inventory);
  }
  if (looksLikeGinaJsonDump(text)) {
    return fallbackGinaNarration(toolContext, locale, inventory);
  }
  return text;
}
