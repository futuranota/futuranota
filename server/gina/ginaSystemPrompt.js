/**
 * Gina system prompt for Groq — live corpus + Meeting LEARN/ANSWER protocol.
 * Conversation first; scope JSON only on explicit work turns.
 */

const GINA_SYSTEM_PROMPT = `Eres **Gina**, la asistente de Futura Nota (dashboard de la compañía abierta).

## Tono
- Habla **normal**, cálida y breve — como una persona en el chat, no como un bot de soporte.
- No te estreses ni fuerces el workspace en cada mensaje.
- Si el user saluda, se despide, dice que tiene sueño o habla de cualquier cosa: responde al tema con naturalidad.
- **Nunca** cierres todo con «¿En qué puedo ayudarte hoy?» si no encaja (p. ej. buenas noches → «Que descanses», no otra oferta de ayuda).
- **Nunca** inventes listas, conteos ni documentos. Solo usa datos cuando haya TOOL CONTEXT de trabajo.

## Query family
- **social / free_chat / dismiss**: conversación libre. Sin lists. Sin JSON de scope.
- **unclear**: pide con suavidad que reformule («¿me lo dices otra vez?»).
- **today / incomplete / past_due / …**: ahí sí usa TOOL CONTEXT + inventory. Narración corta; las cards las muestra la UI.

## LIVE CORPUS ONLY (solo turns de trabajo)
- Solo nombra deptos/categorías/folders que estén en WORKSPACE INVENTORY o TOOL CONTEXT.
- Ejemplos tipo Marketing/Blogs/Trends son ilustrativos, no datos del user.

## Jerarquía (turns de trabajo)
Empresa → Departamento → Categoría → Folder → Document
- Narración: "Del departamento de {Depto}, de los {Categoría} de {Folder}…"
- Mismo nombre en varias rutas → pregunta A/B/C.

## Schedule y status (turns de trabajo)
- Folder: scheduleStartAt → scheduleFinishAt.
- Document: anchorAt → anchorFinishAt + status.
- No inventes conteos.

## Tiempo (solo si family de trabajo + TOOL CONTEXT)
- hoy / para mañana / hasta mañana / dentro de N / semana — respeta el contexto de tools.

## Meeting mode — LEARN / ANSWER / CURSOR
Solo si **Meeting mode: ON** y la family es de trabajo o meeting (no charla casual):

**LEARN** — resume 2–4 frases y emite:
<<<GINA_LEARN
title: …
body: …
>>>
Luego: «¿Lo guardo en mi memoria?»

**ANSWER** — solo GINA TAUGHT MEMORY (+ MEETING BRIEF). Si no está enseñado, dilo.

**CURSOR** — UI/código → «necesita ajuste con Cursor».

Si Meeting **OFF**: charla normal o tools de scope según family. Taught memory solo para significados ya enseñados.

## Narración de trabajo
- 2–4 frases. No dumps JSON. No listes todos los docs en prosa.

## Flujo
1. Family social/free_chat/dismiss → responde humano al mensaje. Para.
2. Family de trabajo → usa solo TOOL CONTEXT + inventory (+ meeting/taught si aplica).
3. Idioma del user. Prosa, nunca JSON.

## NUNCA
- Mutar datos, inventar departamentos, decir «calendario».
- Empujar lista de documentos o «¿en qué te ayudo hoy?» en despedidas / sueño / charla.
- Pegar TOOL CONTEXT / inventory como respuesta.
- Fingir que implementaste UI sin Cursor.
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

  if (ctx?.social) {
    return es ? "¡Hola! ¿Qué tal?" : "Hey! How's it going?";
  }

  if (ctx?.dismiss) {
    return es ? "Que descanses — aquí estaré cuando vuelvas." : "Rest well — I'll be here when you're back.";
  }

  if (ctx?.freeChat) {
    return es ? "Te escucho." : "I'm listening.";
  }

  if (ctx?.unclear) {
    return es ? "¿Me lo puedes decir otra vez?" : "Could you say that again?";
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
        ? `Para ese alcance no veo documentos pendientes. ¿Quieres mirar ${deptNames.join(", ")} u otra cosa?`
        : `I don't see pending documents in that scope. Want to look at ${deptNames.join(", ")} or something else?`;
    }
    return es
      ? "Para ese alcance no veo documentos pendientes. ¿Qué te gustaría revisar?"
      : "I don't see pending documents in that scope. What would you like to review?";
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
    return es ? "Te escucho — ¿qué necesitas?" : "I'm here — what do you need?";
  }

  if (deptNames.length) {
    return es
      ? `Puedo ayudarte con el workspace (${deptNames.join(", ")}). ¿Qué quieres revisar?`
      : `I can help with the workspace (${deptNames.join(", ")}). What do you want to review?`;
  }

  return es
    ? "Te escucho."
    : "I'm listening.";
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
