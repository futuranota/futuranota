---
name: visual-intent-brief
description: >
  Interpreta instrucciones visuales breves (sin mockup ni especificación detallada), infiere el
  resultado deseado, implementa la UI y escribe copy alineado al mismo tono y jerarquía visual.
  Úsalo cuando el usuario dé pistas cortas sobre cómo debe verse o sentirse algo: "más premium",
  "que venda", "más limpio", "urgente", "menos ruido", "hero más contundente", "card más confiable",
  "CTA que convierta", "minimalista pero cálido", o cuando pida cambios visuales + texto en la
  misma petición sin explicar layout, colores ni copy palabra por palabra. Complementa
  ui-element-redesigner (ese skill requiere imagen; este no).
---

# Visual Intent Brief

El usuario no quiere redactar un brief de diseño ni un manifiesto de copy.
Da una instrucción corta. Tú expandes la intención visual **por dentro**, implementas, y el **texto debe sonar como se ve**.

## Cuándo usar este skill

- Instrucción visual escueta sobre un componente, sección o pantalla
- Petición mezclada de look + mensaje sin detallar ninguno de los dos
- Iteración rápida: "hazlo más X" sin mockup
- El usuario prefiere ver el resultado antes que debatir especificaciones

**No uses este skill** si el usuario comparte imagen de referencia → usa `ui-element-redesigner`.
**No uses este skill** si solo pide reescribir copy sin cambio visual → usa `page-copy-writer`.

---

## Regla central

**Una sola intención → una sola expresión visual + verbal.**

| Intención implícita | UI tiende a… | Copy tiende a… |
|---------------------|--------------|----------------|
| Premium / confianza | Más aire, menos elementos, tipografía sobria, contraste suave | Frases cortas, claims concretos, sin exclamaciones ni hype |
| Urgente / acción | CTA dominante, color de acción visible, densidad media-alta | Verbos imperativos, beneficio inmediato, plazos o escasez solo si encaja |
| Limpio / minimal | Jerarquía clara, 1 acción principal, neutros | Una idea por bloque, sin adjetivos de relleno |
| Cálido / cercano | Bordes suaves, tonos cálidos del sistema, iconografía humana | Tú/vos, lenguaje conversacional, promesas humanas |
| Técnico / pro | Grid ordenado, labels precisos, datos visibles | Terminología exacta, números, sin marketing vacío |
| Emocional / aspiracional | Imagen o color protagonista, headline grande | Storytelling breve, metáforas controladas, ritmo más largo en headline |

Si la instrucción contradice el sistema de diseño del proyecto, prioriza coherencia del producto y adapta la intención sin romper tokens ni patrones existentes.

---

## Flujo de trabajo

### 1. Extraer intención (silencioso)

De la frase del usuario, resuelve en tu cabeza — no pidas un cuestionario largo:

1. **Qué** — componente, sección o pantalla (lee código/contexto si hace falta)
2. **Para quién** — inferir audiencia del producto si no la dice
3. **Sensación** — premium, urgente, limpio, cálido, etc.
4. **Acción deseada** — mirar, clicar, comprar, confiar, entender
5. **Qué NO tocar** — respeta alcance mínimo del diff

Solo pregunta si falta algo **bloqueante** (¿qué componente? ¿qué pantalla?). Máximo 1 pregunta concreta.

### 2. Expandir visualmente (interno)

Antes de codear, fija mentalmente:

- Jerarquía: qué gana peso (título, CTA, dato, imagen)
- Densidad: más aire vs más información
- Tono cromático: neutro, acción, semántico (éxito, alerta)
- Estados: hover/focus/mobile si el componente es interactivo

No entregues al usuario un ensayo de diseño salvo que lo pida.

### 3. Escribir copy alineado

El copy **no es independiente** del layout:

- **Headline** = lo que ocupa más peso visual
- **Subtítulo / body** = lo que respira debajo; misma densidad que el espaciado
- **CTA** = verbo acorde al peso del botón (primario fuerte → verbo directo; secundario → explorar/saber más)
- **Microcopy** (labels, hints, badges) = mismo registro que el bloque padre

Evita copy genérico que contradiga la UI ("Descubre más" en un bloque urgente; párrafos largos en un chip compacto).

Idioma: el del producto/pantalla actual salvo que el usuario pida otro.

### 4. Implementar

- Lee el componente y estilos existentes antes de editar
- Stack del proyecto: React + CSS variables; sin Tailwind salvo que ya exista
- Cambio mínimo que cumpla la intención
- UI + copy en el mismo diff

### 5. Responder al usuario (breve)

Formato fijo — pocas líneas:

```
**Interpreté:** [1 línea — sensación + objetivo]
**Hice:** [2–4 bullets — cambios visuales + copy, sin tecnicismos]
```

Luego código o cambios aplicados. Sin párrafos de justificación UX salvo riesgo real (accesibilidad, contraste, inconsistencia grave).

---

## Ejemplos

**Input:** "El hero se siente barato, que venda más"

**Interpretación interna:** más premium + CTA claro + claim específico; menos ruido visual.

**Output al usuario:**
```
**Interpreté:** Hero más confiable y orientado a conversión, menos ruido.
**Hice:**
- Más aire y headline más grande
- Subtítulo con beneficio concreto, sin adjetivos vacíos
- CTA primario con verbo de acción directo
```

**Input:** "Card de pricing más urgente pero sin gritar"

**Interpretación:** énfasis en plan recomendado + CTA visible; copy corto; sin rojo agresivo ni MAYÚSCULAS.

**Input:** "Menos texto, más premium en la oferta"

**Interpretación:** recortar copy, subir jerarquía tipográfica, un solo mensaje por bloque.

---

## Anti-patterns

- Pedir mockup, moodboard o 10 preguntas cuando la instrucción ya es accionable
- Entregar solo CSS sin revisar headlines/CTAs
- Entregar solo copy sin tocar jerarquía visual cuando la petición es visual
- Copy hype en UI minimalista (o al revés)
- Explicar al usuario teoría de diseño que no pidió
- Ignorar variables CSS y patrones del proyecto

---

## Relación con otros skills

| Situación | Skill |
|-----------|-------|
| Imagen + cambios concretos | `ui-element-redesigner` |
| Solo mejorar texto de venta | `page-copy-writer` |
| Instrucción corta, sin imagen, UI + copy | **este skill** |
