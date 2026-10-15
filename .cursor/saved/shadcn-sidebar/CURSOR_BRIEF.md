# Collapsible sidebar — reference (shadcn Sidebar)

**Role:** Saved paste for the next sidebar pass. Not wired. Not the admin `/panel` nav (`admin-sidebar-nav`).

**Source archive:** `Sidebar.original.tsx` in this folder. Exact paste: component + `SidebarDemo`.

## What it is

shadcn/ui Sidebar: provider, collapse (offcanvas / icon / none), mobile sheet, cookie `sidebar_state`, shortcut Ctrl/Cmd+B, menu, footer with a user row, trigger in the main area.

Demo items are placeholders: Home, Inbox, Calendar, Search, Settings, and a footer “John Doe”.

## When we use it

Adapt the structure (provider, collapsed state, menu, footer, trigger). Do not drop the file in as-is.

This repo is Vite + JSX. It does not use `cn`, `@/` aliases, `lucide-react`, Radix Slot, or class-variance-authority. Port to plain JSX and the desk CSS. Surface stays `var(--surface-base)`.

Do not replace `src/admin/AdminSidebarNav.jsx` with this paste unless the task is the admin panel.
