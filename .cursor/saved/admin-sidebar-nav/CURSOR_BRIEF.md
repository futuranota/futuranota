# Admin SidebarNav — reference for `/panel` nav

**Role:** Visual + interaction reference to replace the current pill chips (`.admin-tabs`) in Futura Nota admin with a hierarchical sidebar (groups, expandable children, active row, optional collapse / command search).

**Production (live):**
- Shell: `src/admin/AdminPage.jsx` — hierarchical `AdminSidebarNav`
- Nav: `src/admin/AdminSidebarNav.jsx`
- Management sections: `src/admin/ManagementAdminPanel.jsx` (`section` prop)
- Styles: `src/admin/admin.css` (`.admin-nav*`)

**Source archive (this folder):** Magic paste kept as UX reference.

## Files

| File | Purpose |
|---|---|
| `SidebarNav.original.tsx` | Exact paste (TS + lucide-react + shadcn-like Tailwind tokens + preview shell) |

## Management subsections (live)

1. **API Integrations** — KPIs, integration cards, edit form, pie charts
2. **Users** — users table
3. **Recent Calls** — recent events table
4. **Storage** — empty placeholder

Other top-level tabs stay siblings: Signals, Campaign Detector, Horizon Scan, Scan Sources.

## Integrate notes

- Ported without `lucide-react` / shadcn tokens — CSS in `admin.css`.
- WorkspaceSwitcher / command palette from the mock were **not** wired.

See also: `.cursor/rules/admin-sidebar-nav-reference.mdc`
