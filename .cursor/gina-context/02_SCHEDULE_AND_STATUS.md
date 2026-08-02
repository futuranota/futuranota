# Schedule, reserva y statuses — handoff para Gina

**Para:** Gina (Asistente)  
**Propósito:** Entender cómo Futura Nota modela el tiempo y el estado del trabajo, para narrar scope, apuntar to-dos, notificar y sugerir sin romper reglas de producto.  
**Fecha:** 2026-08-01  

---

## 1. Vocabulario (no confundir)

| UI / usuario | Significa | Campos clave |
|---|---|---|
| **Documents** (sidebar) | Carpetas / folders (cajas) | doc con `scheduleStartAt` / `scheduleFinishAt` |
| **Folder / caja** | Categoría o proyecto (Math, Marketing, Social Media…) | ventana opcional de días |
| **Document / file** | Unidad de contenido dentro del folder (ex-macronodo) | `anchorAt` → `anchorFinishAt`, `status` |
| **Timeline** | Solo visualiza tiempo | **no** dueña de alarmas |
| **Gina** | Notifica, apunta to-dos, educa sobre tiempo | **sí** dueña de alarmas/popups |

Gina **no** escribe el body del documento ni fuerza status / horarios.

---

## 2. Tres capas de tiempo

```
Folder schedule     →  ventana de DÍAS     (scheduleStartAt → scheduleFinishAt)
Document schedule   →  bloque de HORAS     (anchorAt → anchorFinishAt)  → alarma start-file
To dos en el rango  →  plan fino           (misma lista user + Gina)
```

1. **Folder schedule = reserva (opcional)**  
   El usuario reserva un tramo de días para trabajar ese proyecto. Da organización, límite y orden. **No es obligatorio.**

2. **Document schedule = horario del file (opcional)**  
   Fecha + hora inicio + hora fin del documento. Puede existir con o sin reserva del folder (con reglas; ver §3).

3. **To dos**  
   Recordatorios / checklist dentro del doc. User y Gina escriben/tachan la misma lista.

La ocupación real del día se lee por el **horario del document**, no bloqueando el día entero del folder.

---

## 3. Qué significa “reserva”

### Folder con reserva

- Tiene `scheduleStartAt` y `scheduleFinishAt` (rango inclusivo de días).
- Ese rango es el **frame** del folder.
- Los folders pueden solaparse entre sí (mismo día OK).
- Misma Start = Finish (un solo día) es válido.
- **Nunca** inventar la reserva del folder a partir de la fecha de un document (`launchAt` / `anchorAt` no crean ventana de folder).

### Folder sin reserva

- Escritura libre: no hay frame de días.
- El picker de fecha/hora del document **está oculto**, salvo que el document tenga status **`reserved`** (escape hatch → calendario libre).

### Document `reserved` (status, no folder)

- Plan “lejos” / sin urgencia.
- Desbloquea date/time **fuera** del frame del folder (meses OK).
- Es el escape hatch cuando el file no cabe en la ventana del proyecto.
- Si más tarde la fecha del file **entra** en el frame del folder, aparecen todos los work statuses para que el user pueda salir de Reserved y empezar a trabajar.

### Reglas de picker (document)

| Folder tiene reserva? | Status del doc | Picker |
|---|---|---|
| No | distinto de `reserved` | Oculto |
| No | `reserved` | Calendario libre |
| Sí | distinto de `reserved` | Solo fechas dentro del frame; horas ocupadas tachadas (visual) |
| Sí | `reserved` | Calendario libre (fuera del frame OK) |

- Horas ocupadas = **solo visual** (strikethrough). El user puede elegirlas igual. Conflictos inteligentes = valor **premium de Gina**, no bloqueo del calendar base.
- Si la fecha elegida es **hoy**, los slots de hora ya pasados se deshabilitan (cuartos de hora).
- Guardar schedule del document **nunca** crea, amplía ni limpia el schedule del folder.

### Clear / cambio del folder schedule

- Al limpiar o cambiar Start/Finish del folder:
  - Hijos **no** `reserved` → se les borra date/time y `status` vuelve a `null`.
  - Hijos `reserved` → **mantienen** schedule y status.
- Gina **no** debe mutar el folder schedule.

---

## 4. Status del document (work status)

Campo: `node.status`  
Valores live: `null` | `not_started` | `reserved` | `in_progress` | `submitted` | `past_due` | `completed`  

`completed: boolean` se deriva (`true` solo si `status === "completed"`).  
Legacy `in_review` → se trata como `submitted`.

### Cuándo se muestran en el UI del file

| Condición | Opciones visibles |
|---|---|
| Fecha del doc **fuera** del frame del folder (o sin fecha/folder) | Solo **Reserved** |
| Fecha del doc **dentro** del frame (`anchorDate ∈ [Start, Finish]`) | **Todas**: Not started · Reserved · In progress · Submitted · Past due · Completed |

Toggle manual: **siempre permitido** cuando la opción está visible (incluso poner In progress con schedule futuro).

### Quién setea cada status

| Status | Auto | Manual | Notas para Gina |
|---|---|---|---|
| `null` | Default al crear | — | Sin schedule completo aún |
| `not_started` | Al **guardar** schedule completo (date + start + finish) con fecha **dentro del frame** y status vacío | Sí | “Programado, aún no arrancó” |
| `reserved` | — | Sí | Plan largo plazo / fuera del frame |
| `in_progress` | Solo si el user **escribe** el body **durante** la ventana horaria del doc (`now ∈ [anchorAt, anchorFinishAt]`) **y** status era `not_started` | Sí (cualquier momento) | Escribir **fuera** de la ventana **no** cambia status |
| `submitted` | — (hoy) | Sí | **Gina** debería setearlo al terminar un task / entrega para revisar (fase asistente) |
| `past_due` | Si estaba `in_progress` y el schedule del doc (en frame) ya pasó | Sí | No auto-convierte `reserved` / `submitted` / `completed` / `not_started` |
| `completed` | — | Sí (user cierra) | Gina puede **sugerir** Completed cuando todos los to-dos están tachados; el user decide |

### Flujo típico

```
Folder con reserva
  → user guarda date + start + finish del file (fecha en frame)
  → status = not_started
  → llega la hora y escribe → in_progress
  → (Gina / task listo) → submitted
  → user cierra → completed
```

Alternativa: `reserved` → (luego) `in_progress` → `completed`.

### Sin reserva de folder

- Solo tiene sentido mantener `reserved` (o `null`).
- Otros work statuses se **limpian** (sanitize): no deben quedar `not_started` / `in_progress` / etc. colgados sin frame.

---

## 5. Status del folder (heredado)

El folder **no** tiene status propio editable; se **calcula** desde los children:

1. Cualquier child `submitted` → folder **Submitted**
2. Cualquier child `reserved` → folder **Reserved**  
   (también: mientras haya reserved, el folder no debe “leerse” como Past due; persiste aunque se limpie el schedule del folder)
3. Cualquier child `past_due` → folder **Past due**
4. Cualquier child `in_progress` → folder **In progress**
5. Todos `completed` → folder **Completed**
6. Else → folder **Not started**  
   (hijos `not_started` **no** elevan el folder; caen en este default)

**Importante:** 4 completed + 1 reserved → folder **Reserved** (reserved bloquea Completed).

Visual: Not started del folder usa el mismo chip **pink** que los files.

---

## 6. Señales que Gina debe leer

### Scope de hoy

Docs cuyo schedule cae en `today()` (capa document: `anchorAt` / día del file), idealmente dentro del contexto del folder activo.

Narrar en **texto en el chat** (no verbal): título, horario, status, to-dos pendientes.

### Conflictos / solapes

- El calendar base **permite** solapes (tachado visual only).
- Detección y propuesta de reorganización = **premium Gina** (`get_conflicts`).
- Soft comment opcional al abrir un doc, nunca bloqueo.
- Si el user dismiss (“déjame en paz” / “después”) → no insistir en esa sesión / hasta que cambie el schedule.

### Alarmas (solo Gina; no timeline)

| Tipo | Omitir si ya está dentro de ese doc? |
|---|---|
| Start-file (inicio de `anchorAt`) | **Sí** |
| To do interno | **No** (por defecto) |

Si dos files comparten la misma hora y el user no movió nada → pueden sonar **dos** popovers (uno por file), copy con el nombre de cada doc. Preferir apilados/secuenciales.

### Status — qué puede hacer Gina

✅ Leer status y narrarlo  
✅ Sugerir `submitted` al cerrar un task (cuando esa fase esté wired)  
✅ Sugerir `completed` si todos los to-dos están tachados  
❌ Forzar status sin consentimiento del user  
❌ Mutar folder schedule  
❌ Escribir body del documento  

---

## 7. Campos de datos (referencia rápida)

### Folder (doc)

- `scheduleStartAt` / `scheduleFinishAt` — reserva de días (ISO). Vacío = sin reserva.
- Campaign folders usan Launch (`campaignActive`, etc.) — **no** es la misma reserva de trabajo; no mezclar.

### Document (node)

- `anchorAt` / `anchorFinishAt` — inicio/fin del bloque horario.
- `status` — work status (lista §4).
- `completed` — derivado de `status === "completed"`.
- `parentDocId` — folder contenedor.

Helpers de producto (código): `docWorkStatus.js`, `folderScheduleReservation.js`, `folderStatus.js`, `docPastDueTransition.js`.

---

## 8. Lo que Gina NO debe asumir

- Que todo document tenga horario.
- Que el folder siempre tenga reserva.
- Que escribir = automáticamente In progress (solo dentro de la ventana y desde `not_started`).
- Que Past due aplique a Reserved / Not started / Submitted / Completed.
- Que solape de horas = error bloqueante.
- Que el timeline dispare alarmas.
- Que “Documents” en el sidebar sean files (son folders).

---

## 9. Mini glosario de copy

| EN | ES (UI) | Uso |
|---|---|---|
| Not started | Sin empezar | Programado / heredado vacío |
| Reserved | Reservado | Plan largo / fuera de frame |
| In progress | In progress / En curso | Trabajo activo |
| Submitted | Submitted | Entrega para revisar |
| Past due | Vencido / Past due | Se pasó la ventana estando in progress |
| Completed | Completed | User cerró el trabajo |

---

## 10. Relación con el brief Gina v2.2

Este documento detalla **schedule + status** para que las tools y el chat tengan señales correctas:

- `get_today_tasks` / `get_schedule` → leer capas folder + document  
- `get_conflicts` → premium, soft, dismissible  
- `get_document_info` → incluir `status`, `anchorAt`/`anchorFinishAt`, parent folder frame  
- `create_todo` → misma lista; al tachar todo → sugerir Completed  

Full brief de comportamiento de Gina: `BRIEF.md` (mismo folder).  
Roadmap de status en producto: `.cursor/rules/assistant-status-roadmap.mdc`.  
Modelo de timeline: `.cursor/rules/timeline-product-model.mdc`.
