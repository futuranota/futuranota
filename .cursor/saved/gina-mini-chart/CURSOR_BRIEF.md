# Mini bar chart — visual reference

**Status:** saved for later (not wired into the app yet).  
**Date:** 2026-08-14  
**Source:** user-provided `MiniChart` (shadcn/`cn` demo). This repo does **not** use `cn` / shadcn — adapt to JSX + `gina-chat.css` / `#151515` when implementing.

## What this is

Weekly mini bar chart: hover a bar → value % in the header, bar scales, neighbors dim, tooltip on the bar. Labels are weekday initials (M T W …).

Canonical copy of the snippet: `MiniChart.original.tsx`.

## Do not assume

- Do not import `@/lib/utils` or `cn`.
- Dummy data in the snippet is placeholder; live data TBD when the user explains the use (Gina weather / hours / etc.).
