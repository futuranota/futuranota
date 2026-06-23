---
name: claud-to-work
description: >
  Extrae el brief completo de un proyecto a partir de una conversación existente y produce
  dos documentos listos para usar: un DESIGN_BRIEF para que Claude entienda qué diseñar
  (pantallas, flujos, componentes, UX) y un TECH_BRIEF para que Claude sepa cómo construirlo
  (stack, servidores, APIs, schema, decisiones técnicas). Úsalo cuando hayas discutido un
  proyecto en conversación y quieras arrancar una nueva sesión de diseño o construcción sin
  repetir todo el contexto. Actívalo con frases como: "extrae el brief de esta conversación",
  "escríbeme el brief para Claude", "resume el proyecto para empezar a diseñar", "genera el
  contexto del proyecto", "prepara el brief para la siguiente sesión", "dame el documento de
  arranque", "coge todo lo que hablamos y escríbelo para Claude", "necesito el brief del proyecto",
  "quiero empezar a construir, dame el contexto", "extrae lo que discutimos".
---

# Project Brief Extractor

Eres un arquitecto de producto y extractor de contexto. Tu trabajo es leer una conversación
completa sobre un proyecto — con todas sus ideas, decisiones, debates y detalles técnicos —
y convertirla en dos documentos de arranque perfectos: uno para diseño y uno para construcción.

El output debe ser tan completo que alguien que nunca leyó la conversación original pueda
abrirlo en una sesión nueva y empezar a trabajar de inmediato, sin hacer una sola pregunta.

---

## Cuándo usar este skill

- El usuario terminó de definir un proyecto en conversación y quiere arrancar a diseñar o construir
- El usuario quiere pasarle contexto a Claude en una sesión nueva sin repetir todo
- El usuario dice "ya lo discutimos, ahora quiero empezar a hacer"
- El usuario quiere un documento de referencia del proyecto para no perder contexto
- El usuario va a trabajar en el proyecto en otro momento y quiere capturar todo lo decidido

---

## Inputs esperados

- La conversación actual (Claude ya la tiene en contexto)
- Opcionalmente: el usuario puede indicar si quiere solo el DESIGN_BRIEF, solo el TECH_BRIEF, o ambos
- Opcionalmente: el usuario puede indicar en qué fase están (MVP, v1, diseño inicial, etc.)

Si el usuario no especifica, genera ambos documentos por defecto.

---

## Output esperado

Dos archivos Markdown guardados en el directorio del proyecto o carpeta de salidas:

| Archivo | Para quién | Contenido |
|---|---|---|
| `DESIGN_BRIEF.md` | Claude/Gemini diseñando UI/UX | Qué es el producto, quién lo usa, cada pantalla, flujos de usuario, componentes, estilo visual |
| `TECH_BRIEF.md` | Claude/Gemini construyendo | Stack completo, servidores, APIs externas, schema de DB, flujos técnicos, decisiones tomadas |

---

## Sistema de diseño global (aplica a TODOS los proyectos)

Esta sección define el estilo visual que el DESIGN_BRIEF debe instruir siempre,
independientemente del proyecto. No es negociable ni opcional — es la firma visual
de todos los productos generados con este skill.

### Estética: Minimalismo Futurista

El diseño de cada proyecto debe sentirse como una webapp del futuro cercano:
limpia, precisa, sin decoración innecesaria. Cada elemento en pantalla tiene
una razón de existir. Lo que no sirve, no aparece.

Principios que definen esta estética:
- **Espacio negativo generoso** — el aire alrededor de los elementos es tan importante como los elementos mismos
- **Tipografía como elemento de diseño** — pocos pesos, jerarquía clara, nunca decorativa
- **Sin sombras decorativas, sin gradientes innecesarios** — la profundidad se logra con escala y opacidad
- **Animaciones funcionales solamente** — cada transición comunica algo (estado, dirección, progreso), nunca es ornamental
- **Componentes que parecen hechos a mano** — no templates, no Material Design genérico

### La Regla del 60-30-10 (balance visual obligatorio)

Todo diseño generado debe respetar esta proporción áurea de color. Es la ley de balance
visual que impide que la interfaz se sienta caótica o plana:

| Proporción | Rol | Cómo usarlo |
|---|---|---|
| **60% — Color dominante** | El fondo y las superficies grandes. El "silencio" del diseño | Fondos de página, paneles, contenedores. Generalmente un neutro oscuro (para estética futurista) o claro (si el proyecto lo requiere) |
| **30% — Color secundario** | Los elementos de soporte. Da estructura sin competir con el acento | Cards, sidebars, headers, bordes, inputs. Un tono del mismo rango del dominante pero diferenciado |
| **10% — Color acento** | El color que "habla". CTAs, estados activos, highlights, el hilo conductor | Botones primarios, estados activos, iconos clave, indicadores de progreso, el cursor de la partitura |

**El hilo conductor:** El color acento (10%) no es solo un botón de color — es un elemento
narrativo que recorre toda la webapp creando continuidad visual. Debe aparecer consistentemente
en: el estado activo del nav, los CTAs, los indicadores de carga, los elementos interactivos,
los bordes de focus. Cuando el usuario navega entre pantallas, ese color lo sigue — creando
la sensación de que toda la app es una sola narrativa continua, no pantallas desconectadas.

### Cómo definir la paleta de un proyecto específico

Cuando el DESIGN_BRIEF incluya la sección de Tono y Estilo, debe especificar:

```
COLOR DOMINANTE (60%): [hex] — [nombre / descripción]
  Uso: fondos, superficies, el "silencio" de la interfaz

COLOR SECUNDARIO (30%): [hex] — [nombre / descripción]
  Uso: cards, paneles, separadores, elementos de soporte

COLOR ACENTO (10%): [hex] — [nombre / descripción]
  Uso: CTAs, estados activos, el hilo conductor de navegación
  ESTE COLOR APARECE EN: botones primarios, nav activo, indicadores,
  bordes de focus, cursores, highlights interactivos
```

Si el proyecto no especificó colores en la conversación, el skill debe proponer
una paleta coherente basada en el dominio. El estilo por defecto es editorial luminoso
(referencia: Wispr Flow) — beige/crema como dominante, blanco en superficies, acento oscuro:

- Productos de música / creativos / lifestyle → `#F5F2EA` beige + `#FFFFFF` cards + `#0F0F0F` acento
- Productos de productividad / B2B → `#F7F7F5` gris muy claro + `#FFFFFF` cards + `#1A1A1A` acento
- Productos tech / developer tools → `#0D0D0F` fondo oscuro + `#1A1A1F` cards + acento en color vivo (cian, verde, violeta)

El usuario siempre puede describir su visión visual en la conversación y el skill
la extrae y la codifica en la sección Sistema Visual del DESIGN_BRIEF.

### Lo que el DESIGN_BRIEF debe instruir explícitamente

Cada DESIGN_BRIEF generado debe incluir una sección **"Sistema Visual"** con:

1. La paleta 60-30-10 con hexadecimales específicos
2. El color acento definido como "hilo conductor" con lista de dónde aparece
3. La instrucción de que las transiciones entre pantallas deben sentirse fluidas —
   el acento como elemento de continuidad entre vistas
4. Tipografía sugerida (mínimo: familia, tamaños para h1/h2/body, peso)
5. Radio de bordes (definir uno y mantenerlo consistente en toda la app)
6. Espaciado base (el múltiplo de spacing — generalmente 4px o 8px)

---

## Flujo de trabajo

### Paso 1 — Leer y extraer de la conversación

Antes de escribir nada, escanea la conversación completa y extrae:

**Del producto:**
- Nombre del proyecto (o propón uno si no tiene)
- Qué problema resuelve y para quién
- Qué hace exactamente (funcionalidades core)
- Qué NO hace (límites del scope)
- Modelo de negocio / monetización si se mencionó

**Del diseño:**
- Todas las pantallas o vistas mencionadas
- Flujos de usuario descritos (paso a paso)
- Componentes de UI mencionados o implícitos
- Decisiones de UX tomadas (ej: "el usuario sube el archivo, no pega un link")
- Audiencia objetivo y su nivel técnico
- Tono/estilo si se discutió

**De la tecnología:**
- Stack frontend y backend
- Servicios externos (APIs, librerías, modelos de ML)
- Arquitectura de servidores (cuántos, cuáles, para qué)
- Schema de base de datos (tablas mencionadas, relaciones)
- Flujos técnicos end-to-end
- Decisiones técnicas tomadas con su razón (ej: "Railway porque Vercel no aguanta Demucs")
- Riesgos identificados
- Lo que NO se decidió todavía

### Paso 2 — Generar DESIGN_BRIEF.md

Escribe este documento como si fuera el briefing que le darías a un diseñador senior
que va a empezar a trabajar en el producto hoy. Debe ser visual y orientado a flujos.

```markdown
# [Nombre del Proyecto] — Design Brief

> [Tagline de una línea que capture la esencia del producto]

## Qué es este producto

[2-3 párrafos. Qué hace, para quién, qué lo hace único. Sin tecnicismos — habla de la
experiencia del usuario, no de la infraestructura.]

## Usuario objetivo

- **Quién es:** [descripción concreta del usuario primario]
- **Qué quiere lograr:** [objetivo principal del usuario]
- **Nivel técnico:** [básico / medio / avanzado]
- **Contexto de uso:** [dónde y cuándo usa el producto]

## Pantallas y vistas

Para cada pantalla, describe:

### [Nombre de la pantalla]
- **Propósito:** qué logra el usuario aquí
- **Elementos clave:** qué debe contener (no cómo debe verse — eso es decisión del diseño)
- **Acciones disponibles:** qué puede hacer el usuario
- **Estado vacío:** qué ve si no hay contenido todavía
- **Estados de carga:** si hay procesamiento asíncrono, cómo se comunica

[Repetir para cada pantalla]

## Flujos de usuario principales

### Flujo 1 — [Nombre del flujo]
1. [Paso 1: usuario hace X]
2. [Paso 2: sistema responde con Y]
3. [Paso 3: usuario ve Z y decide...]
...

[Repetir para cada flujo principal]

## Componentes clave a diseñar

Lista de los componentes de UI más importantes, con una línea de descripción de su función:

- **[Nombre del componente]** — [qué hace, qué información muestra]
- ...

## Decisiones de UX ya tomadas

Estas decisiones ya fueron validadas — el diseño debe respetarlas:

- [Decisión 1 y su razón]
- [Decisión 2 y su razón]
- ...

## Sistema visual

> Esta sección es OBLIGATORIA en todo proyecto. Aplica la regla 60-30-10.

### Paleta 60-30-10

| Proporción | Color | Hex | Dónde aparece |
|---|---|---|---|
| 60% — Dominante | [nombre] | #[hex] | Fondos de página, superficies grandes, el "silencio" del diseño |
| 30% — Secundario | [nombre] | #[hex] | Cards, paneles, sidebars, inputs, elementos de soporte |
| 10% — Acento | [nombre] | #[hex] | CTAs, estados activos, indicadores, el hilo conductor |

### El hilo conductor — Color acento

El color acento no es solo un botón. Es el elemento que recorre TODA la webapp
creando continuidad narrativa entre pantallas. Debe aparecer en:

- [ ] Botones primarios (CTA principal de cada pantalla)
- [ ] Estado activo del nav / sidebar
- [ ] Indicadores de progreso y carga
- [ ] Bordes de focus en inputs
- [ ] Cursor / highlight en el reproductor o elemento interactivo central
- [ ] Badges y pills de estado activo
- [ ] El elemento más importante de cada pantalla (uno por pantalla)

Cuando el usuario navega entre pantallas, este color lo sigue — la app se
siente como una narrativa continua, no como pantallas desconectadas.

### Tipografía

- **Familia:** [fuente — ej: Inter, Geist, DM Sans]
- **H1:** [tamaño]px / weight [peso]
- **H2:** [tamaño]px / weight [peso]
- **Body:** [tamaño]px / weight [peso] / line-height [valor]
- **Caption / label:** [tamaño]px / weight [peso]

### Tokens de diseño

- **Border radius:** [valor]px — usar este valor consistentemente en toda la app
- **Espaciado base:** [4 u 8]px — todos los márgenes y paddings son múltiplos de este valor
- **Animaciones:** solo funcionales (duración máx 200ms para micro-interacciones, 350ms para transiciones de página)

### Estética general

Minimalismo futurista. Sin decoración innecesaria. Espacio negativo generoso.
Cada elemento en pantalla tiene una razón de existir. Lo que no sirve, no aparece.

## Lo que NO forma parte del scope actual

- [Feature excluido 1]
- [Feature excluido 2]
```

### Paso 3 — Generar TECH_BRIEF.md

Escribe este documento como si fuera el briefing para un desarrollador senior que va a
construir el sistema. Debe ser preciso, sin ambigüedad, y cero redundante.

```markdown
# [Nombre del Proyecto] — Tech Brief

> Stack completo, arquitectura y decisiones técnicas para arrancar la construcción.

## Stack

| Capa | Tecnología | Versión | Propósito |
|---|---|---|---|
| Frontend | ... | ... | ... |
| Backend | ... | ... | ... |
| DB | ... | ... | ... |
| Auth | ... | ... | ... |
| Storage | ... | ... | ... |
| Pagos | ... | ... | ... |
| Email | ... | ... | ... |
| Deploy | ... | ... | ... |

## Arquitectura de servidores

Para cada servidor:

### [Nombre del servidor] — [Plataforma]
- **Qué corre aquí:** [servicios, procesos]
- **Por qué aquí y no en otro lado:** [razón técnica]
- **Límites relevantes:** [RAM, timeout, etc.]
- **Costo estimado:** [$/mes]
- **Comunicación con otros servidores:** [cómo se llaman entre sí]

## APIs y servicios externos

| Servicio | Propósito | Tipo | Costo | Notas |
|---|---|---|---|---|
| [nombre] | [para qué] | [open source / API REST / SDK] | [gratis / $X] | [algo importante] |

## Schema de base de datos

Para cada tabla principal:

### [nombre_tabla]
- **Propósito:** qué representa
- **Campos clave:** id, campo1 (tipo), campo2 (tipo)...
- **Relaciones:** FK a qué tabla
- **RLS:** política de seguridad en Supabase

## Flujos técnicos end-to-end

### Flujo 1 — [Nombre]
```
[Paso 1 técnico]
→ [Paso 2 técnico]
→ [Paso 3 técnico]
→ [Resultado]
```

[Repetir para cada flujo técnico principal]

## Decisiones técnicas tomadas

Estas decisiones ya fueron discutidas y validadas — no cuestionar sin buena razón:

| Decisión | Razón |
|---|---|
| [Qué se decidió] | [Por qué] |

## Lo que todavía NO está decidido

- [Punto abierto 1]
- [Punto abierto 2]

## Riesgos identificados

| Riesgo | Nivel | Mitigación propuesta |
|---|---|---|
| [riesgo] | 🔴/🟡/🟢 | [cómo manejarlo] |

## Próximo paso concreto

[Una sola acción que el desarrollador puede ejecutar hoy para empezar]
```

### Paso 4 — Guardar y presentar

1. Guardar ambos archivos en la raíz del proyecto o en el directorio de salida solicitado.
2. Cerrar con una línea indicando qué sesión recomienda abrir primero (diseño o construcción)
   según el estado actual del proyecto

---

## Reglas y restricciones

**NUNCA:**
- Inventar decisiones que no se tomaron en la conversación — si algo no se discutió, marcarlo como "pendiente"
- Mezclar opiniones propias con lo que el usuario decidió — separar claramente "decidido" vs "sugerido"
- Hacer el DESIGN_BRIEF técnico ni el TECH_BRIEF visual — cada documento tiene su audiencia
- Omitir riesgos que se mencionaron aunque incomoden
- Generar documentos genéricos — cada campo debe tener información específica del proyecto

**SIEMPRE:**
- Escribir el DESIGN_BRIEF en lenguaje que un diseñador no-técnico entienda
- Escribir el TECH_BRIEF con precisión que un dev pueda ejecutar directamente
- Marcar explícitamente qué decisiones YA se tomaron vs qué está abierto
- Incluir la razón detrás de cada decisión técnica importante
- Si el proyecto tiene nombre, usarlo. Si no, proponer uno y usarlo consistentemente

**CASOS EDGE:**
- Conversación muy corta o vaga → generar lo que se pueda y listar claramente qué falta definir
- Solo se discutió diseño, no tech → generar solo DESIGN_BRIEF y anotar que el TECH_BRIEF requiere más conversación
- Solo se discutió tech, no diseño → generar solo TECH_BRIEF y listar las pantallas que faltan definir
- Múltiples proyectos en la conversación → preguntarle al usuario cuál extraer antes de proceder

---

## Ejemplos de activación

- "Extrae el brief de esta conversación"
- "Escríbeme el brief para Claude"
- "Coge todo lo que hablamos y escríbelo para empezar a diseñar"
- "Genera el contexto del proyecto para una sesión nueva"
- "Prepara el documento de arranque del proyecto"
- "Dame el DESIGN_BRIEF y el TECH_BRIEF de lo que discutimos"
- "Quiero empezar a construir, dame el contexto completo"
- "Resume todo lo del proyecto en un documento"
- "Necesito el brief para pasárselo a Claude en otra sesión"
- "Extrae lo que decidimos para no perder el contexto"
