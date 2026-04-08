# Feature: Theme persistence (dark / light / system)

> Last updated: 2026-04-08

## Context

Users can choose between dark, light, and system themes in Settings. Without persistence, the selected theme was lost on every page refresh because the DOM class was only applied when `SettingsPage` was mounted — all other pages loaded with no `.dark` class on `<html>`.

## How it works

Theme is stored in `localStorage` under the key `'theme'` (`'light' | 'dark' | 'system'`). On every page load, an inline script in `index.html` reads that value and adds the `dark` class to `<html>` before any CSS or JS runs (preventing flash of unstyled content). React then picks up an already-correct DOM.

### Key files

- `frontend/index.html` — inline script that applies `.dark` class immediately on load
- `frontend/src/lib/theme.ts` — shared helpers: `getStoredTheme`, `applyTheme`, `initSystemThemeListener`
- `frontend/src/main.tsx` — calls `initSystemThemeListener()` once at startup
- `frontend/src/pages/settings/SettingsPage.tsx` — UI toggle, reads/writes via `lib/theme`
- `frontend/src/index.css` — CSS variables under `:root` (light) and `.dark` (dark)

### Flow

```
Page load
  └─ index.html inline script
       └─ reads localStorage('theme')
       └─ adds .dark to <html> if needed   ← happens before any CSS paints

React mounts
  └─ main.tsx: initSystemThemeListener()
       └─ watches matchMedia change
       └─ re-applies theme when OS preference changes (only if theme = 'system')

User changes theme (SettingsPage)
  └─ setTheme(value)
  └─ useEffect → applyTheme(theme)
       └─ toggles .dark class on document.documentElement
       └─ writes to localStorage('theme')
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Inline script in `index.html` | Runs before CSS/JS, zero FOUC | Initialize in `main.tsx` (too late, React hasn't painted yet) |
| Shared `lib/theme.ts` | Single source of truth for applyTheme logic | Keep helpers in SettingsPage (breaks on other pages) |
| System listener in `main.tsx` | Active on all pages, not just Settings | Listener inside SettingsPage (stopped working when page unmounted) |
| CSS classes on `<html>` + Tailwind variables | Standard Tailwind dark mode approach | Zustand-stored theme driving conditional class props (complex, no FOUC protection) |

## Gotchas / Pitfalls

- **The inline script must stay in `<head>` before any stylesheet link.** Moving it to `<body>` or after stylesheets causes a brief flash in dark mode on page load.
- **`initSystemThemeListener` registers a persistent event listener** — it must only be called once (currently in `main.tsx`). Calling it inside a component would add a new listener on every mount.
- **`localStorage.getItem('theme')` can return `null`** (first visit) — `getStoredTheme` defaults to `'system'` in that case, matching the inline script which also defaults to system.
- Tailwind dark mode is configured via the `dark` class on the root element (not `media` strategy) — if this changes, the inline script and `applyTheme` need to be updated.

## Tests

No automated tests — purely DOM/localStorage manipulation. Manual verification:
1. Set Dark → refresh → stays dark on any page
2. Set System → toggle OS dark mode → page reacts without reload
