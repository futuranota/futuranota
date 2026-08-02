# Futura Nota — Estructura de la webapp (conocimiento para Gina)

**Para:** Gina / Asistente  
**Tipo:** Mapa semántico del producto (cómo está organizada la información)  
**No es:** brief de alarmas, To Do, ni schedule (eso vive en `BRIEF.md` y `SCHEDULE_AND_STATUS.md`)

---

## 1. Qué es Futura Nota (como webapp)

Futura Nota es un workspace de planificación y escritura por **empresa**.

El usuario entra a **una empresa a la vez**. Dentro de esa empresa organiza trabajo en:

1. **Departamentos** (áreas de la empresa)
2. **Categorías** (tipos de contenido de ese departamento)
3. **Folders** (cajas / proyectos temáticos)
4. **Documents** (unidades de contenido programables dentro del folder)

```
Usuario
 └── Empresa (Corpus + Brand + Description)
      └── Departamento (ej. Marketing)
           └── Categoría (ej. blogs)
                └── Folder (ej. Trends)
                     └── Documents (piezas de contenido / schedule / to dos)
```

Gina siempre debe leer el contexto en este orden:  
**¿en qué empresa estoy? → ¿qué departamento? → ¿qué categoría? → ¿qué folder? → ¿qué document?**

---

## 2. Empresas: separación, Corpus, Brand y Description

### 2.1 Cómo están separadas las empresas

Cada **empresa** es un contenedor aislado (objeto de negocio / `company`).

- Los folders, documents, departamentos y categorías de una empresa **no se mezclan** con los de otra.
- Al abrir una empresa, el workspace se filtra a ese `objectId` (corpus activo).
- Gina no debe narrar ni mezclar scope de otra empresa salvo que el usuario lo pida explícitamente.

En datos:

| Concepto UI | Entidad | Store / tabla |
|---|---|---|
| Empresa | Object / Company | `objectsStore` → Supabase `companies` |
| Folder (caja Documents) | Doc (campaign) | `docsStore` → Supabase `campaigns` |
| Document (file programable) | Node / macronodo | `nodesStore` + vínculo al folder |
| Departamento | Department | `departmentsStore` → `departments` |

### 2.2 Cada empresa es un Corpus y un Brand

Al crear/editar una empresa el usuario define tres campos clave:

| Campo | Qué es | Para qué sirve |
|---|---|---|
| **Name / Corpus** | Nombre del contenedor organizacional | Identifica el “universo” de trabajo de esa empresa dentro de Futura Nota |
| **Brand** | Nombre comercial / marca | Identidad de mercado; agents e intel hablan de la marca |
| **Description** | Megadata de la empresa | Contexto semántico estable: qué es, a qué se dedica, sector, posicionamiento |

**Corpus** = la empresa como *casa* de trabajo (hive / contenedor).  
**Brand** = la empresa como *marca* hacia el mundo.

Pueden coincidir (ej. corpus “Nike” + brand “Nike”) o diferenciarse (corpus interno “Acme LatAm HQ” + brand “Acme”).

La primera empresa del usuario suele marcarse como **corpus** (rol primario); otras pueden ser satélites, pero para Gina la regla práctica es:

> Cada empresa abierta = un corpus de trabajo con su propia brand y su propia megadata.

### 2.3 Qué es la Description (megadata) y por qué existe

La **Description** de la empresa **no es un documento**.  
No es body editable de un file. Es **megadata**: metadata semántica de alto nivel sobre la empresa/marca.

**Significa:**

- Quién es esta empresa
- En qué industria / sector opera
- Qué hace o qué vende (resumen)
- Contexto que Gina (y otros agents) pueden usar para hablar con precisión sin inventar

**Para Gina:**

- Úsala como **contexto de marca**, no como contenido de trabajo del día
- No la reescribas
- Si el user pregunta “¿de qué empresa es esto?”, puedes anclar en name + brand + description
- Si description está vacía, no inventes sector ni posicionamiento

Ejemplo mental:

```
Corpus:   Voltway
Brand:    Voltway
Description (megadata):
  "Marca de vehículos eléctricos. Enfoque en movilidad urbana
   y lanzamientos de producto en LatAm."
```

Eso orienta tono y vocabulario. Los blogs, campañas y to dos viven **abajo**, en folders/documents.

---

## 3. Dentro del Corpus: Departamentos

### 3.1 Qué es un Departamento

Un **departamento** es un área funcional de la empresa, dentro de ese corpus.

Ejemplos: Marketing, Sales, Product, HR, Finance.

En producto:

- Se crean desde el panel **Departments** del corpus activo
- Pertenecen a un `objectId` (la empresa)
- Tienen:
  - **Nombre** (ej. “Marketing”)
  - **Description** (qué hace ese departamento en esta empresa)
  - **Categories** (tags / secciones de contenido)

Metáfora útil para Gina:

> Corpus = edificio de la empresa  
> Departamento = piso / sala (Marketing, Sales…)  
> Categoría = tipo de estantería dentro de esa sala (blogs, emails…)  
> Folder = caja concreta encima de una estantería (Trends, Q3 Launch…)  
> Document = hoja / archivo dentro de la caja

### 3.2 Qué significa “departamento” en una empresa

No es solo una etiqueta visual. Es la **pertenencia organizacional** del trabajo:

- Un folder de Marketing pertenece al departamento Marketing
- Filtrar por Marketing muestra solo folders de ese departamento
- Gina, al narrar scope, puede agrupar: “hoy en Marketing tienes…”

Si el user dice “muéstrame lo de marketing”, Gina interpreta departamento = Marketing dentro del corpus actual — no busca una empresa llamada Marketing.

---

## 4. Categorías (secciones del departamento)

### 4.1 Qué son

Las **categorías** son las **secciones / tipos de contenido** definidos **dentro** de un departamento.

Se crean como tags del departamento (con label + description opcional).

Ejemplo:

```
Departamento: Marketing
Categorías:
  - blogs
  - emails
  - social
  - landing pages
```

### 4.2 Cómo se traduce en significado

> Categoría **"blogs"** dentro del departamento **Marketing**  
> = todos los folders (y su contenido) cuya taxonomía es  
> **departamento = Marketing** + **categoría = blogs**.

No significa “todos los blogs del mundo”.  
Significa: **blogs del área Marketing de esta empresa**.

Misma palabra en otro departamento es otro bucket:

| Departamento | Categoría | Significa |
|---|---|---|
| Marketing | blogs | Blogs de marketing |
| Product | blogs | Blogs de producto (otro conjunto) |
| Marketing | emails | Emails de marketing |

Gina debe tratar `department + category` como un par compuesto, nunca la categoría sola.

---

## 5. Folders (cards del panel Documents)

### 5.1 Qué es un Folder

En la UI, el panel **Documents** muestra **folders** (cajas / cards).

- Folder = contenedor temático de trabajo
- Dentro viven los **documents** (files programables: schedule, status, body, to dos)
- El título del folder lo elige el usuario (libre)

Al crear un folder de contenido, el usuario puede (y suele) elegir:

1. **Department** ya creado  
2. **Category** ya insertada en ese departamento  
3. **Title** del folder (ej. “Trends”)

### 5.2 Ejemplo canónico: folder “Trends”

Flujo del usuario:

1. Tiene departamento **Marketing**
2. Dentro de Marketing ya insertó la categoría **blogs**
3. Crea un folder llamado **Trends**
4. Al crear, selecciona:
   - Department → Marketing  
   - Category → blogs  
   - Title → Trends

**Significado semántico:**

> El folder **Trends** es donde viven los **blogs de trends** del departamento **Marketing** de esta empresa.

Traducción para Gina:

```
Empresa actual
 └── Marketing (departamento)
      └── blogs (categoría / tipo de contenido)
           └── Trends (folder / proyecto temático)
                └── documents: posts, drafts, research notes…
```

No confundir:

| Cosa | No es |
|---|---|
| Folder “Trends” | No es el departamento |
| Categoría “blogs” | No es el título del folder |
| Document dentro de Trends | No es el folder; es una pieza de contenido |

### 5.3 Regla de lectura para Gina

Cuando el user diga cosas como:

- “abre el folder de trends de blogs de marketing”
- “¿qué blogs de trends tenemos?”
- “scope de marketing / blogs / trends”

Gina resuelve así:

1. Corpus = empresa activa  
2. Department = Marketing  
3. Category = blogs  
4. Folder title ≈ Trends  
5. Luego lista documents / to dos / schedule de ese folder

Si hay ambigüedad (dos folders “Trends”), pide aclaración por departamento o categoría — no inventes.

---

## 6. Documents dentro del folder (capa inferior)

Dentro de un folder viven los **documents** (antes “macronodos”):

- Unidades de contenido con título, body, status, schedule opcional
- Pueden tener To Dos compartidos (user + Gina)
- El timeline solo **visualiza** sus schedules; alarmas/notificaciones son de Gina

Jerarquía completa:

```
Empresa (Corpus + Brand + Description/megadata)
  └── Departamento
        └── Categoría
              └── Folder          ← card en panel Documents
                    └── Document  ← file en canvas / timeline / editor
                          └── To Dos / reminders
```

---

## 7. Vocabulario que Gina debe usar (y evitar)

| Decir | Evitar / no asumir |
|---|---|
| Empresa / corpus | “Workspace genérico” sin empresa |
| Brand | Confundir brand con título de un blog |
| Description de empresa = megadata | Tratarla como body de un document |
| Departamento | “Folder Marketing” si en realidad es department |
| Categoría (sección del depto) | “Categoría” = producto de campaña (otro modelo) |
| Folder / caja Documents | “Documento” para la card del sidebar |
| Document / file | “Folder” para el archivo abierto |

Terminología de producto (no romper):

- Panel **Documents** = lista de **folders**
- **Document** = unidad programable dentro del folder
- **Macronodo** (legado) = document

---

## 8. Cheatsheet rápido para Gina

```
¿Dónde estoy?
  → Empresa activa (corpus + brand + megadata)

¿De qué área?
  → Departamento (Marketing, Sales…)

¿Qué tipo de contenido?
  → Categoría del departamento (blogs, emails…)

¿En qué caja/proyecto?
  → Folder (Trends, Q3 Launch…)

¿En qué pieza concreta?
  → Document (con schedule / status / to dos)
```

**Ejemplo narrable:**

> “En **Voltway** (brand), departamento **Marketing**, categoría **blogs**,  
> el folder **Trends** es donde están los blogs de trends.  
> Hoy el document *AI search habits* tiene schedule 9–12 y 2 to dos abiertos.”

---

## 9. Scope de Gina respecto a esta estructura

Gina **sí** debe:

- Entender y narrar esta jerarquía
- Abrir el document correcto sin confundir folder ↔ document
- Filtrar mentalmente por empresa activa
- Usar megadata de empresa solo como contexto de marca

Gina **no** debe:

- Crear empresas, departamentos o categorías por su cuenta (salvo tool explícita futura aprobada)
- Reescribir description/megadata de la empresa
- Mezclar categorías entre departamentos
- Confundir título de folder con categoría o departamento
- Mutar folder schedule desde chat (ver brief de schedule)

---

## 10. Relación con otros briefs de Gina

| Doc | Cubre |
|---|---|
| `ESTRUCTURA_WEBAPP.md` (este) | Empresa → depto → categoría → folder → document |
| `BRIEF.md` | Rol de Gina, chat, tools, alarmas, to dos |
| `SCHEDULE_AND_STATUS.md` | Folder schedule, document schedule, statuses |

La estructura organizacional es el **mapa**.  
Schedule/status/to dos son la **dinámica temporal** sobre ese mapa.
