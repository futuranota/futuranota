# Marketing Guide Playbook (texto fijo)

Edita estos archivos para cambiar lo que escribe el Marketing Guide. No usa LLM.

| Archivo | Idioma |
|---------|--------|
| [`playbook.es.md`](playbook.es.md) | Español |
| [`playbook.en.md`](playbook.en.md) | English |

## Placeholders

- `{brand}` — nombre de la marca del corpus/canvas
- `{brandContextSection}` — párrafo opcional dentro de «Datos de mercado» (solo si el Analista trajo datos verificados)

## Imágenes (Marketing Guide)

Colocá JPG/PNG en `public/uploads/` y referenciá con:

```markdown
[Imagen Calendar](/uploads/calendar.jpg)
```

**Tamaño ideal de exportación:** ancho **580 px** (doc ~620 px menos padding). Para retina: **1160 px** de ancho. Mantener proporción; el visor las estira al ancho del documento con 16 px de margen lateral, centradas.

| Archivo | Uso |
|---------|-----|
| `calendar.jpg` | Calendar |
| `product-search.jpg` | Listado / tendencias |
| `ideas.jpg` | Productos / datos de mercado |
| `weather.jpg` | Forecast |

## Reglas de formato (automáticas al publicar)

- Sin líneas `---`
- Sin énfasis con asteriscos `*` / `**`
- Máximo un renglón en blanco entre párrafos

Tras editar, reiniciá `npm run dev` si el hot reload no refleja el cambio.
