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
    label: "Test: sheet del día",
    text: "Sheet del día",
  },
  {
    id: "test_day_sheet_next",
    label: "Test: qué sigue",
    text: "¿Qué sigue?",
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
