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
 * @param {{ locale?: string }} [opts]
 * @returns {GinaDocActionItem[]}
 */
export function buildGinaDocActionsMenu(opts = {}) {
  const en = opts.locale === "en";
  return [
    {
      id: "doc_action_organize",
      kind: "doc_action",
      action: "organize_prompt",
      label: en ? "Organize document" : "Organizar documento",
      hint: en
        ? "Polish writing, cut redundancy, and give it a clean professional structure."
        : "Pule la redacción, elimina redundancias y dale una estructura limpia y profesional.",
    },
    {
      id: "doc_action_pdf_to_text",
      kind: "doc_action",
      action: "import_pdf",
      label: en ? "Convert PDF to editable text" : "Convertir PDF a texto editable",
      hint: en
        ? "Process a PDF from Library Attachments into editable writing."
        : "Procesa un PDF de Attachments de la Biblioteca en texto editable.",
    },
    {
      id: "doc_action_export",
      kind: "doc_action",
      action: "export_prompt",
      label: en ? "Export document" : "Exportar documento",
      hint: en
        ? "Prepare a PDF export — save to Library or download now."
        : "Prepara la exportación en PDF — guardar en Biblioteca o descargar ahora.",
    },
  ];
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
    ? "Understood. I’ll process the PDF file and turn it into fully editable text. Opening Library Attachments so you can pick the PDF."
    : "Entendido. Voy a procesar el archivo PDF y transformarlo en texto completamente editable. Abro Attachments de la Biblioteca para que elijas el PDF.";
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
