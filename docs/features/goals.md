# Feature: Goals

> Last updated: 2026-04-04

## Context

Picsou lets users define savings goals with a target amount and deadline. Goals are linked to one or more accounts (M:N relationship). Progress is computed from the current balances of linked accounts compared to the target. Monthly tracking shows how much has been saved each month versus how much is needed, with optional per-month overrides.

## How it works

### Goal-Account relationship

A `Goal` has a M:N relationship with `Account` via the `goal_account` join table. An account can belong to multiple goals, and a goal can have multiple accounts. When progress is calculated, the balances of all linked accounts are summed.

### Progress calculation

`GoalService.toProgressResponse()` computes:

- **currentTotal**: Sum of `currentBalanceEur` across all linked accounts (via `AccountService.toResponse()` which applies currency conversion).
- **percentComplete**: `(currentTotal / targetAmount) * 100`, rounded to 4 decimal places.
- **monthsLeft**: `ChronoUnit.MONTHS.between(today, deadline)`, minimum 0.
- **monthlyNeeded**: `(target - currentTotal) / monthsLeft`. If deadline has passed, the entire remaining amount is the monthly need.
- **avgMonthlyContribution**: Average monthly balance increase over the last 3 months across all linked accounts, computed from `BalanceSnapshot` history. Returns `null` if no snapshot history exists yet.
- **isOnTrack**: `true` if `avgMonthlyContribution >= monthlyNeeded` or if no history exists yet (benefit of the doubt).

### Monthly tracking

`GoalService.getMonthlyEntries()` generates a month-by-month breakdown from goal creation to deadline. For each month:

- **objective**: The auto-computed `monthlyNeeded`.
- **actual**: The real balance delta for that month (from snapshots: end-of-month balance minus end-of-previous-month balance). `null` for future months.
- **manualActual**: A manually entered contribution amount (from `GoalManualContribution`). Takes precedence over computed actual.
- **override**: A per-month override for the objective (from `GoalMonthOverride`). Stored but tracked alongside the auto-computed value.
- **effective**: `manualActual` if set, otherwise `actual`.

### Overrides and manual contributions

Two separate override mechanisms:

- **GoalMonthOverride**: Overrides the monthly savings *objective* for a specific month. Useful when the user plans to save more or less than the computed target.
- **GoalManualContribution**: Overrides the monthly savings *actual* for a specific month. Useful when the user wants to track contributions that don't appear in account balances (e.g. cash savings).

### Key files

- `service/GoalService.java` -- Business logic: CRUD, progress calculation, monthly tracking, overrides
- `controller/GoalController.java` -- REST endpoints under `/api/goals/`
- `model/Goal.java` -- JPA entity: name, targetAmount, deadline, M:N accounts
- `model/GoalMonthOverride.java` -- Per-month objective override (goal_id, yearMonth, amount)
- `model/GoalManualContribution.java` -- Per-month actual override (goal_id, yearMonth, amount)
- `repository/GoalRepository.java` -- `findAllWithAccounts()` for eager fetching
- `repository/GoalMonthOverrideRepository.java` -- Override lookup by goal + month
- `repository/GoalManualContributionRepository.java` -- Contribution lookup by goal + month

### Flow

```
Create goal (name, targetAmount, deadline, accountIds)
        |
        v
GoalService.create() --> save Goal with linked accounts
        |
        v
GoalService.toProgressResponse()
        |
        +-- sum account balances --> currentTotal
        +-- compute monthsLeft, monthlyNeeded
        +-- calculateAvgMonthlyContribution() from snapshots
        +-- determine isOnTrack
        |
        v
Get monthly entries:
        |
        v
GoalService.getMonthlyEntries(goalId)
        |
        +-- for each month from creation to deadline:
        |       +-- calculateActualForMonth() from snapshots
        |       +-- lookup GoalManualContribution
        |       +-- lookup GoalMonthOverride
        |       +-- build GoalMonthEntryResponse
        |
        v
Set month override:
GoalService.setMonthOverride(goalId, yearMonth, amount)
        --> upsert GoalMonthOverride
        --> return updated entry
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| M:N goal-account relationship | A savings goal often spans multiple accounts (checking + savings + PEA) | One account per goal (too restrictive) |
| Snapshot-based actual calculation | Uses existing BalanceSnapshot data; no need for a separate transaction import | Dedicated savings transaction table |
| Separate override + manual contribution | Different semantics: override changes the target, manual contribution changes the actual | Single override field (loses information) |
| 3-month average for `avgMonthlyContribution` | Short enough to reflect recent behavior, long enough to smooth out noise | 6-month or 12-month average (too slow to reflect changes) |
| `null` for no history | Distinguishes "no data yet" from "zero contribution"; `isOnTrack` treats null as "benefit of the doubt" | Return zero (would mark new goals as "not on track") |

## Gotchas / Pitfalls

- **Accounts can belong to multiple goals**: If an account is linked to two goals, its full balance counts toward both goals' `currentTotal`. There is no "partial allocation."
- **Monthly actual is computed from snapshots, not transactions**: The actual savings for a month is the delta between end-of-month snapshot balances. If snapshots are missing (e.g. new account, no sync), that month will have `null` actual.
- **Override does not recalculate monthlyNeeded**: Setting a month override changes the display value for that month but does not affect the computed `monthlyNeeded`. The auto-computed objective is always based on `(target - current) / monthsLeft`.
- **Goal creation to deadline range**: `getMonthlyEntries()` iterates from the goal's `createdAt` month to the deadline month. If the goal was created mid-month, the first month's actual may be partial.
- **`findAllWithAccounts()` uses a custom query**: Goals are fetched with their accounts eagerly loaded to avoid N+1 queries during progress calculation.

## Tests

- `GoalServiceTest` -- unit tests for progress calculation, monthly entries, overrides, edge cases (deadline passed, no history)

## Links

- Related feature: [Bank sync](./bank-sync.md) (provides balance snapshots)
- Related feature: [Price service](./price-service.md) (EUR conversion for account balances)
