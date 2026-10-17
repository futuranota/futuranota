# Storage District — visual reference

**Status:** live in the prompt desk at `/app/settings/storage`. The page still uses the demo tree.
**Date:** 2026-10-16
**Source:** user-provided `StorageDistrict` paste. Exact copy: component + demo.

## What this is

Navigable storage map. A folder tree (`StorageNode`) renders as isometric blocks (height and blue intensity = size) or as a list. Breadcrumb drill-down, sort by size or name, capacity meter, and an inspector for the selected item.

- Component: `StorageDistrict.original.tsx`
- Demo tree (placeholder workspace, 64 GB capacity): `StorageDistrict.demo.tsx`

## Where it lives

The port is `src/components/prompts/StorageDistrict.jsx` with `storage-district.css`. Settings in the desk sidebar opens `/app/settings/storage`.

Icons are inline SVG. The card surface is `var(--surface-base)`. Demo names and byte sizes stay placeholders until live storage usage is measured.
