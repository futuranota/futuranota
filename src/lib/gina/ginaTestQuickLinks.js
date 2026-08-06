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
];

/**
 * @param {{ locale?: string }} [opts]
 * @returns {GinaTestQuickLink[]}
 */
export function getGinaTestQuickLinks(opts = {}) {
  void opts;
  return GINA_TEST_QUICK_LINKS.slice();
}
