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
        ? "Polish writing, cut redundancy, and give it a clean professional structure."
        : "Pule la redacción, elimina redundancias y dale una estructura limpia y profesional.",
    },
  ];
  if (opts.writingEmpty !== false) {
    items.push({
      id: "doc_action_pdf_to_text",
      kind: "doc_action",
      action: "import_pdf",
      label: "PDF → text",
      hint: en
        ? "Upload a PDF from your computer into the empty writing area (document title can stay)."
        : "Subí un PDF desde tu computadora al área de escritura vacía (el título del documento puede quedarse).",
    });
  }
  items.push({
    id: "doc_action_export",
    kind: "doc_action",
    action: "export_prompt",
    label: en ? "Export document" : "Exportar documento",
    hint: en
      ? "Prepare a PDF export — save to Library or download now."
      : "Prepara la exportación en PDF — guardar en Biblioteca o descargar ahora.",
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
 * @param {{ locale?: string }} [opts]
 */
export function buildGinaExportPromptMessage(opts = {}) {
  const en = opts.locale === "en";
  return en
    ? "Ready — I’ll prepare this document’s PDF export. Before continuing: do you want to save it permanently in the Library for future projects, or download it right away?"
    : "Listo, prepararé la exportación de este documento en formato PDF. Antes de continuar, dime: ¿quieres guardarlo de forma permanente en la Biblioteca para futuros proyectos, o prefieres descargarlo de inmediato?";
}

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaExportFollowUpChips(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "doc_export_library",
      kind: "doc_export_dest",
      action: "save_pdf_library",
      label: en ? "Save to Library" : "Guardar en Biblioteca",
      text: en ? "Save to Library" : "Guardar en Biblioteca",
    },
    {
      id: "doc_export_download",
      kind: "doc_export_dest",
      action: "export_pdf",
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
  if (opts.action === "save_pdf_library") {
    return en
      ? "Saving the PDF to the folder Library…"
      : "Guardando el PDF en la Biblioteca del folder…";
  }
  return en
    ? "Preparing the PDF download…"
    : "Preparando la descarga del PDF…";
}
