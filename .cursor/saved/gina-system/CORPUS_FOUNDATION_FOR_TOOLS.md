# Futura Nota — Corpus foundation (before Gina tools loop)

Review of what we built. Any Gina tools-loop must respect this map — not generic SQL / not a foreign CRM model.

## Hierarchy (product = code)

```
Empresa / Corpus (objectsStore — OBJ)
  └── Departamento (departmentsStore — DEPT; field `category` = display name)
        └── Categoría (subcategories[].label on the department)
              └── Folder / caja (docsStore — DOC / campaigns table)
                    └── Document (nodesStore — NODE; ex-macronode)
```

| UI language | Store | Supabase (approx) |
|---|---|---|
| Corpus / company | `objects` | `companies` |
| Department | `departments` (sidecar LS key) | **not** in main sync blob |
| Category | label string on dept + folder | — |
| Folder (Documents box) | `docs` | `campaigns` |
| Document | `nodes` | `nodes` |

Independent docs (`parentDocId == null`) live under Documents → **# Department** inbox.

## Open corpus

1. `/app` → company selector → `ensureCompanyObject` → dashboard  
2. Paint `localStorage` `futura-nota-v1` → version-gated `loadFromSupabase()`  
3. Active scope = `objectId` (never mix corpora)

## Surfaces (LeftPanel click-folders)

1. **Documents** — folder boxes + document rows  
2. **Departments** — taxonomy editor  
3. **Agents** — keep until explicit removal  
4. **Assistance / Asistente** — Gina Talk / Meeting / Knowledge  

Intel strip (separate): News · YouTube · Campaign · Event calendar · Forecast · Launch Radar · Market Hype.

## Schedule (two layers)

- Folder: `scheduleStartAt` → `scheduleFinishAt` (days)  
- Document: `anchorAt` → `anchorFinishAt` (hours) + `status`  
- Timeline visualizes; alarms = Gina later  

## Gina today

- Tools run **client-side** on Zustand snapshot (`ginaTools.js` + `runGinaQueryFamily`)  
- Groq narrates only (`ginaChatHandler` — no tool loop yet)  
- Inventory: dept/folder counts + names; **not** full doc list / bodies  
- Find / table bridge / lastTurn = local, deterministic when possible  
- LIVE CORPUS ONLY — never invent dept/folder/doc  

## Tools loop v1 (when we build it)

Must call **these** semantics (wrappers over existing tools), scoped by `objectId`:

- `get_workspace_inventory`  
- `get_all_company_documents` / list by dept·cat·folder  
- `filter_last_table` (bridge)  
- `get_today_scope` / `get_week_scope`  
- `get_folder_children_summary`  
- `open_document` (by id)  

Not: free `SELECT * FROM nodes`. Not: Claude/MCP required for v1.

## Non-negotiables from product rules

- Folders ≠ documents (terminology)  
- Do not mutate folder schedule from Gina  
- Do not edit document body  
- Keep Agents card until user approves removal  
- Surface base `#151515`  
