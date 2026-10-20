# Prompt instructions stepper — visual + product reference

**Status:** live in the prompt desk. Page 1 = this stepper. Pages 2+ = pure prompts. Card title = `step.title`, defaulted from the file name.
**Date:** 2026-10-20
**Source:** user paste (component + vertical demo).

## Files

- Component: `Stepper.original.tsx`
- Demo: `Stepper.demo.tsx` (vertical, `defaultValue={2}`, Check / spinner indicators)

## Product decisions (this chat)

1. **Título del prompt (rápido)**
   - `prompt.name` sigue siendo el instance del file (default = nombre del PDF / archivo).
   - El título visible de cada prompt **no** queda atado al file.
   - Default del título de card = instance del file, **editable**.
   - Campo ya existe: `step.title` en `prompt_steps` / `blankStep()`. Hoy el sheet y el float escriben `prompt.name`.
   - Motivo: un PDF trae varios prompts con roles distintos.

2. **Páginas del file**
   - Página 1 = **instructions** (stepper: Step 1, 2, 3… cada sección a seguir).
   - Páginas 2+ = **prompts puros** (sin cara instrucción/prompt mezclada).

3. **Stepper en la card de instrucciones**
   - Vertical, como el demo.
   - Cada sección de instrucciones = un step.
   - Port al estilo del repo: JSX + CSS, sin `lucide-react`, sin `cn`, sin `@/` aliases.
   - Superficie: `var(--surface-base)`.

## Hoy en el desk (no romper al portar)

- Cada `step` tiene `description` (instrucción) + `prompt` (texto a pegar).
- Sheet: tabs Instrucciones / Prompt (`sheetFace` 0 | 1).
- Float: toggle See instructions / See prompt.
- Organize PDF: un sheet Groq = un step con ambas caras.

## Port notes

- Keyboard / tablist del original se conserva.
- Iconos: check inline SVG; loading = CSS spin, no Lucide.
- No es el Step Sequence de documentos (`StepSequenceBlockView`).
