/**
 * In-doc Gina: “Seleccionar opciones” menu + follow-up chips (deterministic, no Groq).
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   hint?: string,
 *   kind?: string,
 *   text?: string,
 *   action?: string,
 *   primary?: boolean,
 * }} GinaDocActionItem
 */

/**
 * @param {{ locale?: string, writingEmpty?: boolean }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaDocActionsMenu(opts = {}) {
  const en = opts.locale === "en";
  /** @type {GinaDocActionItem[]} */
  const items = [
    {
      id: "doc_action_organize",
      kind: "doc_action",
      action: "organize_prompt",
      label: en ? "Organize document" : "Organizar documento",
      hint: en
        ? "Polish the writing, remove redundancies, and bring a clean professional structure."
        : "Pule la redacción, elimina redundancias y aporta una estructura limpia y profesional.",
    },
  ];
  if (opts.writingEmpty !== false) {
    items.push({
      id: "doc_action_pdf_to_text",
      kind: "doc_action",
      action: "import_pdf",
      label: "PDF → text",
      hint: en
        ? "Upload a PDF from your computer to the work area (you can keep the current title)."
        : "Sube un archivo PDF desde tu ordenador al área de trabajo (puedes conservar el título actual).",
    });
  }
  items.push({
    id: "doc_action_export",
    kind: "doc_action",
    action: "export_prompt",
    label: en ? "Export document" : "Exportar documento",
    hint: en
      ? "Prepare your document export as PDF or Markdown; save it to the library or download it right away."
      : "Prepara la exportación de tu documento en PDF o Markdown; guárdalo en la biblioteca o descárgalo de inmediato.",
  });
  return items;
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaOrganizePromptMessage(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "I’ll polish the writing, remove redundancies, and give it a clean professional structure. Do you want a standard notes format, or should I adapt it to a specific style?"
    : "Voy a pulir la redacción, eliminar redundancias y darle una estructura limpia y profesional. ¿Deseas que mantenga un formato estándar de notas o prefieres adaptarlo a algún estilo en específico?";
}

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaOrganizeStyleChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "doc_organize_style_standard",
      kind: "doc_organize_style",
      action: "organize",
      label: en ? "Standard format" : "Formato Estándar",
      text: en ? "Standard format" : "Formato Estándar",
    },
    {
      id: "doc_organize_style_story",
      kind: "doc_organize_style",
      action: "organize",
      label: en ? "Story / Marketing tone" : "Tono Story / Marketing",
      text: en ? "Story / Marketing tone" : "Tono Story / Marketing",
    },
    {
      id: "doc_organize_style_pro",
      kind: "doc_organize_style",
      action: "organize",
      label: en ? "Professional tone" : "Tono Profesional",
      text: en ? "Professional tone" : "Tono Profesional",
    },
  ];
}

/**
 * @param {{ locale?: string, changed?: boolean }} [opts]
 */
export function buildGinaScriptAppliedAck(opts = {}) {
  const en = opts.locale === "en";
  if (opts.changed === false) {
    return en
      ? "Nothing to fix — I didn’t find markers to clean in this document."
      : "No encontré marcadores para arreglar en este documento.";
  }
  return en
    ? "Done — I cleaned ** and -- markers, bolded the names in one color, put each label on its own line, and moved the body below."
    : "Listo — arreglé el guion: limpié ** y --, puse negrita y un solo color en los nombres, el rótulo en su línea y el cuerpo abajo.";
}

/**
 * @param {{ locale?: string, styleId?: string }} [opts]
 */
export function buildGinaOrganizeAppliedAck(opts = {}) {
  const en = opts.locale === "en";
  const id = String(opts.styleId || "");
  if (id === "doc_organize_style_story") {
    return en
      ? "Got it — organizing with a Story / Marketing tone."
      : "Listo — organizando con tono Story / Marketing.";
  }
  if (id === "doc_organize_style_pro") {
    return en
      ? "Got it — organizing with a professional tone."
      : "Listo — organizando con tono profesional.";
  }
  return en
    ? "Got it — organizing with the standard notes format."
    : "Listo — organizando con formato estándar de notas.";
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaPdfToTextMessage(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "Understood. Use Upload to pick a PDF from your computer and I’ll turn it into editable text here."
    : "Entendido. Usá Upload para elegir un PDF de tu computadora y lo transformo en texto editable aquí.";
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaPdfWaitMessage(opts = {}) {
  const en = opts.locale === "en";
  return en ? "wait…" : "espera…";
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaPdfDoneMessage(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "Done — it’s already converted from PDF to text."
    : "Listo, ya está convertido de PDF a texto.";
}

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaPdfUploadChip(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "doc_pdf_upload",
      kind: "doc_pdf_upload",
      action: "import_pdf",
      label: "Upload",
      text: "Upload",
      primary: true,
      hint: en
        ? "Open your computer’s file picker"
        : "Abre el file picker de tu computadora",
    },
  ];
}

/**
 * Step 1 after “Exportar documento”: ask for format.
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaExportPromptMessage(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "What format would you like to export this document in? Pick one of the options below, or learn more if you need details."
    : "¿En qué formato te gustaría exportar este documento? Elige una de las opciones a continuación o descubre más detalles si lo necesitas.";
}

/**
 * @param {{ locale?: string, includeLearnMore?: boolean }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaExportFormatChips(opts = {}) {
  const en = opts.locale === "en";
  /** @type {GinaDocActionItem[]} */
  const chips = [
    {
      id: "doc_export_format_pdf",
      kind: "doc_export_format",
      action: "pdf",
      label: "PDF",
      text: "PDF",
    },
    {
      id: "doc_export_format_md",
      kind: "doc_export_format",
      action: "markdown",
      label: "Markdown",
      text: "Markdown",
    },
  ];
  if (opts.includeLearnMore !== false) {
    chips.push({
      id: "doc_export_format_learn",
      kind: "doc_export_format",
      action: "learn_more",
      label: en ? "Learn more" : "Saber más",
      text: en ? "Learn more" : "Saber más",
    });
  }
  return chips;
}

/**
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaExportLearnMoreMessage(opts = {}) {
  const en = opts.locale === "en";
  if (en) {
    return [
      "Of course! Here’s a short guide so you can pick what fits best:",
      "",
      "PDF is your best ally when you want a polished, final, static result. It keeps every visual detail, layout, and typography exactly the same no matter where it’s opened — perfect for printing, formal presentation, or sharing a closed document.",
      "",
      "Markdown (.md), on the other hand, is a lightweight plain-text format and very versatile. Ideal if you plan to keep editing, move content into other writing tools, code editors, or web platforms, while keeping a clean structure that’s easy to reorganize.",
      "",
      "Which format do you want to export this document in?",
    ].join("\n");
  }
  return [
    "¡Claro que sí! Te lo explico brevemente para que elijas la opción que mejor se adapte a lo que necesitas:",
    "",
    "El formato PDF es tu mejor aliado si buscas un resultado final, pulido y estático. Mantiene cada detalle visual, diseño y tipografía exactamente igual sin importar dónde se abra, lo que lo hace perfecto para imprimir, presentar formalmente o compartir un documento cerrado.",
    "",
    "Por otro lado, Markdown (.md) es un formato de texto plano hiperligero y súper versátil. Es ideal si planeas seguir editando el contenido, pasarlo a otras herramientas de escritura, editores de código o plataformas web, conservando una estructura limpia y fácil de reorganizar.",
    "",
    "¿En qué formato quieres exportar este documento?",
  ].join("\n");
}

/**
 * Step 3: after format choice — library vs download.
 * @param {{ locale?: string, format?: "pdf" | "markdown" }} [opts]
 */
export function buildGinaExportDestPromptMessage(opts = {}) {
  const en = opts.locale === "en";
  const md = opts.format === "markdown";
  if (en) {
    return md
      ? "Ready — I’ll prepare this document’s Markdown export.\nBefore continuing, tell me: do you want to save it permanently in the Library for future projects, or download it right away?"
      : "Ready — I’ll prepare this document’s PDF export.\nBefore continuing, tell me: do you want to save it permanently in the Library for future projects, or download it right away?";
  }
  return md
    ? "Listo, prepararé la exportación de este documento en formato Markdown.\nAntes de continuar, dime: ¿quieres guardarlo de forma permanente en la Biblioteca para futuros proyectos, o prefieres descargarlo de inmediato?"
    : "Listo, prepararé la exportación de este documento en formato PDF.\nAntes de continuar, dime: ¿quieres guardarlo de forma permanente en la Biblioteca para futuros proyectos, o prefieres descargarlo de inmediato?";
}

/**
 * @param {{ locale?: string, format?: "pdf" | "markdown" }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaExportFollowUpChips(opts = {}) {
  const en = opts.locale === "en";
  const md = opts.format === "markdown";
  return [
    {
      id: md ? "doc_export_md_library" : "doc_export_library",
      kind: "doc_export_dest",
      action: md ? "save_md_library" : "save_pdf_library",
      label: en ? "Save to Library" : "Guardar en Biblioteca",
      text: en ? "Save to Library" : "Guardar en Biblioteca",
    },
    {
      id: md ? "doc_export_md_download" : "doc_export_download",
      kind: "doc_export_dest",
      action: md ? "export_md" : "export_pdf",
      label: en ? "Download now" : "Descargar directo",
      text: en ? "Download now" : "Descargar directo",
    },
  ];
}

/**
 * @param {{ locale?: string, action?: string }} [opts]
 */
export function buildGinaExportAppliedAck(opts = {}) {
  const en = opts.locale === "en";
  const action = String(opts.action || "");
  if (action === "save_md_library") {
    return en
      ? "Saving the Markdown file to the folder Library…"
      : "Guardando el Markdown en la Biblioteca del folder…";
  }
  if (action === "export_md") {
    return en
      ? "Preparing the Markdown download…"
      : "Preparando la descarga del Markdown…";
  }
  if (action === "save_pdf_library") {
    return en
      ? "Saving the PDF to the folder Library…"
      : "Guardando el PDF en la Biblioteca del folder…";
  }
  return en
    ? "Preparing the PDF download…"
    : "Preparando la descarga del PDF…";
}
