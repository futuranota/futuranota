# Gina Phase 1.5 - Data Visualization

**Para:** Cursor  
**Estado:** En implementación (pedido user 2026-08-02).  
**Objetivo:** Que Gina no solo hable, sino que MUESTRE datos de forma visual y organizada  
**Resultado:** Dashboard Assistant que se siente "real"

**Related:** Phase 1 listen/scope (live). Google Calendar integration = **más tarde** (después de 1.5).

---

## El Problema Actual

Gina solo devuelve texto:

```
"¡Hola! Tienes 6 documentos para hoy. 2 sin empezar, 
3 en progreso, 1 vencido. En Marketing tienes... 
En Design tienes... Etc."
```

- Difícil de procesar
- No se siente como asistente
- Puro texto sin organización

---

## La Solución

Gina devuelve **texto + datos visualizados**:

- Mensaje conversacional (Gina habla)
- Visualización organizada (datos bonitos)
- Se siente como dashboard assistant

---

## Cambio en API Gina Chat

### Response de Groq (NUEVO FORMAT)

```javascript
{
  "message": "¡Hola! Para hoy tienes bastante carga 📊",
  "visualization": {
    "type": "today_scope",
    "data": {
      "total": 6,
      "notStarted": 2,
      "inProgress": 3,
      "pastDue": 1,
      "documents": [
        { 
          title: "Blog Post", 
          status: "in_progress", 
          folder: "Trends",
          department: "Marketing",
          time: "8 AM - 3 PM" 
        },
        { 
          title: "Email", 
          status: "not_started", 
          folder: "Campaigns",
          department: "Marketing",
          time: "Flexible" 
        }
      ],
      "nextDeadline": {
        "document": "Blog Post",
        "time": "8 AM"
      }
    }
  }
}
```

**Nota de implementación (cuando se haga):** preferir que el **cliente/tools** construyan `visualization.data` de forma determinística y Groq solo narre `message` (+ elija `type`), para no inventar conteos. El brief de producto pide `{ message, visualization }` en la respuesta del chat.

---

## Tipos de Visualización

Groq (o el router de family) elige qué tipo retornar según la query:

| Tipo | Cuándo | Qué muestra |
|---|---|---|
| `today_scope` | "Qué tengo para hoy?" | Cards de hoy (total, breakdown, docs) |
| `incomplete` | "Qué no completé?" | Cards de incompletos (past due, upcoming, reserved) |
| `folder_summary` | "Cómo está Marketing?" | Summary card del folder (stats, docs, progress) |
| `conflicts` | "Hay conflictos?" | Conflictos listados (fecha, documentos, overlap) |
| `table` | "Dame detalle" | Tabla con documentos (title, status, time, folder) |
| `timeline` | "Qué horarios?" | Timeline visual (horas, documentos) |
| `null` | Preguntas sin datos | Solo texto, sin visual |

---

## En el Frontend (GinaChatOverlay)

### Cuando llega message con visualization:

```javascript
<GinaChatMessage>
  <GinaBubble message={msg.message} />
  {msg.visualization && (
    <GinaDataVisualization 
      type={msg.visualization.type}
      data={msg.visualization.data}
    />
  )}
</GinaChatMessage>
```

### Componente `<GinaDataVisualization>`

```javascript
function GinaDataVisualization({ type, data }) {
  switch(type) {
    case 'today_scope':
      return <TodayScopeVisualization data={data} />;
    case 'incomplete':
      return <IncompleteVisualization data={data} />;
    case 'folder_summary':
      return <FolderSummaryVisualization data={data} />;
    case 'conflicts':
      return <ConflictsVisualization data={data} />;
    case 'table':
      return <TableVisualization data={data} />;
    case 'timeline':
      return <TimelineVisualization data={data} />;
    default:
      return null;
  }
}
```

---

## Ejemplos Visuales (Cómo se ve)

### Example 1: "Gina, qué tengo para hoy?"

**Bubble Gina:** `"¡Hola! Para hoy tienes bastante carga 📊"`

**Visualization (`today_scope`):** card HOY con totales / sin empezar / en progreso / vencido + próximo deadline.

### Example 2: "Gina, qué no completé?"

**Bubble Gina:** `"Tienes 8 sin completar. Aquí está desglosado"`

**Visualization (`incomplete`):** bloques VENCIDOS / PRÓXIMOS / LARGO PLAZO.

### Example 3: "Cómo está Marketing?"

**Bubble Gina:** `"Marketing está 60% (3 de 5 completados)"`

**Visualization (`folder_summary`):** stats + barra de progreso + próximo vencimiento.

### Example 4: Table view

Tabla: Document | Department | Status | Folder | Time

---

## Referencias de Diseño

**NO inventar nuevo diseño. Reutilizar Futura Nota.**

1. **Status** — mismos colores/iconos que badges de la app (not started, in progress, completed, past due, reserved / submitted).
2. **Folder card** — spacing, shadow, radius, hover de cards existentes.
3. **Department** — iconos/labels que ya existan.
4. **Palette / typography** — tokens y tipografía actuales; surface base `#151515` donde aplique.
5. Reutilizar componentes bajo `/src/components/` en lugar de inventar un design system paralelo.

---

## Instrucción de Implementación (cuando se active)

1. Cambiar API Gina Chat → respuesta `{ message, visualization }`.
2. Crear `<GinaDataVisualization>` + subcomponents por tipo.
3. Reutilizar diseño existente (NO crear look nuevo).
4. Integrar en `GinaChatOverlay` / `GinaChatCard`: bubble + visual debajo.
5. Testear con preguntas reales de scope.

---

## Checklist

- [ ] Cambiar Groq/API response a `{ message, visualization }`
- [ ] Crear tipos de visualización (6 tipos + null)
- [ ] Crear `<GinaDataVisualization>`
- [ ] Crear sub-components por tipo
- [ ] Reutilizar diseño existente
- [ ] Integrar en GinaChatOverlay / GinaChatCard
- [ ] Testear con preguntas reales
- [ ] Verificar que se sienta como dashboard assistant

---

**Tiempo estimado:** 3–5 días  
**Resultado:** Gina visual = Dashboard Assistant profesional
