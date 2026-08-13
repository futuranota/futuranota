# Easy Link — visualizar folders por %

**Status:** deferred (memoria de producto). No implementar hasta cerrar polish de “Horarios de la semana”.

## Título / entry

Easy Link: **`[ visualizar folders por % ]`**

## Objetivo

Gina muestra un **bar chart** de porcentaje completado **por folder**, con el nombre de cada folder.

## Reglas de viz

- Barras = `%` completado del folder (+ nombre).
- Si hay **vencidos que aún viven** (slot pasado, status no cerrado / no `past_due` al día): pintar esos en **gris** y una línea baja que diga **vencidos**.
- Si no hay vencidos en ese alcance: solo las barras de % de horarios/folders.

## Notas

- LIVE CORPUS ONLY — no inventar folders.
- Distinto del pie “Avance de la semana por folder” (semana); este Easy Link es la entrada global / ritual de folders por %.
- Orden de build: después del polish de semana + open folder desde avance %.
