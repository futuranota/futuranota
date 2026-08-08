# Quitar Password table / Products / Guides del toolbar

## Alcance (acordado)

- **Sí:** sacar los 3 botones del toolbar y dejar de cablearlos desde Documents.
- **No:** borrar módulos enteros (`passwordTable*`, vista `groups`, agent Marketing Guide). Quedan en el repo por si se reactivan; dejan de ser alcanzables desde el toolbar.
- **Sí:** entregar queries SQL (con `SELECT` de preview) para limpiar DB a mano.

## UI / wiring

1. [`src/components/packs/PackActionsBar.jsx`](src/components/packs/PackActionsBar.jsx)
   - Eliminar botones + props de `onOpenPasswordTable`, `onOpenProducts`, `onInsertGuide`.
   - Quitar imports/iconos solo usados por esos botones.

2. [`src/components/left/LeftPanel.jsx`](src/components/left/LeftPanel.jsx)
   - Dejar de pasar esas props en todos los `PackActionsBar`.
   - Remover handlers muertos: `openPasswordTableFromToolbar`, `openProductsFromToolbar`, `handleInsertGuide` (y imports solo ligados a eso).

3. **No tocar** por ahora: overlays de password en `App.jsx`, store `passwordTableStore`, vista `clickFolderView === "groups"`, registry del Marketing Guide.

## SQL cleanup (entregar en el reply final)

- `password_table_entries` — DELETE por `user_id`
- `campaigns` donde `doc_kind = 'product'` (+ `nodes` hijos)
- `canvas_nodes` con `reference` agentId `marketing-guide`

## Verificación

- Toolbar sin Password table / Products / Guides.
- Siguen: Import, Steps, To do, URL table, Campaign.
- Sin crash por props faltantes.

## Todos

- [ ] Remove Password/Products/Guide buttons from PackActionsBar
- [ ] Stop wiring those props/handlers from LeftPanel
- [ ] Deliver SQL cleanup snippets in final reply
