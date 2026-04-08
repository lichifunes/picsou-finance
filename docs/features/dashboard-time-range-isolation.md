# Feature: Dashboard Time Range Isolation

> Last updated: 2026-04-08

## Context

The Dashboard displays net worth history, account distribution, and goals. When a user clicks time range buttons (1D, 7D, 1M, etc.), only the net worth chart should update. Distribution and goals are unaffected. The time range state lives inside `NetWorthChart` so changing it never triggers a page-level re-render or re-fetch.

## How it works

The dashboard fetches all data once via `useDashboard()` (no range parameter). The backend always returns 12 months of net worth history. `NetWorthChart` filters this data client-side based on the selected range.

### Key files

- `frontend/src/pages/dashboard/DashboardPage.tsx` — Page layout, single `useDashboard()` call, passes full `netWorthHistory` to chart
- `frontend/src/components/shared/NetWorthChart.tsx` — Chart with internal `range` state, `TimeRangeSelector`, and `filterByRange()` client-side filter
- `frontend/src/components/shared/TimeRangeSelector.tsx` — Time range button controls (1D, 7D, 1M, 3M, YTD, 1Y, ALL)
- `backend/src/main/java/com/picsou/service/DashboardService.java` — `buildNetWorthHistory()` always fetches last 12 months

### Flow

```
DashboardPage mounts
  ↓
useDashboard() fetches /api/dashboard (no range param)
  ↓
Backend returns 12 months of history + distribution + goals
  ↓
DashboardPage passes data.netWorthHistory to NetWorthChart
  ↓
User clicks "3M" button inside the chart
  ↓
NetWorthChart.setRange('3M') — local state only
  ↓
filterByRange() filters history to last 90 days (useMemo)
  ↓
Chart re-renders with filtered data
  ↓
Rest of page (hero, distribution, goals): completely unaffected
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Client-side filtering in `NetWorthChart` | Single API call, instant range switching, no extra backend work | Separate API call per range — backend ignores the `range` param anyway, would duplicate requests |
| `range` state inside `NetWorthChart` (local `useState`) | Scope isolation — only the chart re-renders on range change | State in `DashboardPage` — caused full page re-render on every range change |
| Default range `'1Y'` | Matches the 12 months of data the backend returns. Consistent with user expectations. | `'ALL'` — identical to 1Y given backend data window |
| Responsive `TimeRangeSelector` buttons | Smaller padding/font on mobile (`px-1.5 text-[11px]`), larger on `sm:` breakpoint. `flex-wrap` for overflow. | Fixed size — overflows on small screens |

## Gotchas / Pitfalls

- **Backend always returns 12 months**: `DashboardService.buildNetWorthHistory()` hardcodes `LocalDate.now().minusMonths(12)`. Ranges like `'ALL'` will only show 12 months unless the backend is updated.

- **`filterByRange()` uses `new Date()` at filter time**: The cutoff date is computed on each range change relative to "now". If the page stays open across midnight, the filtered window shifts accordingly.

- **`NetWorthChart` is used elsewhere**: It's a shared component in `components/shared/`. The `TimeRangeSelector` is now always rendered inside it. If another page uses `NetWorthChart`, it will also show the range selector.

## Tests

No dedicated test files. Manual verification:

1. Open Dashboard
2. Click range buttons in the chart → only chart data changes, hero/distribution/goals stay static
3. Verify range buttons are usable on mobile viewport (no overflow)
4. Refresh page → chart defaults to 1Y

## Links

- Related ADR: [Component-local state for UI filters](../decisions/2026-04-05-component-local-state-for-ui-filters.md)
