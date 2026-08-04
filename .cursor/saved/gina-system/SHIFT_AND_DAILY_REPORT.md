# Gina — Shift UX + Daily Report

**Status:** Product memory (2026-08-03). Not implementing the shift clock yet.  
**Rule:** `.cursor/rules/gina-shift-daily-report.mdc`  
**Stack:** Same Gina (Assistance listen/scope + Phase 1.5 viz). Two agent cards = skins only.

---

## Why this exists

Futura Nota treats assistants as **labor-shift workers**, not 24/7 bots. Landing/onboarding will later let the user pick weekdays + hours (coverage story, CTA “hoy por $20”). Runtime v1 keeps **one brain (Gina)** and **two visual agent cards**.

---

## Agent UX (v1)

| Piece | Role |
|---|---|
| Agent card A / B | Visual identity in **Asistentes**; skin may follow weekday |
| Active window | User picks ≤ **8 hours** inside the day’s 24h clock |
| Coverage | **One active agent per calendar day** (simplest verify model) |
| Same day, second “face” | Soft availability only if Daily Report already `verified` |

Two agents on different hours the **same** day can come later. For now: one opener of the day owns verify.

---

## Verify = shift entry ritual

- **Not** a user saying “I started my day”.
- When the active agent’s shift starts (or when the user opens the **dashboard** and the shift is already underway), Gina runs **one verification per calendar day**.
- Output artifact: **Daily Report** with status `pending` → `ready` / `verified`.
- If today is already `verified` (earlier turn or prior open): toast/soft popover only — no new report.

### Notifications (in-app v1)

Example cadence when generating a fresh report:

| When | Copy |
|---|---|
| Shift edge | `⏰ El asistente {name} comenzó su turno laboral` |
| Verify phase | `⏰ … está verificando el reporte del día` |
| Ready | `⏰ … ya tiene el reporte del día` |

If the user opens the dashboard **after** the shift started, show the **queued / missed** notifications for that day (same events, already timestamped). No native push required for v1.

If already `verified`:

> Buenos días {user}, me notificaron que ya tienes todo listo en tu Workspace. Si quieres revisar un documento o verificar algo en específico, no dudes en contactarme.

---

## Daily Report — fixed order

Always **today** scope.

### A. Past due / broken commitments (highest priority)

- Documents whose schedule day/time has passed and work status is not a success close (`completed`; treat `submitted` per product rules).
- Include forgotten starts: `not_started` / `in_progress` past `anchorAt` / `anchorFinishAt` (broader than auto-`past_due` alone).
- Sort: **oldest → newest**, gray list.
- Chat: open doc, change status from screen when we wire actions.
- Gina **always doubts** — inform, listen, offer choices; never assume “done” or delete.

### B. Schedule conflicts (skippable)

- Overlaps for today; strikethrough / semi-struck table.
- Educate: Gina owns occupation awareness (premium); user can ask for free slots.
- User may **Skip** → jump to today-only schedules.

### C. Today by department

- Group by department; order docs by time nearest to **now**.
- Narrate **one** lead department; other departments = visual cards only.
- User chooses: follow order vs focus a department → then Depto / Categoría / Folder → “¿abro este documento?”.

### D. General questions (after / beside report)

- Near-complete folders by %, counts by dept/status, “what starts the day?”, soft mention of near-miss next slot, open-from-chat.

---

## Manual report first (build gate)

Before any shift scheduler:

1. Polish Gina **copy** + **infographic UI** (Phase 1.5).
2. **Text choice chips** under bubbles (fixed next steps).
3. Test **“horarios de hoy”** → real today schedule list + viz.
4. **Manual Daily Report** walkthrough (user/admin triggers the ordered pipeline and inspects data/order).
5. Only then: shift clock, notification queue, `verified` flag, onboarding two-agent picker, landing CTA.

Verification for the report should be **deterministic tools** (past due, today scope, conflicts); LLM narrates. No multi-minute fake “thinking” required.

---

## Non-goals (until scheduled)

- Writing document bodies
- Silent status/schedule mutations
- Timeline-owned alarms
- ElevenLabs / SFX banks (`gina-audio-deferred.mdc`)
- Assuming user confirmation

---

## Relation to live Gina

- Phase 1: listen / scope / open doc — live.
- Phase 1.5: `{ message, visualization }` — in progress.
- **Daily Report nudge v1 honest — live:** schedule truth + folder % snapshot + pending brief; empty = short message only (no fake collisions); conflict popover 30m; celebrate when dayComplete. No activity log yet.
