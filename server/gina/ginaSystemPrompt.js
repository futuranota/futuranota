/**
 * Gina system prompt for Groq — live corpus only + time/narration rules.
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

## Narración
- Mensaje corto (2–4 frases) + pregunta de foco abierta o basada en inventario real.
- NO listes todos los docs en prosa — la UI muestra cards.
- Vacío hoy: invita a explorar un departamento o documento **sin inventar nombres** (usa inventario o pregunta genérica).
- Prohibido hablar por el usuario o asumir su siguiente paso.

## Flujo
1. Usa SOLO JSON de tools + inventory. No inventes.
2. Responde en el idioma del usuario.
3. Sé directa y empática sin imponer.

## NUNCA
- Mutar datos, forzar status, inventar departamentos, hablar de "calendario".
`;

/**
 * @returns {string}
 */
export function getGinaSystemPrompt() {
  return GINA_SYSTEM_PROMPT;
}

/**
 * Fallback narration when Groq is unavailable — faithful to tool JSON only.
 * @param {unknown} toolContext
 * @param {string} [locale]
 * @param {unknown} [inventory]
 */
export function fallbackGinaNarration(toolContext, locale = "es", inventory = null) {
  const es = locale !== "en";
  const ctx = toolContext && typeof toolContext === "object" ? toolContext : null;
  const inv = inventory && typeof inventory === "object" ? inventory : null;

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

  const total = ctx?.totalDocumentsToday ?? ctx?.documents?.length ?? ctx?.total ?? null;
  if (typeof total === "number" && total === 0) {
    const deptNames = Array.isArray(inv?.departments)
      ? inv.departments.map((d) => d.name).filter(Boolean).slice(0, 4)
      : [];
    if (deptNames.length) {
      return es
        ? `Para ese alcance no veo documentos pendientes (status distinto de completed). ¿Quieres explorar algún departamento en particular (${deptNames.join(", ")}) o algún documento que tengas en mente?`
        : `I don't see pending documents in that scope (status other than completed). Want to explore a department (${deptNames.join(", ")}) or a document you have in mind?`;
    }
    return es
      ? "Para ese alcance no veo documentos pendientes. ¿Quieres explorar algún departamento en particular o algún documento que tengas en mente?"
      : "I don't see pending documents in that scope. Want to explore a department or a document you have in mind?";
  }

  if (toolContext == null) {
    return es
      ? "No tengo datos de scope todavía. Pregúntame qué tienes para hoy, qué está vencido, o cómo va un departamento."
      : "I don't have scope data yet. Ask what you have today, what's past due, or how a department looks.";
  }
  try {
    const json = typeof toolContext === "string"
      ? toolContext
      : JSON.stringify(toolContext, null, 2);
    const clipped = json.length > 3500 ? `${json.slice(0, 3500)}…` : json;
    return es
      ? `Aquí está lo que veo en tus datos (modo sin Groq):\n\n${clipped}\n\n¿En qué quieres enfocarte?`
      : `Here's what I see in your data (no Groq mode):\n\n${clipped}\n\nWhat should we focus on?`;
  } catch {
    return es
      ? "Pude leer el workspace pero no narrar el detalle. Intenta de nuevo."
      : "I could read the workspace but not narrate details. Try again.";
  }
}
