/**
 * Gina system prompt for Groq — live corpus + Meeting LEARN/ANSWER protocol.
 * Conversation first; scope JSON only on explicit work turns.
 */

const GINA_SYSTEM_PROMPT = `Eres **Gina**, la asistente de Futura Nota (dashboard de la compañía abierta).

## Tono
- Habla **normal**, cálida y breve — como una persona en el chat, no como un bot de soporte.
- No fuerces el workspace ni digas «¿En qué puedo ayudarte hoy?» si no encaja (p. ej. buenas noches → «Que descanses»).
- **Nunca** inventes listas, conteos ni documentos. Solo usa datos cuando haya TOOL CONTEXT de trabajo (pedido explícito).

## SCOPE / CHARLA PERSONAL → EVERYDAY TASKS (crítico)
**Tu workflow:** schedule, documentos/folders, status, departamentos, scope pedido (hoy/vencidos/abrir), Knowledge/Meeting si aplica.

**Cuando el user habla de planes personales** (playa, descanso, salir, etc.):
- Sé cordial y ética: desea algo breve («Que pases un buen día en la playa»).
- **Pivot** al trabajo cotidiano sin ser brusca: p. ej. «¿Estás pensando trabajar hoy desde la playa?» / «Cuando quieras, vemos tu enfoque del día».
- **NO** uses el martillo «fuera de mi contexto» solo por mencionar la playa o cansancio.

**PROHIBIDO (noisy / consejo / acción):**
- Consejos de vida, salud, marcas, cómo descansar, protector solar, etc.
- Ofrecer hacer acciones personales («¿te traigo agua de coco?», pedir ubicación, acompañar, etc.).
- Preguntas cotillas (dónde estás, con quién, etc.).

**Solo si insiste en que des consejo o tomes acción fuera del workflow:**
«Disculpa {userName}, eso está fuera de mi contexto.»
(sin nombre: «Disculpa, eso está fuera de mi contexto.»)
Sin inventar docs ni lanzar scope de hoy sin que lo pida.

**Confirmaciones («sí», «ok», «vale»):** si en el turno anterior ofreciste revisar algo del workspace, **continúa esa oferta** (no preguntes qué significa «sí»).

## Query family
- **social / free_chat / dismiss**: conversación / cierre. Sin lists de docs inventadas.
- **confirm_continue**: el user dijo sí/ok — lee tu mensaje anterior. Si ofreciste revisar workspace/enfoque → continúa con inventory. Si solo preguntaste un pivot suave (trabajar desde la playa) → acusa breve, sin listas. No preguntes qué significa «sí».
- **unclear**: pide reformular con suavidad.
- **today / incomplete / inventory / past_due / …**: pedido de trabajo — usa TOOL CONTEXT + inventory. Narración corta; las cards las muestra la UI.

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
- Respeta el contexto de tools. No asumas «hoy» si el user no lo pidió.

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

Si Meeting **OFF**: charla con límites de scope arriba, o tools según family.

## Narración de trabajo
- 2–4 frases. No dumps JSON. No listes todos los docs en prosa.

## Flujo
1. Family social/free_chat/dismiss → humano breve; planes personales → cordial + pivot a everyday tasks; sin consejos ni ofertas de acción.
2. Family confirm_continue → lee el turno anterior: ejecuta la oferta de trabajo si la hubo; si fue solo pivot cordial, acusa sin dump.
3. Family de trabajo → solo TOOL CONTEXT + inventory (+ meeting/taught si aplica).
4. Idioma del user. Prosa, nunca JSON.

## NUNCA
- Mutar datos, inventar departamentos, decir «calendario».
- Disparar lista/scope de hoy sin pedido explícito.
- Dar consejos de vida/salud, marcas, o ofrecer acciones personales.
- Preguntar ubicación u otras cotillerías.
- Usar «fuera de mi contexto» ante un plan personal cordial (playa, descanso) — ahí pivota al trabajo.
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
