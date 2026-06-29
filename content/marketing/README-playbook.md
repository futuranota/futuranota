# Marketing Guide Playbook (texto fijo)

Edita estos archivos para cambiar lo que escribe el Marketing Guide. No usa LLM.

| Archivo | Idioma |
|---------|--------|
| [`playbook.es.md`](playbook.es.md) | Español |
| [`playbook.en.md`](playbook.en.md) | English |

## Placeholders

- `{brand}` — nombre de la marca del corpus/canvas
- `{brandContextSection}` — párrafo opcional dentro de «Datos de mercado» (solo si el Analista trajo datos verificados)

## Imágenes (pendientes)

Cada sección termina con un placeholder:

```markdown
[Imagen Calendar]()
```

Cuando tengas las URLs o rutas, reemplazá por:

```markdown
![Calendar](/ruta/a/imagen.png)
```

## Reglas de formato (automáticas al publicar)

- Sin líneas `---`
- Sin énfasis con asteriscos `*` / `**`
- Máximo un renglón en blanco entre párrafos

Tras editar, reiniciá `npm run dev` si el hot reload no refleja el cambio.
