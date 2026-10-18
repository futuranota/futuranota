# Storage District — visual reference

**Status:** live at `/app/settings/storage`. Desk background stays beige. The sheet is white. Demo tree until live usage is measured.
**Date:** 2026-10-16
**Source:** user-provided `StorageDistrict` paste. Exact copy: component + demo.

## What this is

Navigable storage map. A folder tree (`StorageNode`) renders as isometric blocks (height and blue intensity = size) or as a list. Breadcrumb drill-down, sort by size or name, capacity meter, and an inspector for the selected item.

- Component: `StorageDistrict.original.tsx`
- Demo tree (placeholder workspace, 64 GB capacity): `StorageDistrict.demo.tsx`

## Where it lives

The port is mounted from `src/components/prompts/StorageDistrict.jsx` on the beige desk. The sheet itself is white.

Icons are inline SVG. The card surface is `var(--surface-base)`. Demo names and byte sizes stay placeholders until live storage usage is measured.
