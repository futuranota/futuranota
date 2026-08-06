# Gina — Capability Roadmap (visión de producto)

**Status:** memoria de producto (acordado con user)  
**Fecha:** 2026-08-06  
**Regla Cursor:** `.cursor/rules/gina-capability-roadmap.mdc`

---

## Norte

El usuario tiene todo lo necesario para ser su propio asistente.  
**Gina** (Asistente) ayuda a **organizar, apuntar y recordar** — parte del equipo, no un editor de documentos ni un inventador de corpus.

---

## 1. Encontrar datos (básico)

- Encontrar documentos aunque el user no recuerde el nombre exacto.
- Con una explicación breve basta para desambiguar.
- Gina es **servicial**: ofrece abrir.
- Flujo ejemplo:
  1. “¿Qué tenemos para el documento que estaba trabajando ayer sobre xyz?”
  2. Gina confirma: “¿Te refieres al documento titulado 1234?”
  3. User sí/no → luego datos reales (To Do, notas, etc.).

**Live parcial:** find + reveal Documents + open por id.  
**Falta:** confirmación conversacional fuerte (“el de ayer sobre…”).

---

## 2. Borrar / no editar

| Gina puede | Gina no hace |
|---|---|
| Borrar documentos (con confirm explícita) | Editar el **body** del documento |
| Abrir, narrar, filtrar, insertar To Dos | Inventar files / categorías / conteos |

---

## 3. To Do del documento (idea principal)

- Al comenzar un doc, el user pone **title** y usa el área **To Do**.
- El To Do es para reminders / pasos que el user (o Gina por dictado) apunta **sobre ese documento**.
- **El To Do no tiene horarios.** El horario/goal de trabajo viene del schedule del documento (ej. goal de 4 horas).
- El user entra y sale del To Do, **tacha** pasos hasta completar el proyecto.

### Dictado → insertar To Do

User (en Call Asistente / chat): *“necesito agregar algo en el to do…”* + dictado.

Gina:
1. Escucha / interpreta.
2. Desglosa en reminders / to-dos.
3. Inserta en el To Do de **ese** documento.
4. Luego puede informar progreso: *tienes 1/3 completed; faltan 02 y 03; nota: […]*.

---

## 4. Ritual del día (“¿qué sigue?”)

Mañana / puesta al día:

1. Preguntas rápidas sobre varios docs / el de ayer.
2. Confirmación de identidad del doc.
3. Resumen To Do + notas.
4. “¿Qué sigue?” → próximo documento + estado honesto:
   - “0 notas, 0 datos, te falta trabajarlo todo”, o
   - “documento xyz con 5 to-dos y 1 overview — ¿quieres comenzar ahora?”

Alarmas **pocas**: preferencia **una al día** + las que el user pida explícitamente.  
No una alarma por cada bloque de cada documento.

Relacionado: Daily Report / turnos (`SHIFT_AND_DAILY_REPORT.md`) — el protagonista del día se desplaza hacia **To Do + qué sigue**, no solo sheet de horarios.

---

## 5. Google Calendar (después)

- Notificador **fuera** de Futura Nota.
- FN = source of truth del trabajo; GCal = espejo / reminders externos.
- Ejemplo: “Recuérdame mañana comenzar mi jornada a la misma hora que entras a trabajar, 10:30” → Gina inserta en GCal.
- El user no necesita push por cada arranque de bloque si ya está en modo trabajo con café y preguntando a Gina.

---

## 6. Google Drive / export (después)

- Coger un documento → transformarlo a otro formato → botón para pasarlo al Drive del user.
- Estilo MCP / integración; no priorizar antes de To Do + find + borrar.

---

## 7. URLs / tabla interna

- Por petición: informar datos de filas (días de cookies, comisión, etc.).
- Llenar listados de URLs por pedido y entregar datos de la tabla interna.
- Lectura (+ append controlado); no “editar body” del documento de trabajo.

---

## Orden de build (acordado)

1. **Find + confirm + abrir** — pulir ayer/xyz / “¿te refieres a…?”
2. **To Do del doc** — leer progreso + insertar por dictado (desglose)
3. **“¿qué sigue?”** del día — To Do + docs
4. **Borrar con confirm**
5. **URLs** — informar / listar
6. **GCal reminders** — pocas alarmas
7. **Export → Drive**

## Hard rules

- LIVE CORPUS ONLY.
- Mutaciones solo con confirmación explícita.
- To Do ≠ schedule del documento.
- Audio deferred (`gina-audio-deferred.mdc`).
- No saltar este orden salvo brief explícito del user.
