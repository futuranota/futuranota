# BRIEF FINAL: SISTEMA GINA COMPLETO

**Objetivo:** Implementar a Gina, asistente inteligente de Futura Nota que apunta reminders, gestiona tareas y notifica.

**Versión:** 2.2 - Scope hoy, open doc, conflictos soft, dual popover
**Status:** Ready for Implementation (product brief — adapt to repo stack)
**Brief stack (aspirational):** Next.js 14, React, TypeScript, Supabase, Claude Sonnet 4.6, Resend
**Repo real:** Vite + React JSX + Zustand + Supabase — map tables/components to existing docs/nodes/`lazy_todos`/Asistente card.

---

## PARTE 1: VISIÓN GENERAL

### Qué es Gina

Gina es un asistente **NOTIFICADOR INTELIGENTE** que:

✅ Lee documentos (obtiene contexto)
✅ Escucha lo que user pide (vía chat)
✅ Apunta reminders (en To Do section)
✅ Educa al user (sugiere cómo usar el tiempo)
✅ Notifica en el momento exacto (popup + contexto)
✅ Registra confirmaciones (ok gracias / ignored)

❌ NO ejecuta acciones
❌ NO escribe documentos
❌ NO toma decisiones por el usuario

---

## PARTE 2: FLUJO DE UN DÍA TÍPICO

### Escenario: User en documento "Blog Post" (8 AM - 3 PM, TODAY)

**PASO 1: User abre el documento**
```
Title: Blog Post
Schedule: 8:00 AM - 3:00 PM (TODAY)
Status: In Progress

User comienza a escribir, tomar notas, ideas, etc.
```

**PASO 2: User presiona [Call Asistente]**
```
Modal abre
Chat de Gina aparece
```

**PASO 3: Gina es PROACTIVA (lee el range)**
```
Gina: "Hey Mark, vi que hoy tienes de 8 AM a 3 PM
       para trabajar en Blog Post.
       Eso son 7 horas disponibles.

       ¿Qué tareas necesitas hacer en ese tiempo?"

[Gina leyó automáticamente:]
- document_id = blog_post
- date = TODAY
- start_time = 8:00 AM
- end_time = 3:00 PM
- duration = 7 hours
```

**PASO 4: User pide reminders**
```
User: "8 AM - empezar a escribir
       10 AM - revisar
       2 PM - convertir a PDF"
```

**PASO 5: Gina APUNTA en To Do**
```
Gina: "Perfecto, apuntado."

🔊 [Sonido: "Claro que sí"]

TO DO SECTION → REMINDER subsection:

📌 REMINDERS (3)
├─ 8:00 AM - Empezar a escribir
├─ 10:00 AM - Revisar
└─ 2:00 PM - Convertir a PDF

Status: 0/3 confirmados
```

**PASO 6: A las 8:00 AM - NOTIFICACIÓN**
```
[POPUP]

"Hey Mark, te estoy recordando que ahora
a las 8:00 AM tienes que EMPEZAR A ESCRIBIR.

Según lo que me dijiste:
'Necesito empezar el Blog Post hoy en la mañana'"

[OK, gracias] [Ignored]
```

**PASO 7: User presiona [OK, gracias]**
```
TO DO SECTION:

📌 REMINDERS (3)
├─ ✓ 8:00 AM - Empezar a escribir [DONE]
├─ ⏳ 10:00 AM - Revisar
└─ ⏳ 2:00 PM - Convertir a PDF

Status: 1/3 confirmados
```

**PASO 8: Próximas notificaciones**
```
10:00 AM → Popup similar
2:00 PM → Popup similar

User confirma o ignora cada una.
```

---

## PARTE 3: ARQUITECTURA DE BASE DE DATOS

### Tabla 1: `documents` (Ya existe, solo referencia)

```sql
id UUID
user_id UUID
company_id UUID
title TEXT
status ENUM ('in_progress', 'completed', 'submitted', 'in_review')
created_at TIMESTAMP
```

### Tabla 2: `document_schedule` (NUEVA en brief — en repo mapear a anchorAt/anchorFinishAt existentes antes de duplicar)

```sql
CREATE TABLE document_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  schedule_date DATE NOT NULL,
  schedule_start_time TIME NOT NULL,
  schedule_end_time TIME NOT NULL,
  duration_minutes INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (schedule_end_time - schedule_start_time))/60) STORED,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_document_schedule_user ON document_schedule(user_id, company_id);
CREATE INDEX idx_document_schedule_date ON document_schedule(schedule_date);
```

### Tabla 3: `gina_reminders` (NUEVA)

```sql
CREATE TABLE gina_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_schedule_id UUID REFERENCES document_schedule(id),

  reminder_time TIME NOT NULL,
  reminder_date DATE NOT NULL,
  reminder_task TEXT NOT NULL,

  user_context TEXT,
  document_context TEXT,

  notification_text_generated TEXT,

  gina_status ENUM (
    'pending',
    'confirmed',
    'ignored',
    'executing'
  ) DEFAULT 'pending',

  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP,
  user_action_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_gina_reminders_user ON gina_reminders(user_id, company_id);
CREATE INDEX idx_gina_reminders_date ON gina_reminders(reminder_date);
CREATE INDEX idx_gina_reminders_status ON gina_reminders(gina_status);
```

### Tabla 4: `gina_user_profile`

```sql
CREATE TABLE gina_user_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),

  sound_enabled BOOLEAN DEFAULT true,
  note_sound_volume INT DEFAULT 70,
  note_sound_type ENUM ('chime', 'bell', 'ping', 'tone') DEFAULT 'chime',

  notification_type ENUM ('popover', 'email', 'both') DEFAULT 'popover',
  notification_lead_time INT DEFAULT 15,

  require_confirmation BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Tabla 5: `assistants`

```sql
CREATE TABLE assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name TEXT NOT NULL DEFAULT 'Gina',
  avatar_emoji TEXT DEFAULT '💬',

  introduction_script TEXT,
  communication_style ENUM ('formal', 'casual', 'balanced') DEFAULT 'balanced',

  capabilities TEXT[] DEFAULT ARRAY[
    'read_documents',
    'capture_reminders',
    'schedule_tasks',
    'notify_user',
    'track_confirmations'
  ],

  is_active BOOLEAN DEFAULT true,
  setup_completed BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## PARTE 4: COMPONENTES REACT

### GinaChatModal

Location brief: `components/gina/GinaChatModal.tsx` → repo: JSX bajo Asistente / intel

Responsabilidades:
- Abrir cuando user presiona [Call Asistente]
- Chat conversacional
- Leer automáticamente document schedule (range)
- Primer mensaje educativo
- User escribe reminders → Gina apunta en To Do

### ReminderSection

Location brief: `components/todos/ReminderSection.tsx` → integrar en lazy To Do UI

Responsabilidades:
- Subsección REMINDER en To Do
- Status pending / confirmed / ignored
- Visual: ✓ DONE, ⏳ PENDING, ⚠️ IGNORED

### GinaNotificationPopup

Responsabilidades:
- Popup a la hora exacta
- Contexto + sonido
- [OK, gracias] [Ignored]
- Auto-close ~30s

---

## PARTE 5: FUNCIONES Y LÓGICA

- `getDocumentScheduleInfo(documentId)` — range del doc
- `generateGinaOpeningMessage(documentId)` — primer mensaje educativo
- `parseRemindersFromUserInput(userMessage)` — hora + tarea (Claude o parser)
- `saveRemindersToDatabase(documentId, reminders)`
- `playNoteSound(type)` — “Claro que sí” / got-it
- `generateNotificationText(reminder)`
- `sendNotification(reminder)` — popup si activo, email si inactivo
- `recordUserAction(reminderId, 'confirmed' | 'ignored')`

---

## PARTE 6: CRON / AUTOMÁTICO

Vercel Cron every 5 min: `/api/cron/send-gina-notifications`

Encontrar `gina_reminders` pending de hoy con `reminder_time <= NOW()` y `notification_sent` false → `sendNotification`.

---

## PARTE 7: INTEGRACIÓN CON TO DO SECTION

### Subsección 1: REMINDER (Gina)

```
📌 REMINDERS (3)
├─ ✓ 8:00 AM - Empezar a escribir [DONE]
├─ ⏳ 10:00 AM - Revisar [PENDING]
└─ ⏳ 2:00 PM - PDF [PENDING]

Status: 1/3 confirmados
```

### Subsección 2: TO DO (manual)

Listas manuales existentes — no confundir con reminders de Gina.

---

## PARTE 8: SETUP WIZARD

1. Nombre del asistente (default Gina)
2. Personalidad: formal / casual / balanced
3. Sonido de confirmación
4. Privacidad: siempre pedir confirmación
5. Listo

---

## PARTE 9: TOOLS

1. `get_document_schedule()`
2. `get_document_content()`
3. `save_reminders()`
4. `get_company_dna()`

---

## PARTE 10: INSTRUCCIONES PARA GINA

IDENTIDAD: Gina (o nombre configurado) — Asistente Futura Nota

COMPORTAMIENTO:
✅ Lee range del documento
✅ Pregunta educativa (no decide)
✅ Apunta reminders
✅ Notifica a la hora con contexto
✅ Registra confirmaciones

❌ No ejecuta acciones / no escribe docs / no auto-ejecuta

LÍMITES: fuera de scope → decirlo; ambigüedad → clarificar; error → informar

TONO: conversacional, educativo, honesto

---

## PARTE 11: CHECKLIST

**Database:** document_schedule (o mapear existente), gina_reminders, gina_user_profile, assistants + RLS

**UI:** GinaChatModal, ReminderSection, GinaNotificationPopup, DocumentEditor hook

**Logic:** schedule info, opening message, parse, save, sound, notify, record action

**Cron/API:** send notifications, confirm, ignore, create schedule

**Setup:** 5-step wizard + sounds in `/public/sounds/`

**Tests:** lee range, apunta, popup a tiempo, OK/Ignored, To Do update, sonido, contexto

---

## PARTE 12: NOTAS

- Privacidad: solo `user_id` actual
- Sonidos: `claro-que-si.mp3`, `got-it.mp3`
- Timezone del user para cron
- Prioridad: chat → popup → To Do visual claro

**Repo note:** Prefer existing document schedule fields and lazy To Do surfaces; do not invent parallel Next.js/TS trees. See `.cursor/rules/gina-assistant-system.mdc`.

---

## PARTE 13: ADDENDUM v2.1 — Modelo de producto afinado

### Tres capas de tiempo

```
FOLDER — schedule de 1–N días (ventana del proyecto)
  └─ DOC A hoy 8–17     → alarma start-file
  └─ DOC B hoy 19–22    → alarma start-file
  └─ DOC C mañana 9–17  → alarma start-file
        └─ To dos / reminders dentro del rango del doc
```

- Folder = cuándo pienso cerrar el proyecto.
- Document = bloque de trabajo del file + alarma natural “te toca este file”.
- Dentro del file = plan fino (to dos compartidos user + Gina).

Timeline = solo visualización. **Alarmas del timeline se retiran**; Gina es la única dueña de notificaciones.

### To Do compartido (sustituye REMINDERS vs TO DO separados)

Una sola lista tipo note taker:

- User y Gina escriben en la misma lista.
- OK en popup → Gina tacha (`checked`).
- Todos tachados → Gina: “Okay, ya hemos finalizado los to dos; si consideras haber terminado, recomiendo cambiar el status a Completed.” (user decide).

### Skip inteligente de alarma start-file

Si el user ya tiene abierto el mismo `doc_id` que la alarma de inicio → **omitir** start-file. Las alarmas de to dos internos del timeframe **siguen**.

### Chat scoped al doc + rango ya insertado

User: “para ese doc quiero hacer a, b, c” (doc con slot 2–3pm).  
Gina: “Ok — el horario disponible que insertaste es 2–3. ¿Qué quieres agregar / qué tienes en mente?”

---

## PARTE 14: ADDENDUM v2.1 — Opción B Tools / Function Calling

Arquitectura elegida: **caja de herramientas**. Gina decide qué tool invocar; backend ejecuta; Gina responde. Sin pre-detectar intención.

```
User → Claude+tools → invoca tool → backend (SQL/stores) → JSON → Gina responde
```

### Tools disponibles (contrato)

| Tool | Descripción |
|---|---|
| `get_today_tasks()` | Tareas/docs programados para hoy |
| `get_schedule(date)` | Agenda de una fecha |
| `get_conflicts()` | Solapes de horario (premium Asistente) |
| `search_documents(query)` | Buscar docs por keyword |
| `get_document_info(doc_id)` | Info del doc (título, schedule, status, to dos) |
| `create_todo(text)` | Apuntar item en el To Do compartido del doc |
| `get_document_schedule()` / `get_document_content()` | (legacy brief) mapear a info/schedule/content reales |
| `save_reminders()` | Preferir `create_todo` + hora en items del To Do compartido |

### Ejemplo

User: “Gina, ¿qué tengo hoy?”  
Gina invoca `get_today_tasks()` → backend →  
Gina: “Hoy tienes 2 tareas: Trends 9:00 (in progress), Moodboard 11:00…”

User: “busca XYZ” → Gina invoca `search_documents("XYZ")` sin router de intenciones.

### Implementación en este repo

- Tools leen `anchorAt`/`anchorFinishAt`, folder schedules, `lazy_todos`/to dos del doc, status — no inventar `gina_schedule_log` si se puede derivar.
- Ejecutores en backend/API o capa sync; Claude solo elige tool + params.
- Límites: tools de lectura + create/check todo; **no** tool que reescriba el body del doc ni force `completed`.

---

## PARTE 15: ADDENDUM v2.2 — Scope hoy, abrir doc, conflictos soft

### “¿Qué tenemos en el scope de hoy?”

1. Match `today()` → documentos con schedule hoy (`anchorAt` date = hoy).
2. Por cada doc, si ya hay to dos / reminders escritos, Gina los menciona en el **chat en texto** (no verbal).
3. Respuesta natural: lista de files + horas + status + preview de to dos internos.

Tools: `get_today_tasks()` (+ `get_document_info` / to dos por id según haga falta).

### “Ok, ábreme ese documento”

1. **Abrir el doc primero** — no interrumpir el open con un modal de conflicto.
2. Solo si (a) hay solape de schedule hour entre files y (b) el user no trae otra pregunta significativa de trabajo → soft comment **después** en el chat:

> “Mark, no quiero molestarte, pero insertaste un mismo schedule hour entre File A y File B. ¿Quieres mover las horas?”

3. Respuestas válidas:
   - **Sí** → flujo para ajustar horarios (Gina ayuda; user confirma cambios).
   - **No / déjame en paz / hagamoslo después / no me hables de esto** → dismiss inmediato; no insistir.

### Memoria de dismiss

- Guardar dismiss del par/solape (sesión o hasta que cambie alguno de los schedules).
- No reabrir el sermon en chat tras dismiss.
- A la hora de la alarma: **sí notificar** según lo programado (el dismiss solo evita re-preguntar en chat, no borra las alarmas).

### Si nunca movió las horas

- Pueden disparar **dos popovers a la vez** (uno por file en conflicto).
- Copy debe identificar cada documento (“Trends” vs “Moodboard”).
- Preferir apilados o secuenciales, no dos tapando el mismo punto.
- Si el user ya está dentro de uno de los docs → skip start-file de *ese*; el del otro puede sonar.

### Principio

Conflicto = **comentario opcional** (premium Asistente), nunca bloqueo ni decisión forzada. El schedule sigue siendo del user; Gina informa y respeta.
