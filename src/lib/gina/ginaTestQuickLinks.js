/**
 * Temporary Gina test quick-links (iteration harness).
 * Empty this array (or remove entries) when the user says “quítalo del link rápido”.
 */

/**
 * @typedef {{ id: string, label: string, text: string, primary?: boolean }} GinaTestQuickLink
 */

/** @type {GinaTestQuickLink[]} */
export const GINA_TEST_QUICK_LINKS = [
  {
    id: "test_last_turn_mkt_docs",
    label: "Test: docs Marketing (ancla)",
    text: "gina quiero todos los docs del departamento de marketing",
    primary: true,
  },
  {
    id: "test_last_turn_filter_blogs",
    label: "Test: filtrar tabla por blogs",
    text: "filtrame la tabla anterior por todos los blogs",
  },
  {
    id: "test_last_turn_filter_empty",
    label: "Test: filtrar sin matches",
    text: "filtrame la tabla anterior por xyzabc",
  },
  {
    id: "test_last_turn_refine_flex",
    label: "Test: excluir flexibles + hoy",
    text: "QUIERO QUE ME EXCLUYAS LOS FLEXIBLES Y ME DEJES SOLAMENTE LOS QUE TIENEN HORARIOS PARA HOY",
  },
  {
    id: "test_last_turn_open_named",
    label: "Test: abrir Guion (tabla ant.)",
    text: "DE LA TABLA ANTERIOR QUIERO QUE ME ABRAS EL DOCUMENTO Guion de la Parte 01",
  },
  {
    id: "test_last_turn_sheet",
    label: "Test: horarios de hoy (ancla)",
    text: "Muéstrame los horarios de hoy",
  },
  {
    id: "test_last_turn_modify",
    label: "Test: modificar este calendario",
    text: "no, quiero que me modiques este calendario",
  },
  {
    id: "test_last_turn_open_doc",
    label: "Test: ábreme el documento",
    text: "abreme el documento",
  },
  {
    id: "test_last_turn_open_first",
    label: "Test: abre el primero",
    text: "abre el primero",
  },
  {
    id: "test_wall_clock_day",
    label: "Test: qué día es hoy",
    text: "Qué día es hoy?",
  },
  {
    id: "test_wall_clock_date",
    label: "Test: qué fecha es",
    text: "Qué fecha es?",
  },
  {
    id: "test_wall_clock_time",
    label: "Test: qué hora es",
    text: "Qué hora es?",
  },
  {
    id: "test_folder_plan_negocio",
    label: "Test: docs del folder",
    text: "Dame todos los documentos del plan de negocio",
  },
  {
    id: "test_count_departments",
    label: "Test: cuántos departamentos",
    text: "Hola gina, Cuantos Departamenos tenemos en General ?",
  },
  {
    id: "test_count_folders_sales",
    label: "Test: folders en Sales",
    text: "Enfocarme hoy en Sales",
  },
  {
    id: "test_count_folders_qty",
    label: "Test: cuántos folders",
    text: "Cuántos folders tenemos en Marketing?",
  },
  {
    id: "test_count_categories",
    label: "Test: cuántas categorías",
    text: "Cuántas categorias tenemos en Marketing?",
  },
  {
    id: "test_named_category_blogs",
    label: "Test: cuantos blogs",
    text: "Cuantos blogs tenemos en marketing gina?",
  },
  {
    id: "test_named_category_social",
    label: "Test: redes sociales",
    text: "Cuales son los redes sociales que tenemos creadas?",
  },
  {
    id: "test_count_documents",
    label: "Test: cuántos documentos",
    text: "Cuántos documentos en total tenemos en todos los departamentos?",
  },
  {
    id: "test_docs_total_moment",
    label: "Test: total docs por el momento",
    text: "hola gina como estas, me puedes dar el total de documentos que tenemos por el momento?",
  },
  {
    id: "test_docs_list_all",
    label: "Test: listado completo docs",
    text: "Quiero el listado completo de todos los documentos",
  },
  {
    id: "test_docs_entregame",
    label: "Test: entregame todos los docs",
    text: "entregame todos los documentos",
  },
  {
    id: "test_docs_list_schedule",
    label: "Test: listado + horarios",
    text: "Listado completo con horarios",
  },
  {
    id: "test_docs_resaltar_cat",
    label: "Test: resaltar categoría",
    text: "Filtrar y resaltar: Blogs",
  },
  {
    id: "test_docs_que_sean_de",
    label: "Test: docs que sean de Blogs",
    text: "entregame todos los docs que sean de Blogs",
  },
  {
    id: "test_day_sheet_save",
    label: "Test: guardar sheet del día",
    text: "Guardar esta tabla de referencia del día",
  },
  {
    id: "test_day_sheet_open",
    label: "Test: horario del día",
    text: "Horario del día",
  },
  {
    id: "test_day_sheet_next",
    label: "Test: qué sigue",
    text: "¿Qué sigue?",
  },
  {
    id: "test_today_notify_hub",
    label: "Test: qué hay hoy (notify)",
    text: "qué tenemos para hoy",
  },
  {
    id: "test_notify_brief",
    label: "Test: Gina notify",
    text: "Gina quiere informarte algo",
  },
  {
    id: "test_recovery_slot_picker",
    label: "Test: reagendar fork",
    text: "Reagendar para hoy",
  },
  {
    id: "test_enable_day_notifications",
    label: "Test: activar notificaciones hoy",
    text: "Actívame las notificaciones para hoy mientras trabajo",
  },
  {
    id: "test_reset_day_ritual",
    label: "Test: reset ritual de hoy",
    text: "Reset ritual de hoy",
  },
  {
    id: "test_check_free_hours",
    label: "Test: horas libres doc",
    text: "Chequear horas libres para este documento",
  },
  {
    id: "test_activate_occupied_hours",
    label: "Test: activar horas tomadas",
    text: "activar horas tomadas",
  },
];

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaTestQuickLink[]}
 */
export function getGinaTestQuickLinks(opts = {}) {
  void opts;
  return GINA_TEST_QUICK_LINKS.slice();
}
