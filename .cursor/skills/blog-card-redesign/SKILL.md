---
name: blog-card-redesign
description: >
  Rediseño de cards de /blogs (grid uniforme, imagen lazy 16:9, meta author·fecha·read,
  título line-clamp-2, excerpt line-clamp-3, hover accent). Guardado en
  .cursor/saved/blog-card-redesign/ — reactivar cuando el usuario pida "aplicar blog cards v2"
  o "restaurar diseño de blogs nuevo".
---

# Blog card redesign (saved)

Implementación guardada el 2026-06-06. **No está activa** en la app; el sitio usa el layout anterior (featured + blog-grid).

## Archivos guardados

| Archivo | Destino al reactivar |
|---------|----------------------|
| `BlogLazyImage.jsx` | `src/marketing/components/BlogLazyImage.jsx` |
| `BlogCard.jsx` | `src/marketing/components/BlogCard.jsx` (ajustar imports a `../lib/paths.js`) |
| `Blogs.jsx` | `src/marketing/sections/Blogs.jsx` (ajustar imports) |
| `sections.css.snippet` | Reemplazar bloque BLOGS en `src/marketing/styles/sections.css` |

## Tina (opcional al reactivar)

En `tina/config.ts`, colección `blog`:

```ts
{ type: 'string', name: 'createdAt', label: 'Published date (YYYY-MM-DD)' },
{ type: 'string', name: 'image', label: 'Cover image URL' },
```

## Comportamiento

- Grid uniforme `.blog-card-grid` (sin featured grande separado)
- `feat: true` solo ordena primero
- Imagen: `article.image` o `picsum.photos/seed/{slug}`
- Meta: `by {author} · {createdAt} · {read} read`

## Referencia visual

Inspirado en componente BlogSection con LazyImage, hover scale en imagen, fondo accent al hover.
