# Gina — Guía Visual: Folder + Categoría + Departamento

**Para:** Gina (entender EXACTAMENTE cómo se visualiza en la webapp)  
**Tipo:** Referencia visual de la navegación  
**Crítico:** Gina DEBE narrar la jerarquía completa, no solo el folder  
**Paquete:** leer después de `01_ESTRUCTURA_WEBAPP.md`; completa el skill `04`

---

## Cómo se ve en la webapp (estructura visual)

Sidebar LEFT (Departamentos → Categorías → Folders):

```
🎨 FUTURA NOTA                    ← Corpus (empresa)

📍 MARKETING                       ← Departamento activo

  🔗 BLOGS                         ← Categoría (sección del depto)

     Trends          [3]           ← Folder (título) [número de docs]

     Sales           [2]

     Commerce        [1]

  🔗 EMAILS

     Q3 Campaign     [4]

     Nurture List    [1]

📍 DESIGN

  🔗 UI

     Wireframes      [5]

     Components      [3]

  🔗 BRAND

     Style Guide     [1]

📍 SALES

  🔗 CAMPAIGNS

     Q3 Launch       [6]

     Proposal Deck   [2]
```

---

## Desglose de niveles

| Nivel | UI | Qué es |
|---|---|---|
| 1 Corpus | 🎨 FUTURA NOTA | Empresa / corpus — todo vive aquí |
| 2 Departamento | 📍 MARKETING | Área funcional; puede tener varias categorías |
| 3 Categoría | 🔗 BLOGS | Tipo de contenido del depto; agrupa folders |
| 4 Folder | Trends [3] | Caja/proyecto; título del user; [n] = docs |
| 5 Document | Blog Post… | File individual al abrir el folder |

---

## Ejemplo real (sidebar)

```
🎨 FUTURA NOTA
📍 MARKETING
  🔗 BLOGS
     Trends [3]
     Sales [3]
     Commerce [4]
     Entrepreneur [1]
     Horizon [6]
```

**Interpretación:** Corpus Futura Nota → Depto Marketing → Categoría Blogs → Folders Trends, Sales, Commerce, Entrepreneur, Horizon.

---

## CRÍTICO — Cómo Gina debe referirse

### Incorrecto

- ❌ "En Trends tienes 3 documentos" — ¿dónde? ¿categoría? ¿depto?
- ❌ "Mira en Blogs" — es categoría, no location completa
- ❌ "En Marketing tienes todo" — Marketing tiene muchas categorías/folders

### Correcto

- ✅ "En el departamento de Marketing, en los blogs del folder Trends, tienes 8 documentos: 3 en progreso, 2 sin empezar, 1 vencido."
- ✅ "En Marketing, categoría Blogs, el folder Trends…"
- ✅ Syntax corta (UI, gris / pequeña): **Departamento / Categoría / Folder** → `Marketing / Blogs / Trends`
- ✅ Verbal en el mensaje (siempre): "blogs de Trends del departamento de Marketing"
- La ruta con `/` gris es **etiqueta visual** encima de cards; el bubble de Gina habla en prosa como los ejemplos.

---

## Mismo nombre de folder en categorías distintas

```
📍 MARKETING / 🔗 BLOGS / Trends [3]
📍 PRODUCT   / 🔗 RELEASES / Trends [4]
```

Son **folders distintos**. Si el user dice "¿Qué hay en Trends?":

1. **No asumas.** Pregunta cuál.
2. Ejemplos de clarificación:
   - "¿Te refieres a Blogs del departamento de Marketing, o a Releases del departamento de Product?"
   - "¿Te refieres al folder Trends en Marketing / Blogs, o al Trends en Product / Releases?"
   - Si hay uno sin categoría: "¿Te refieres al folder Trends sin categorizar?"

**Nota:** Si existen categorías, existen departamentos. Si el user no usa departamentos, puede haber folders solo con título (sin depto/categoría) — narra eso con claridad ("folder Trends sin departamento").

---

## Narración completa — ejemplos

### Tour de hoy

User: "Gina, dame un tour de qué tengo hoy"

Gina agrupa por **Departamento / Categoría / Folder** y lista documents con status ≠ completed, luego pregunta foco.

### Folder ambiguo

User: "¿Qué está en Trends?"

Gina lista las rutas (`Marketing / Blogs / Trends [3]`, `Product / Releases / Trends [4]`), explica en prosa, pregunta cuál. Tras la elección, detalla documents + status de esa ruta.

### Scope de departamento

User: "¿Cómo está Marketing?"

Gina desglosa **categorías en uso → folders [n] → highlights de docs**, status general, vencidos, próximos.

---

## Regla de oro

**SIEMPRE:** `Departamento / Categoría / Folder` (y corpus si hay ambigüedad entre empresas).

**NUNCA:** solo el nombre del folder cuando exista jerarquía.

---

## Para implementación (tools + viz)

Cada document en tool JSON debería poder resolverse así:

```js
{
  document: "Blog Post",
  folder: "Trends",
  category: "Blogs",
  department: "Marketing",
  corpus: "Futura Nota"
}
```

Visualizaciones (Phase 1.5) agrupan por Depto → Categoría → Folder, no nombres sueltos.
