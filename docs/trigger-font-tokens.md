# Trigger font tokens (`:` / `)`)

## Qué hace

Dentro del texto de documentos / macronodos, **solo el token** que contiene `:` o `)` se pinta con Space Grotesk (peso 600). El **espacio** (o salto de línea) corta ese token; el resto queda en la tipografía normal del documento (Hanken Grotesk 14px).

### Ejemplos

| Escribes | Space Grotesk | Normal |
|---|---|---|
| `a) hola mundo` | `a)` | ` hola mundo` |
| `1: hello` | `1:` | ` hello` |
| `1:1 more` | `1:1` | ` more` |
| `Response: x` | `Response:` | ` x` |
| `solo texto` | — | todo |

No depende de expandir el documento: solo del **contenido tipado**.

## Tipografía del token

Misma idea que el snippet de Google Fonts (Space Grotesk ya está cargado en `index.html`; no hace falta `@import`):

```css
.doc-slash-field__trigger-token {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-optical-sizing: auto;
  font-weight: 600;
  font-style: normal;
  font-size: inherit; /* hereda 14px del doc */
}
```

Texto regular: Hanken Grotesk via `--font-doc` / `--font-doc-size: 14px`.

## Por qué no es un `className` en todo el textarea

Un `<textarea>` nativo no puede mezclar dos fuentes en el mismo string.  
Por eso: el **textarea sigue siendo el editor**; una capa de pintura (mirror) solo dibuja el texto, igual que el patrón de inplace-select.

- Sin `:` / `)` → no hay mirror; el textarea se ve y se comporta como antes.
- Con token trigger → el textarea pasa a texto transparente (caret visible) y el mirror pinta: token en Space Grotesk, resto normal.
- El color del mirror es fijo (`#fff`), **no** se copia del textarea transparente (eso ocultaba el texto en un intento anterior).

## Archivos

| Archivo | Rol |
|---|---|
| [`src/lib/docTextTriggerFont.js`](src/lib/docTextTriggerFont.js) | `triggerTokenRanges` / `triggerTokenSegments` / `hasTriggerTokens` |
| [`src/components/docs/blocks/SlashAwareTextarea.jsx`](src/components/docs/blocks/SlashAwareTextarea.jsx) | Mirror de pintura + textarea |
| [`src/styles/left-panel.css`](src/styles/left-panel.css) | `.doc-slash-field__trigger-mirror`, `__trigger-token`, `__input--trigger-paint` |
| [`src/components/nodes/NodeWritingBlockStack.jsx`](src/components/nodes/NodeWritingBlockStack.jsx) | Usa siempre `SlashAwareTextarea` en bloques de texto (también sin expand) |

## Regla formal

1. Partir el string por whitespace (espacio / newline).
2. Si un token contiene al menos un `:` o `)`, ese rango es trigger.
3. Tras el whitespace, el estilo vuelve a normal hasta el próximo token trigger.

## Cómo probar

1. Abrir un documento o macronodo (donde escribes el body).
2. Escribir `a) resto del texto`.
3. Debe verse `a)` más “display” (Space Grotesk 600) y el resto igual que siempre.
4. Borrar el `)`: vuelve todo a Hanken, sin capa de pintura.
